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
  Square,
  Check,
  X,
  Eye,
  EyeOff
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase';
import { useReviewQueue } from '@/hooks/useFirestore';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { cn, formatDate, getUrgencyColor, formatCurrency } from '@/lib/utils';
import type { HITLRequest } from '@/types';

// Compact data preview - shows key fields inline
function CompactDataPreview({ category, data }: { category: string; data: any }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <span className="text-gray-400 italic text-xs">No extracted data</span>
    );
  }

  const getKeyFields = () => {
    switch (category) {
      case 'lease':
        return [
          { label: 'Lessor', value: data.lessor?.name },
          { label: 'Lessee', value: data.lessee?.name },
          { label: 'Acres', value: data.totalAcres ? `${data.totalAcres} ac` : null },
          { label: 'Term', value: data.initialTermYears ? `${data.initialTermYears} yrs` : null },
          { label: 'Rent/Acre', value: data.rent?.baseRentPerAcre ? formatCurrency(data.rent.baseRentPerAcre) : null },
        ];
      case 'ppa':
        return [
          { label: 'Seller', value: data.seller?.name || data.seller },
          { label: 'Buyer', value: data.buyer?.name || data.buyer },
          { label: 'Capacity', value: data.contractCapacity ? `${data.contractCapacity} MW` : null },
          { label: 'Price', value: data.price?.contractPrice || data.contractPrice ? `$${data.price?.contractPrice || data.contractPrice}/MWh` : null },
          { label: 'Term', value: data.termYears || data.term ? `${data.termYears || data.term} yrs` : null },
        ];
      case 'easement':
        return [
          { label: 'Grantor', value: data.grantor?.name || data.grantor },
          { label: 'Grantee', value: data.grantee?.name || data.grantee },
          { label: 'Purpose', value: data.purpose },
          { label: 'Width', value: data.corridorWidth ? `${data.corridorWidth} ft` : null },
        ];
      default:
        const entries = Object.entries(data).slice(0, 4);
        return entries.map(([key, value]) => ({
          label: key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
          value: typeof value === 'string' || typeof value === 'number' ? value : null
        }));
    }
  };

  const fields = getKeyFields().filter(f => f.value);

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {fields.map((field, i) => (
        <span key={i} className="text-gray-600">
          <span className="text-gray-400">{field.label}:</span>{' '}
          <span className="font-medium text-gray-700">{field.value}</span>
        </span>
      ))}
    </div>
  );
}

