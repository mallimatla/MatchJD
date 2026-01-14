'use client';

import { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  Loader2,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  MapPin,
  DollarSign,
  Building,
  FileCheck,
  Zap,
  Filter,
  CheckSquare,
  Square
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase';
import { useReviewQueue } from '@/hooks/useFirestore';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { cn, formatDate, getUrgencyColor, formatCurrency } from '@/lib/utils';
import type { HITLRequest } from '@/types';

// Format extracted data for lease documents
function LeaseDataDisplay({ data }: { data: any }) {
  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Parties */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2 text-blue-700 font-medium mb-2">
            <User className="w-4 h-4" />
            Lessor (Landowner)
          </div>
          <p className="font-semibold">{data.lessor?.name || 'Not specified'}</p>
          {data.lessor?.entityType && (
            <p className="text-sm text-gray-600 capitalize">{data.lessor.entityType}</p>
          )}
          {data.lessor?.address && (
            <p className="text-sm text-gray-500 mt-1">{data.lessor.address}</p>
          )}
        </div>
        <div className="p-3 bg-green-50 rounded-lg">
          <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
            <Building className="w-4 h-4" />
            Lessee (Developer)
          </div>
          <p className="font-semibold">{data.lessee?.name || 'Not specified'}</p>
          {data.lessee?.entityType && (
            <p className="text-sm text-gray-600 capitalize">{data.lessee.entityType}</p>
          )}
          {data.lessee?.address && (
            <p className="text-sm text-gray-500 mt-1">{data.lessee.address}</p>
          )}
        </div>
      </div>

      {/* Property Details */}
      <div className="p-3 bg-purple-50 rounded-lg">
        <div className="flex items-center gap-2 text-purple-700 font-medium mb-2">
          <MapPin className="w-4 h-4" />
          Property Details
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Location:</span>
            <p className="font-medium">{data.county && data.state ? `${data.county}, ${data.state}` : 'Not specified'}</p>
          </div>
          <div>
            <span className="text-gray-500">Total Acres:</span>
            <p className="font-medium">{data.totalAcres ? `${data.totalAcres} acres` : 'Not specified'}</p>
          </div>
          {data.parcelNumbers?.length > 0 && (
            <div className="col-span-2">
              <span className="text-gray-500">Parcel Numbers:</span>
              <p className="font-medium">{data.parcelNumbers.join(', ')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Term & Dates */}
      <div className="p-3 bg-orange-50 rounded-lg">
        <div className="flex items-center gap-2 text-orange-700 font-medium mb-2">
          <Calendar className="w-4 h-4" />
          Lease Term
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Initial Term:</span>
            <p className="font-medium">{data.initialTermYears ? `${data.initialTermYears} years` : 'Not specified'}</p>
          </div>
          <div>
            <span className="text-gray-500">Commencement:</span>
            <p className="font-medium">{data.commencementDate || 'Not specified'}</p>
          </div>
          <div>
            <span className="text-gray-500">Expiration:</span>
            <p className="font-medium">{data.expirationDate || 'Not specified'}</p>
          </div>
        </div>
        {data.extensionOptions?.length > 0 && (
          <div className="mt-2 pt-2 border-t border-orange-200">
            <span className="text-gray-500 text-sm">Extension Options:</span>
            <p className="font-medium text-sm">
              {data.extensionOptions.map((opt: any, i: number) =>
                `${opt.termYears} years (${opt.noticeDays} days notice)`
              ).join(', ')}
            </p>
          </div>
        )}
      </div>

      {/* Financial Terms */}
      <div className="p-3 bg-emerald-50 rounded-lg">
        <div className="flex items-center gap-2 text-emerald-700 font-medium mb-2">
          <DollarSign className="w-4 h-4" />
          Financial Terms
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Rent per Acre:</span>
            <p className="font-medium">{data.rent?.baseRentPerAcre ? formatCurrency(data.rent.baseRentPerAcre) : 'Not specified'}</p>
          </div>
          <div>
            <span className="text-gray-500">Annual Escalation:</span>
            <p className="font-medium">{data.rent?.annualEscalationPercent ? `${data.rent.annualEscalationPercent}%` : 'Not specified'}</p>
          </div>
          <div>
            <span className="text-gray-500">Signing Bonus:</span>
            <p className="font-medium">{data.rent?.signingBonus ? formatCurrency(data.rent.signingBonus) : 'None'}</p>
          </div>
        </div>
        {data.purchaseOption?.exists && (
          <div className="mt-2 pt-2 border-t border-emerald-200">
            <span className="text-gray-500 text-sm">Purchase Option:</span>
            <p className="font-medium text-sm">{data.purchaseOption.priceFormula || 'Yes - see agreement for terms'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Format extracted data for PPA documents
function PPADataDisplay({ data }: { data: any }) {
  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Parties */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2 text-blue-700 font-medium mb-2">
            <Zap className="w-4 h-4" />
            Seller
          </div>
          <p className="font-semibold">{data.seller?.name || data.seller || 'Not specified'}</p>
          {data.seller?.address && (
            <p className="text-sm text-gray-500">{data.seller.address}</p>
          )}
        </div>
        <div className="p-3 bg-green-50 rounded-lg">
          <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
            <Building className="w-4 h-4" />
            Buyer
          </div>
          <p className="font-semibold">{data.buyer?.name || data.buyer || 'Not specified'}</p>
          {data.buyer?.address && (
            <p className="text-sm text-gray-500">{data.buyer.address}</p>
          )}
        </div>
      </div>

      {/* Project Details */}
      <div className="p-3 bg-purple-50 rounded-lg">
        <div className="flex items-center gap-2 text-purple-700 font-medium mb-2">
          <Zap className="w-4 h-4" />
          Project Details
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Project Name:</span>
            <p className="font-medium">{data.facilityName || data.projectName || 'Not specified'}</p>
          </div>
          <div>
            <span className="text-gray-500">Contract Capacity:</span>
            <p className="font-medium">{data.contractCapacity ? `${data.contractCapacity} MW AC` : 'Not specified'}</p>
          </div>
          <div>
            <span className="text-gray-500">Expected Annual Generation:</span>
            <p className="font-medium">{data.expectedAnnualGeneration ? `${data.expectedAnnualGeneration.toLocaleString()} MWh` : 'Not specified'}</p>
          </div>
          <div>
            <span className="text-gray-500">Location:</span>
            <p className="font-medium">{data.location || 'Not specified'}</p>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="p-3 bg-emerald-50 rounded-lg">
        <div className="flex items-center gap-2 text-emerald-700 font-medium mb-2">
          <DollarSign className="w-4 h-4" />
          Pricing Structure
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Contract Price:</span>
            <p className="font-medium">{data.price?.contractPrice || data.contractPrice ? `$${data.price?.contractPrice || data.contractPrice}/MWh` : 'Not specified'}</p>
          </div>
          <div>
            <span className="text-gray-500">Annual Escalation:</span>
            <p className="font-medium">{data.price?.annualEscalation || data.annualEscalation ? `${data.price?.annualEscalation || data.annualEscalation}%` : 'Not specified'}</p>
          </div>
          <div>
            <span className="text-gray-500">Term:</span>
            <p className="font-medium">{data.termYears || data.term ? `${data.termYears || data.term} years` : 'Not specified'}</p>
          </div>
        </div>
      </div>

      {/* Key Dates */}
      <div className="p-3 bg-orange-50 rounded-lg">
        <div className="flex items-center gap-2 text-orange-700 font-medium mb-2">
          <Calendar className="w-4 h-4" />
          Key Dates
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Expected COD:</span>
            <p className="font-medium">{data.expectedCommercialOperationDate || data.expectedCOD || 'Not specified'}</p>
          </div>
          <div>
            <span className="text-gray-500">Guaranteed COD:</span>
            <p className="font-medium">{data.guaranteedCommercialOperationDate || data.guaranteedCOD || 'Not specified'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Format extracted data for easement documents
function EasementDataDisplay({ data }: { data: any }) {
  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Parties */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2 text-blue-700 font-medium mb-2">
            <User className="w-4 h-4" />
            Grantor
          </div>
          <p className="font-semibold">{data.grantor?.name || data.grantor || 'Not specified'}</p>
          {data.grantor?.address && (
            <p className="text-sm text-gray-500">{data.grantor.address}</p>
          )}
        </div>
        <div className="p-3 bg-green-50 rounded-lg">
          <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
            <Building className="w-4 h-4" />
            Grantee
          </div>
          <p className="font-semibold">{data.grantee?.name || data.grantee || 'Not specified'}</p>
          {data.grantee?.address && (
            <p className="text-sm text-gray-500">{data.grantee.address}</p>
          )}
        </div>
      </div>

      {/* Easement Details */}
      <div className="p-3 bg-purple-50 rounded-lg">
        <div className="flex items-center gap-2 text-purple-700 font-medium mb-2">
          <MapPin className="w-4 h-4" />
          Easement Details
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Purpose:</span>
            <p className="font-medium">{data.purpose || 'Not specified'}</p>
          </div>
          <div>
            <span className="text-gray-500">Corridor Width:</span>
            <p className="font-medium">{data.corridorWidth || data.width ? `${data.corridorWidth || data.width} feet` : 'Not specified'}</p>
          </div>
          <div>
            <span className="text-gray-500">Length:</span>
            <p className="font-medium">{data.length || 'Not specified'}</p>
          </div>
          <div>
            <span className="text-gray-500">Parcel Number:</span>
            <p className="font-medium">{data.parcelNumber || 'Not specified'}</p>
          </div>
        </div>
      </div>

      {/* Compensation */}
      {(data.initialPayment || data.annualPayment || data.compensation) && (
        <div className="p-3 bg-emerald-50 rounded-lg">
          <div className="flex items-center gap-2 text-emerald-700 font-medium mb-2">
            <DollarSign className="w-4 h-4" />
            Compensation
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Initial Payment:</span>
              <p className="font-medium">{data.initialPayment ? formatCurrency(data.initialPayment) : 'Not specified'}</p>
            </div>
            <div>
              <span className="text-gray-500">Annual Payment:</span>
              <p className="font-medium">{data.annualPayment ? formatCurrency(data.annualPayment) : 'Not specified'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Generic data display for other document types
function GenericDataDisplay({ data, category }: { data: any; category: string }) {
  if (!data || Object.keys(data).length === 0) return null;

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'Not specified';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toLocaleString();
    if (Array.isArray(value)) return value.join(', ') || 'None';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const formatLabel = (key: string): string => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/_/g, ' ');
  };

  // Filter out nested objects for cleaner display
  const simpleFields = Object.entries(data).filter(([_, v]) =>
    typeof v !== 'object' || v === null || Array.isArray(v)
  );
  const nestedFields = Object.entries(data).filter(([_, v]) =>
    typeof v === 'object' && v !== null && !Array.isArray(v)
  );

  return (
    <div className="space-y-4">
      {/* Simple fields */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2 text-gray-700 font-medium mb-2">
          <FileCheck className="w-4 h-4" />
          {category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Details
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {simpleFields.map(([key, value]) => (
            <div key={key}>
              <span className="text-gray-500">{formatLabel(key)}:</span>
              <p className="font-medium">{formatValue(value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Nested objects */}
      {nestedFields.map(([key, value]: [string, any]) => (
        <div key={key} className="p-3 bg-blue-50 rounded-lg">
          <div className="text-blue-700 font-medium mb-2">{formatLabel(key)}</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {Object.entries(value).map(([subKey, subValue]) => (
              <div key={subKey}>
                <span className="text-gray-500">{formatLabel(subKey)}:</span>
                <p className="font-medium">{formatValue(subValue)}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReviewQueue() {
  const { data: requests, loading, error } = useReviewQueue();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Filter requests
  const filteredRequests = requests.filter((req: any) => {
    const category = req.context?.category || 'unknown';
    const urgency = req.urgency || 'medium';

    if (categoryFilter !== 'all' && category !== categoryFilter) return false;
    if (urgencyFilter !== 'all' && urgency !== urgencyFilter) return false;

    return true;
  });

  // Get unique categories and urgencies for filters
  const categories = [...new Set(requests.map((r: any) => r.context?.category || 'unknown'))];
  const urgencies = [...new Set(requests.map((r: any) => r.urgency || 'medium'))];

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredRequests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRequests.map((r: any) => r.id)));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);

    for (const requestId of selectedIds) {
      try {
        await updateDoc(doc(firebaseDb, 'hitlRequests', requestId), {
          status: 'approved',
          resolvedAt: new Date(),
          resolvedBy: 'current_user',
        });
      } catch (error) {
        console.error('Error approving:', error);
      }
    }

    setSelectedIds(new Set());
    setBulkProcessing(false);
  };

  const handleBulkReject = async () => {
    if (selectedIds.size === 0) return;
    const notes = prompt(`Reason for rejecting ${selectedIds.size} items:`);
    if (!notes) return;

    setBulkProcessing(true);

    for (const requestId of selectedIds) {
      try {
        await updateDoc(doc(firebaseDb, 'hitlRequests', requestId), {
          status: 'rejected',
          resolvedAt: new Date(),
          resolvedBy: 'current_user',
          notes,
        });
      } catch (error) {
        console.error('Error rejecting:', error);
      }
    }

    setSelectedIds(new Set());
    setBulkProcessing(false);
  };

  const handleApprove = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      await updateDoc(doc(firebaseDb, 'hitlRequests', requestId), {
        status: 'approved',
        resolvedAt: new Date(),
        resolvedBy: 'current_user', // Replace with actual user ID
      });
    } catch (error) {
      console.error('Error approving:', error);
    }
    setProcessingId(null);
  };

  const handleReject = async (requestId: string, notes: string) => {
    setProcessingId(requestId);
    try {
      await updateDoc(doc(firebaseDb, 'hitlRequests', requestId), {
        status: 'rejected',
        resolvedAt: new Date(),
        resolvedBy: 'current_user',
        notes,
      });
    } catch (error) {
      console.error('Error rejecting:', error);
    }
    setProcessingId(null);
  };

  const renderExtractedData = (category: string, data: any) => {
    if (!data || Object.keys(data).length === 0) {
      return (
        <div className="text-sm text-gray-500 italic p-3 bg-gray-50 rounded-lg">
          No extracted data available. The document may not have been processed yet or extraction failed.
        </div>
      );
    }

    switch (category) {
      case 'lease':
        return <LeaseDataDisplay data={data} />;
      case 'ppa':
        return <PPADataDisplay data={data} />;
      case 'easement':
        return <EasementDataDisplay data={data} />;
      default:
        return <GenericDataDisplay data={data} category={category} />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'lease':
        return <FileText className="w-5 h-5 text-blue-500" />;
      case 'ppa':
        return <Zap className="w-5 h-5 text-yellow-500" />;
      case 'easement':
        return <MapPin className="w-5 h-5 text-purple-500" />;
      default:
        return <FileCheck className="w-5 h-5 text-gray-500" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      lease: 'Land Lease',
      ppa: 'Power Purchase Agreement',
      easement: 'Easement Agreement',
      option: 'Option Agreement',
      title_report: 'Title Report',
      survey: 'Land Survey',
      interconnection_agreement: 'Interconnection Agreement',
      system_impact_study: 'System Impact Study',
      facility_study: 'Facility Study',
      cup_application: 'CUP Application',
      environmental_report: 'Environmental Report',
      unknown: 'Unknown Document Type',
    };
    return labels[category] || category.replace('_', ' ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        Error loading review queue: {error.message}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900">All caught up!</h3>
        <p className="text-gray-500 mt-1">No items pending review</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Review Queue</h2>
        <Badge variant="warning">{requests.length} pending</Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filters:</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Category:</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-sm border rounded-md px-2 py-1 bg-white"
          >
            <option value="all">All Categories</option>
            {categories.map((cat: string) => (
              <option key={cat} value={cat}>
                {getCategoryLabel(cat)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Urgency:</label>
          <select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
            className="text-sm border rounded-md px-2 py-1 bg-white"
          >
            <option value="all">All Urgencies</option>
            {urgencies.map((urg: string) => (
              <option key={urg} value={urg}>
                {urg.charAt(0).toUpperCase() + urg.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {filteredRequests.length !== requests.length && (
          <Badge variant="secondary" className="ml-auto">
            Showing {filteredRequests.length} of {requests.length}
          </Badge>
        )}
      </div>

      {/* Bulk Actions Toolbar */}
      <div className="flex items-center justify-between p-3 bg-white border rounded-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={selectAll}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            {selectedIds.size === filteredRequests.length && filteredRequests.length > 0 ? (
              <CheckSquare className="w-4 h-4 text-primary" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            Select All
          </button>
          {selectedIds.size > 0 && (
            <span className="text-sm text-gray-500">
              {selectedIds.size} selected
            </span>
          )}
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleBulkApprove}
              disabled={bulkProcessing}
            >
              {bulkProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-1" />
              )}
              Approve Selected
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBulkReject}
              disabled={bulkProcessing}
            >
              <XCircle className="w-4 h-4 mr-1" />
              Reject Selected
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4">
        {filteredRequests.map((request: any) => {
          const isExpanded = expandedId === request.id;
          const category = request.context?.category || 'unknown';
          const confidence = request.context?.confidence;

          const isSelected = selectedIds.has(request.id);

          return (
            <Card key={request.id} className={cn("overflow-hidden", isSelected && "ring-2 ring-primary")}>
              <CardHeader
                className="pb-2 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : request.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {/* Selection checkbox */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelection(request.id);
                      }}
                      className="flex-shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-primary" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                    {getCategoryIcon(category)}
                    <div>
                      <CardTitle className="text-base">{request.description}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {getCategoryLabel(category)}
                        </Badge>
                        {confidence !== undefined && (
                          <Badge
                            variant={confidence >= 0.9 ? 'success' : confidence >= 0.7 ? 'warning' : 'destructive'}
                            className="text-xs"
                          >
                            {Math.round(confidence * 100)}% confidence
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getUrgencyColor(request.urgency)}>
                      {request.urgency}
                    </Badge>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                {/* Time and type info */}
                <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatDate(request.createdAt?.toDate?.() || request.createdAt)}
                  </div>
                  <span className="capitalize">{request.requestType}</span>
                </div>

                {/* Review reasons - always visible */}
                {request.context?.reviewReasons?.length > 0 && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm font-medium text-amber-800 mb-2 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      Review Required:
                    </p>
                    <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                      {request.context.reviewReasons.map((reason: string, i: number) => (
                        <li key={i}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Extracted data - expanded view */}
                {isExpanded && (
                  <div className="mb-4 border-t pt-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Extracted Data</h4>
                    {renderExtractedData(category, request.context?.extractedData)}
                  </div>
                )}

                {/* Click to expand hint */}
                {!isExpanded && (
                  <p className="text-xs text-gray-400 mb-3">Click to view extracted data details</p>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApprove(request.id);
                    }}
                    disabled={processingId === request.id}
                    className="flex-1"
                  >
                    {processingId === request.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      const notes = prompt('Reason for rejection:');
                      if (notes) handleReject(request.id, notes);
                    }}
                    disabled={processingId === request.id}
                    className="flex-1"
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
