'use client';

import { useState } from 'react';
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  X,
  DollarSign,
  Home,
  FileText,
  CheckCircle,
} from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { firebaseDb, firebaseAuth } from '@/lib/firebase';
import { useParcels } from '@/hooks/useFirestore';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { cn, formatCurrency, getStatusColor } from '@/lib/utils';
import type { Parcel, ParcelStatus } from '@/types';

interface ParcelsListProps {
  projectId: string;
  county?: string;
  state?: string;
}

interface ParcelFormData {
  apn: string;
  county: string;
  state: string;
  acres: number;
  zoning: string;
  landUse: string;
  ownerName: string;
  ownerAddress: string;
  status: ParcelStatus;
  assessedValue: number;
  marketValue: number;
}

const initialFormData: ParcelFormData = {
  apn: '',
  county: '',
  state: '',
  acres: 0,
  zoning: '',
  landUse: '',
  ownerName: '',
  ownerAddress: '',
  status: 'available',
  assessedValue: 0,
  marketValue: 0,
};

const statusOptions: { value: ParcelStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'under_option', label: 'Under Option' },
  { value: 'leased', label: 'Leased' },
  { value: 'owned', label: 'Owned' },
];

function ParcelForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
}: {
  initialData: ParcelFormData;
  onSubmit: (data: ParcelFormData) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<ParcelFormData>(initialData);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* APN */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Parcel Number (APN) *
          </label>
          <input
            type="text"
            required
            value={formData.apn}
            onChange={(e) => setFormData({ ...formData, apn: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
            placeholder="e.g., 123-456-789"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status *
          </label>
          <select
            required
            value={formData.status}
            onChange={(e) =>
              setFormData({ ...formData, status: e.target.value as ParcelStatus })
            }
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* County */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            County *
          </label>
          <input
            type="text"
            required
            value={formData.county}
            onChange={(e) => setFormData({ ...formData, county: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
            placeholder="e.g., Sangamon"
          />
        </div>

        {/* State */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            State *
          </label>
          <input
            type="text"
            required
            maxLength={2}
            value={formData.state}
            onChange={(e) =>
              setFormData({ ...formData, state: e.target.value.toUpperCase() })
            }
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
            placeholder="e.g., IL"
          />
        </div>

        {/* Acres */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Acres *
          </label>
          <input
            type="number"
            required
            min={0}
            step={0.01}
            value={formData.acres || ''}
            onChange={(e) =>
              setFormData({ ...formData, acres: parseFloat(e.target.value) || 0 })
            }
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
            placeholder="e.g., 100"
          />
        </div>

        {/* Zoning */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Zoning
          </label>
          <input
            type="text"
            value={formData.zoning}
            onChange={(e) => setFormData({ ...formData, zoning: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
            placeholder="e.g., Agricultural"
          />
        </div>

        {/* Land Use */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Current Land Use
          </label>
          <input
            type="text"
            value={formData.landUse}
            onChange={(e) => setFormData({ ...formData, landUse: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
            placeholder="e.g., Farmland"
          />
        </div>

        {/* Owner Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Owner Name
          </label>
          <input
            type="text"
            value={formData.ownerName}
            onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
            placeholder="e.g., John Smith"
          />
        </div>

        {/* Owner Address */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Owner Address
          </label>
          <input
            type="text"
            value={formData.ownerAddress}
            onChange={(e) =>
              setFormData({ ...formData, ownerAddress: e.target.value })
            }
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
            placeholder="e.g., 123 Main St, Springfield, IL 62701"
          />
        </div>

        {/* Assessed Value */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Assessed Value ($)
          </label>
          <input
            type="number"
            min={0}
            step={100}
            value={formData.assessedValue || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                assessedValue: parseFloat(e.target.value) || 0,
              })
            }
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
            placeholder="e.g., 500000"
          />
        </div>

        {/* Market Value */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Market Value ($)
          </label>
          <input
            type="number"
            min={0}
            step={100}
            value={formData.marketValue || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                marketValue: parseFloat(e.target.value) || 0,
              })
            }
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
            placeholder="e.g., 750000"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Save Parcel
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

export function ParcelsList({ projectId, county, state }: ParcelsListProps) {
  const { data: parcels, loading, error } = useParcels(projectId);
  const [showForm, setShowForm] = useState(false);
  const [editingParcel, setEditingParcel] = useState<Parcel | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleAddParcel = async (data: ParcelFormData) => {
    setIsSubmitting(true);
    try {
      const user = firebaseAuth.currentUser;
      if (!user) throw new Error('Not authenticated');

      await addDoc(collection(firebaseDb, 'parcels'), {
        ...data,
        projectId,
        tenantId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setShowForm(false);
    } catch (error) {
      console.error('Error adding parcel:', error);
    }
    setIsSubmitting(false);
  };

  const handleEditParcel = async (data: ParcelFormData) => {
    if (!editingParcel) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(firebaseDb, 'parcels', editingParcel.id), {
        ...data,
        updatedAt: serverTimestamp(),
      });
      setEditingParcel(null);
    } catch (error) {
      console.error('Error updating parcel:', error);
    }
    setIsSubmitting(false);
  };

  const handleDeleteParcel = async (parcelId: string) => {
    try {
      await deleteDoc(doc(firebaseDb, 'parcels', parcelId));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting parcel:', error);
    }
  };

  const getStatusBadge = (status: ParcelStatus) => {
    const variants: Record<ParcelStatus, 'success' | 'warning' | 'info' | 'default'> = {
      available: 'default',
      under_option: 'warning',
      leased: 'success',
      owned: 'info',
    };
    return (
      <Badge variant={variants[status]}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        Error loading parcels: {error.message}
      </div>
    );
  }

  // Show add form
  if (showForm) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Add New Parcel</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ParcelForm
            initialData={{
              ...initialFormData,
              county: county || '',
              state: state || '',
            }}
            onSubmit={handleAddParcel}
            onCancel={() => setShowForm(false)}
            isLoading={isSubmitting}
          />
        </CardContent>
      </Card>
    );
  }

  // Show edit form
  if (editingParcel) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Edit Parcel: {editingParcel.apn}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setEditingParcel(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ParcelForm
            initialData={{
              apn: editingParcel.apn,
              county: editingParcel.county,
              state: editingParcel.state,
              acres: editingParcel.acres,
              zoning: editingParcel.zoning || '',
              landUse: editingParcel.landUse || '',
              ownerName: editingParcel.ownerName || '',
              ownerAddress: editingParcel.ownerAddress || '',
              status: editingParcel.status,
              assessedValue: editingParcel.assessedValue || 0,
              marketValue: editingParcel.marketValue || 0,
            }}
            onSubmit={handleEditParcel}
            onCancel={() => setEditingParcel(null)}
            isLoading={isSubmitting}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Parcels ({parcels.length})</CardTitle>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Parcel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {parcels.length === 0 ? (
          <div className="text-center py-8">
            <MapPin className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No parcels yet</h3>
            <p className="text-gray-500 mb-4">
              Add parcels manually or they will be automatically created from approved
              lease documents.
            </p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Parcel
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {parcels.map((parcel: any) => (
              <div
                key={parcel.id}
                className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-5 h-5 text-purple-500" />
                      <span className="font-semibold text-lg">APN: {parcel.apn}</span>
                      {getStatusBadge(parcel.status)}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Location:</span>
                        <p className="font-medium">
                          {parcel.county}, {parcel.state}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Acreage:</span>
                        <p className="font-medium">{parcel.acres} acres</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Zoning:</span>
                        <p className="font-medium">{parcel.zoning || 'Not specified'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Land Use:</span>
                        <p className="font-medium">{parcel.landUse || 'Not specified'}</p>
                      </div>
                    </div>

                    {parcel.ownerName && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center gap-2 text-sm">
                          <Home className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-500">Owner:</span>
                          <span className="font-medium">{parcel.ownerName}</span>
                        </div>
                        {parcel.ownerAddress && (
                          <p className="text-sm text-gray-500 ml-6">
                            {parcel.ownerAddress}
                          </p>
                        )}
                      </div>
                    )}

                    {(parcel.assessedValue > 0 || parcel.marketValue > 0) && (
                      <div className="mt-3 pt-3 border-t border-gray-200 flex gap-6 text-sm">
                        {parcel.assessedValue > 0 && (
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500">Assessed:</span>
                            <span className="font-medium">
                              {formatCurrency(parcel.assessedValue)}
                            </span>
                          </div>
                        )}
                        {parcel.marketValue > 0 && (
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500">Market:</span>
                            <span className="font-medium">
                              {formatCurrency(parcel.marketValue)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingParcel(parcel)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    {deleteConfirm === parcel.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteParcel(parcel.id)}
                        >
                          Confirm
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirm(parcel.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary section */}
        {parcels.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Summary</h4>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-blue-700 font-medium">Total Parcels</p>
                <p className="text-2xl font-bold text-blue-900">{parcels.length}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-green-700 font-medium">Total Acres</p>
                <p className="text-2xl font-bold text-green-900">
                  {parcels.reduce((sum: number, p: any) => sum + (p.acres || 0), 0).toFixed(1)}
                </p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="text-purple-700 font-medium">Secured</p>
                <p className="text-2xl font-bold text-purple-900">
                  {parcels.filter((p: any) => p.status === 'leased' || p.status === 'owned').length}
                </p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <p className="text-orange-700 font-medium">In Progress</p>
                <p className="text-2xl font-bold text-orange-900">
                  {parcels.filter((p: any) => p.status === 'under_option').length}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