// Full extracted data display for lease documents
function LeaseDataDisplay({ data }: { data: any }) {
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Parties */}
      <div className="p-3 bg-blue-50 rounded-lg">
        <div className="flex items-center gap-2 text-blue-700 font-medium text-sm mb-2">
          <User className="w-3.5 h-3.5" />
          Lessor (Landowner)
        </div>
        <p className="font-semibold text-sm">{data.lessor?.name || 'Not specified'}</p>
        {data.lessor?.entityType && (
          <p className="text-xs text-gray-600 capitalize">{data.lessor.entityType}</p>
        )}
      </div>
      <div className="p-3 bg-green-50 rounded-lg">
        <div className="flex items-center gap-2 text-green-700 font-medium text-sm mb-2">
          <Building className="w-3.5 h-3.5" />
          Lessee (Developer)
        </div>
        <p className="font-semibold text-sm">{data.lessee?.name || 'Not specified'}</p>
        {data.lessee?.entityType && (
          <p className="text-xs text-gray-600 capitalize">{data.lessee.entityType}</p>
        )}
      </div>

      {/* Property & Term */}
      <div className="p-3 bg-purple-50 rounded-lg">
        <div className="flex items-center gap-2 text-purple-700 font-medium text-sm mb-2">
          <MapPin className="w-3.5 h-3.5" />
          Property
        </div>
        <div className="text-xs space-y-1">
          <p><span className="text-gray-500">Location:</span> <span className="font-medium">{data.county && data.state ? `${data.county}, ${data.state}` : 'N/A'}</span></p>
          <p><span className="text-gray-500">Acres:</span> <span className="font-medium">{data.totalAcres || 'N/A'}</span></p>
          {data.parcelNumbers?.length > 0 && (
            <p><span className="text-gray-500">Parcels:</span> <span className="font-medium">{data.parcelNumbers.join(', ')}</span></p>
          )}
        </div>
      </div>
      <div className="p-3 bg-orange-50 rounded-lg">
        <div className="flex items-center gap-2 text-orange-700 font-medium text-sm mb-2">
          <Calendar className="w-3.5 h-3.5" />
          Term
        </div>
        <div className="text-xs space-y-1">
          <p><span className="text-gray-500">Initial:</span> <span className="font-medium">{data.initialTermYears ? `${data.initialTermYears} years` : 'N/A'}</span></p>
          <p><span className="text-gray-500">Start:</span> <span className="font-medium">{data.commencementDate || 'N/A'}</span></p>
          {data.extensionOptions?.length > 0 && (
            <p><span className="text-gray-500">Extensions:</span> <span className="font-medium">{data.extensionOptions.length} option(s)</span></p>
          )}
        </div>
      </div>

      {/* Financial */}
      <div className="p-3 bg-emerald-50 rounded-lg md:col-span-2">
        <div className="flex items-center gap-2 text-emerald-700 font-medium text-sm mb-2">
          <DollarSign className="w-3.5 h-3.5" />
          Financial Terms
        </div>
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-gray-500">Rent/Acre:</span>
            <p className="font-medium">{data.rent?.baseRentPerAcre ? formatCurrency(data.rent.baseRentPerAcre) : 'N/A'}</p>
          </div>
          <div>
            <span className="text-gray-500">Escalation:</span>
            <p className="font-medium">{data.rent?.annualEscalationPercent ? `${data.rent.annualEscalationPercent}%/yr` : 'N/A'}</p>
          </div>
          <div>
            <span className="text-gray-500">Signing Bonus:</span>
            <p className="font-medium">{data.rent?.signingBonus ? formatCurrency(data.rent.signingBonus) : 'None'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Full extracted data display for PPA documents
function PPADataDisplay({ data }: { data: any }) {
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Parties */}
      <div className="p-3 bg-blue-50 rounded-lg">
        <div className="flex items-center gap-2 text-blue-700 font-medium text-sm mb-2">
          <Zap className="w-3.5 h-3.5" />
          Seller
        </div>
        <p className="font-semibold text-sm">{data.seller?.name || data.seller || 'Not specified'}</p>
      </div>
      <div className="p-3 bg-green-50 rounded-lg">
        <div className="flex items-center gap-2 text-green-700 font-medium text-sm mb-2">
          <Building className="w-3.5 h-3.5" />
          Buyer
        </div>
        <p className="font-semibold text-sm">{data.buyer?.name || data.buyer || 'Not specified'}</p>
      </div>

      {/* Project & Pricing */}
      <div className="p-3 bg-purple-50 rounded-lg">
        <div className="flex items-center gap-2 text-purple-700 font-medium text-sm mb-2">
          <Zap className="w-3.5 h-3.5" />
          Project
        </div>
        <div className="text-xs space-y-1">
          <p><span className="text-gray-500">Name:</span> <span className="font-medium">{data.facilityName || data.projectName || 'N/A'}</span></p>
          <p><span className="text-gray-500">Capacity:</span> <span className="font-medium">{data.contractCapacity ? `${data.contractCapacity} MW AC` : 'N/A'}</span></p>
          <p><span className="text-gray-500">Annual Gen:</span> <span className="font-medium">{data.expectedAnnualGeneration ? `${data.expectedAnnualGeneration.toLocaleString()} MWh` : 'N/A'}</span></p>
        </div>
      </div>
      <div className="p-3 bg-emerald-50 rounded-lg">
        <div className="flex items-center gap-2 text-emerald-700 font-medium text-sm mb-2">
          <DollarSign className="w-3.5 h-3.5" />
          Pricing
        </div>
        <div className="text-xs space-y-1">
          <p><span className="text-gray-500">Price:</span> <span className="font-medium">{data.price?.contractPrice || data.contractPrice ? `$${data.price?.contractPrice || data.contractPrice}/MWh` : 'N/A'}</span></p>
          <p><span className="text-gray-500">Escalation:</span> <span className="font-medium">{data.price?.annualEscalation || data.annualEscalation ? `${data.price?.annualEscalation || data.annualEscalation}%/yr` : 'N/A'}</span></p>
          <p><span className="text-gray-500">Term:</span> <span className="font-medium">{data.termYears || data.term ? `${data.termYears || data.term} years` : 'N/A'}</span></p>
        </div>
      </div>

      {/* Key Dates */}
      <div className="p-3 bg-orange-50 rounded-lg md:col-span-2">
        <div className="flex items-center gap-2 text-orange-700 font-medium text-sm mb-2">
          <Calendar className="w-3.5 h-3.5" />
          Key Dates
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-gray-500">Expected COD:</span>
            <p className="font-medium">{data.expectedCommercialOperationDate || data.expectedCOD || 'N/A'}</p>
          </div>
          <div>
            <span className="text-gray-500">Guaranteed COD:</span>
            <p className="font-medium">{data.guaranteedCommercialOperationDate || data.guaranteedCOD || 'N/A'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Full extracted data display for easement documents
function EasementDataDisplay({ data }: { data: any }) {
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Parties */}
      <div className="p-3 bg-blue-50 rounded-lg">
        <div className="flex items-center gap-2 text-blue-700 font-medium text-sm mb-2">
          <User className="w-3.5 h-3.5" />
          Grantor
        </div>
        <p className="font-semibold text-sm">{data.grantor?.name || data.grantor || 'Not specified'}</p>
      </div>
      <div className="p-3 bg-green-50 rounded-lg">
        <div className="flex items-center gap-2 text-green-700 font-medium text-sm mb-2">
          <Building className="w-3.5 h-3.5" />
          Grantee
        </div>
        <p className="font-semibold text-sm">{data.grantee?.name || data.grantee || 'Not specified'}</p>
      </div>

      {/* Details & Compensation */}
      <div className="p-3 bg-purple-50 rounded-lg">
        <div className="flex items-center gap-2 text-purple-700 font-medium text-sm mb-2">
          <MapPin className="w-3.5 h-3.5" />
          Easement Details
        </div>
        <div className="text-xs space-y-1">
          <p><span className="text-gray-500">Purpose:</span> <span className="font-medium">{data.purpose || 'N/A'}</span></p>
          <p><span className="text-gray-500">Width:</span> <span className="font-medium">{data.corridorWidth || data.width ? `${data.corridorWidth || data.width} ft` : 'N/A'}</span></p>
          <p><span className="text-gray-500">Parcel:</span> <span className="font-medium">{data.parcelNumber || 'N/A'}</span></p>
        </div>
      </div>
      {(data.initialPayment || data.annualPayment) && (
        <div className="p-3 bg-emerald-50 rounded-lg">
          <div className="flex items-center gap-2 text-emerald-700 font-medium text-sm mb-2">
            <DollarSign className="w-3.5 h-3.5" />
            Compensation
          </div>
          <div className="text-xs space-y-1">
            <p><span className="text-gray-500">Initial:</span> <span className="font-medium">{data.initialPayment ? formatCurrency(data.initialPayment) : 'N/A'}</span></p>
            <p><span className="text-gray-500">Annual:</span> <span className="font-medium">{data.annualPayment ? formatCurrency(data.annualPayment) : 'N/A'}</span></p>
          </div>
        </div>
      )}
    </div>
  );
}

