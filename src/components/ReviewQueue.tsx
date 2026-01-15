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
import { DocumentDataDisplay, CompactDocumentPreview, useAllDocumentDisplayConfigs } from './DocumentDataDisplay';

export function ReviewQueue() {
  const { data: requests, loading, error } = useReviewQueue();
  const { getCategoryLabel } = useAllDocumentDisplayConfigs();
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

  // Dynamic document data display using admin config
  const renderExtractedData = (category: string, data: any) => {
    return <DocumentDataDisplay category={category} data={data} variant="full" />;
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

  // getCategoryLabel is now from useAllDocumentDisplayConfigs hook - dynamic from admin config

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

                    {/* Extracted Data Preview - Always Visible - Uses dynamic config */}
                    <div className="mt-2 p-2 bg-gray-50 rounded">
                      <CompactDocumentPreview category={category} data={request.context?.extractedData} />
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
