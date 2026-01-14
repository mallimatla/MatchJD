'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle, FileText, Loader2 } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase';
import { useReviewQueue } from '@/hooks/useFirestore';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { cn, formatDate, getUrgencyColor } from '@/lib/utils';
import type { HITLRequest } from '@/types';

export function ReviewQueue() {
  const { data: requests, loading, error } = useReviewQueue();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<HITLRequest | null>(null);

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

      <div className="grid gap-4">
        {requests.map((request: any) => (
          <Card
            key={request.id}
            className={cn(
              'cursor-pointer transition-shadow hover:shadow-md',
              selectedRequest?.id === request.id && 'ring-2 ring-primary'
            )}
            onClick={() => setSelectedRequest(request)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {request.requestType === 'review' ? (
                    <FileText className="w-5 h-5 text-blue-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                  )}
                  <CardTitle className="text-base">{request.description}</CardTitle>
                </div>
                <Badge className={getUrgencyColor(request.urgency)}>
                  {request.urgency}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatDate(request.createdAt?.toDate?.() || request.createdAt)}
                </div>
                <span className="capitalize">{request.requestType}</span>
              </div>

              {/* Context preview */}
              {request.context?.extractedData && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm">
                  <p className="font-medium text-gray-700 mb-1">Extracted Data Preview:</p>
                  <pre className="text-xs text-gray-600 overflow-hidden max-h-20">
                    {JSON.stringify(request.context.extractedData, null, 2).slice(0, 200)}...
                  </pre>
                </div>
              )}

              {/* Review reasons */}
              {request.context?.reviewReasons?.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-gray-700 mb-1">Review Reasons:</p>
                  <ul className="list-disc list-inside text-sm text-gray-600">
                    {request.context.reviewReasons.map((reason: string, i: number) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 mt-4">
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
        ))}
      </div>
    </div>
  );
}