// Generic data display
function GenericDataDisplay({ data, category }: { data: any; category: string }) {
  if (!data || Object.keys(data).length === 0) return null;

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toLocaleString();
    if (Array.isArray(value)) return value.join(', ') || 'None';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const formatLabel = (key: string): string => {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).replace(/_/g, ' ');
  };

  const simpleFields = Object.entries(data).filter(([_, v]) =>
    typeof v !== 'object' || v === null || Array.isArray(v)
  );

  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-2 text-gray-700 font-medium text-sm mb-2">
        <FileCheck className="w-3.5 h-3.5" />
        {category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
        {simpleFields.slice(0, 9).map(([key, value]) => (
          <div key={key}>
            <span className="text-gray-500">{formatLabel(key)}:</span>
            <p className="font-medium truncate">{formatValue(value)}</p>
          </div>
        ))}
      </div>
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
  const categories = Array.from(new Set(requests.map((r: any) => r.context?.category || 'unknown')));
  const urgencies = Array.from(new Set(requests.map((r: any) => r.urgency || 'medium')));

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

    const ids = Array.from(selectedIds);
    for (let i = 0; i < ids.length; i++) {
      const requestId = ids[i];
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

    const ids = Array.from(selectedIds);
    for (let i = 0; i < ids.length; i++) {
      const requestId = ids[i];
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
        resolvedBy: 'current_user',
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
          No extracted data available.
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
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'ppa':
        return <Zap className="w-4 h-4 text-yellow-500" />;
      case 'easement':
        return <MapPin className="w-4 h-4 text-purple-500" />;
      default:
        return <FileCheck className="w-4 h-4 text-gray-500" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      lease: 'Land Lease',
      ppa: 'PPA',
      easement: 'Easement',
      option: 'Option',
      title_report: 'Title Report',
      survey: 'Survey',
      interconnection_agreement: 'Interconnection',
      system_impact_study: 'SIS',
      facility_study: 'Facility Study',
      cup_application: 'CUP',
      environmental_report: 'Environmental',
      unknown: 'Unknown',
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
      {/* Header with count */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Review Queue</h2>
        <Badge variant="warning">{requests.length} pending</Badge>
      </div>

      {/* Compact Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-white border rounded-lg">
        <Filter className="w-4 h-4 text-gray-400" />

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="text-sm border rounded px-2 py-1 bg-white"
        >
          <option value="all">All Types</option>
          {categories.map((cat: string) => (
            <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>
          ))}
        </select>

        <select
          value={urgencyFilter}
          onChange={(e) => setUrgencyFilter(e.target.value)}
          className="text-sm border rounded px-2 py-1 bg-white"
        >
          <option value="all">All Urgency</option>
          {urgencies.map((urg: string) => (
            <option key={urg} value={urg}>{urg.charAt(0).toUpperCase() + urg.slice(1)}</option>
          ))}
        </select>

        <div className="flex-1" />

        {/* Bulk selection */}
        <button
          onClick={selectAll}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
        >
          {selectedIds.size === filteredRequests.length && filteredRequests.length > 0 ? (
            <CheckSquare className="w-4 h-4 text-primary" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
        </button>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-1 border-l pl-3">
            <button
              onClick={handleBulkApprove}
              disabled={bulkProcessing}
              className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
              title="Approve selected"
            >
              {bulkProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
            <button
              onClick={handleBulkReject}
              disabled={bulkProcessing}
              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Reject selected"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {filteredRequests.length !== requests.length && (
          <Badge variant="secondary" className="text-xs">
            {filteredRequests.length}/{requests.length}
          </Badge>
        )}
      </div>

      {/* Request List */}
      <div className="space-y-3">
        {filteredRequests.map((request: any) => {
          const isExpanded = expandedId === request.id;
          const category = request.context?.category || 'unknown';
          const confidence = request.context?.confidence;
          const isSelected = selectedIds.has(request.id);
          const hasReviewReasons = request.context?.reviewReasons?.length > 0;

          return (
            <div
              key={request.id}
              className={cn(
                "bg-white border rounded-lg overflow-hidden transition-all",
                isSelected && "ring-2 ring-primary",
                isExpanded && "shadow-md"
              )}
            >
              {/* Main Row - Always Visible */}
              <div className="p-4">
                {/* Header Row */}
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleSelection(request.id)}
                    className="flex-shrink-0 mt-0.5"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-300 hover:text-gray-400" />
                    )}
                  </button>

                  {/* Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {getCategoryIcon(category)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Title Row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 text-sm truncate">
                          {request.description}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs px-1.5 py-0">
                            {getCategoryLabel(category)}
                          </Badge>
                          {confidence !== undefined && (
                            <Badge
                              variant={confidence >= 0.9 ? 'success' : confidence >= 0.7 ? 'warning' : 'destructive'}
                              className="text-xs px-1.5 py-0"
                            >
                              {Math.round(confidence * 100)}%
                            </Badge>
                          )}
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(request.createdAt?.toDate?.() || request.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Badge className={cn("text-xs", getUrgencyColor(request.urgency))}>
                          {request.urgency}
                        </Badge>
                        <button
                          onClick={() => handleApprove(request.id)}
                          disabled={processingId === request.id}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                          title="Approve"
                        >
                          {processingId === request.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            const notes = prompt('Reason for rejection:');
                            if (notes) handleReject(request.id, notes);
                          }}
                          disabled={processingId === request.id}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Reject"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : request.id)}
                          className="p-1.5 text-gray-400 hover:bg-gray-50 rounded transition-colors"
                          title={isExpanded ? "Collapse" : "Expand"}
                        >
                          {isExpanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Review Reasons - Always Visible if present */}
                    {hasReviewReasons && (
                      <div className="mt-2 p-2 bg-amber-50 border border-amber-100 rounded text-xs">
                        <span className="font-medium text-amber-700 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Review Required:
                        </span>
                        <span className="text-amber-600 ml-4">
                          {request.context.reviewReasons.join(' • ')}
                        </span>
                      </div>
                    )}

                    {/* Extracted Data Preview - Always Visible */}
                    <div className="mt-2 p-2 bg-gray-50 rounded">
                      <CompactDataPreview category={category} data={request.context?.extractedData} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Full Data View */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-0">
                  <div className="border-t pt-3">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Full Extracted Data
                    </h4>
                    {renderExtractedData(category, request.context?.extractedData)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
