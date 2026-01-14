'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  FileText,
  MapPin,
  Upload,
  Loader2,
  CheckCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { useDocument, useDocuments, useParcels } from '@/hooks/useFirestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DocumentUpload } from '@/components/DocumentUpload';
import { cn, formatDate, getStatusColor, formatCurrency } from '@/lib/utils';
import type { Project, Document } from '@/types';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const { data: project, loading: projectLoading } = useDocument<Project>(
    'projects',
    projectId
  );
  const { data: documents, loading: documentsLoading } = useDocuments(projectId);
  const { data: parcels } = useParcels(projectId);

  const [activeTab, setActiveTab] = useState<'documents' | 'parcels' | 'upload'>('documents');

  if (projectLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Project not found</p>
      </div>
    );
  }

  const getDocumentStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'review_required':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Button
            variant="ghost"
            className="mb-4"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{project.name}</h1>
              <p className="text-gray-500 mt-1">
                {project.county}, {project.state}
              </p>
            </div>
            <Badge className={getStatusColor(project.status || 'prospecting')}>
              {project.status?.replace('_', ' ')}
            </Badge>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-500">Type</p>
              <p className="font-semibold capitalize">
                {project.projectType?.replace('_', ' ')}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-500">Capacity</p>
              <p className="font-semibold">{project.capacityMwAc} MW AC</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-500">Est. CAPEX</p>
              <p className="font-semibold">{formatCurrency(project.estimatedCapex || 0)}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-500">Target COD</p>
              <p className="font-semibold">{project.targetCod || 'TBD'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <Button
            variant={activeTab === 'documents' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('documents')}
          >
            <FileText className="w-4 h-4 mr-2" />
            Documents ({documents.length})
          </Button>
          <Button
            variant={activeTab === 'parcels' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('parcels')}
          >
            <MapPin className="w-4 h-4 mr-2" />
            Parcels ({parcels.length})
          </Button>
          <Button
            variant={activeTab === 'upload' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('upload')}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </Button>
        </div>

        {/* Tab Content */}
        {activeTab === 'documents' && (
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {documentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">No documents uploaded yet</p>
                  <Button
                    className="mt-4"
                    onClick={() => setActiveTab('upload')}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Documents
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc: any) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {getDocumentStatusIcon(doc.status)}
                        <div>
                          <p className="font-medium">{doc.filename}</p>
                          <p className="text-sm text-gray-500">
                            {doc.category || 'Unclassified'} &bull;{' '}
                            {formatDate(doc.createdAt?.toDate?.() || doc.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.confidence > 0 && (
                          <span className="text-sm text-gray-500">
                            {Math.round(doc.confidence * 100)}% confidence
                          </span>
                        )}
                        <Badge className={getStatusColor(doc.status)}>
                          {doc.status?.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'parcels' && (
          <Card>
            <CardHeader>
              <CardTitle>Parcels</CardTitle>
            </CardHeader>
            <CardContent>
              {parcels.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">No parcels added yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {parcels.map((parcel: any) => (
                    <div
                      key={parcel.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">APN: {parcel.apn}</p>
                        <p className="text-sm text-gray-500">
                          {parcel.acres} acres &bull; {parcel.zoning}
                        </p>
                      </div>
                      <Badge className={getStatusColor(parcel.status)}>
                        {parcel.status?.replace('_', ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'upload' && (
          <Card>
            <CardHeader>
              <CardTitle>Upload Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentUpload
                projectId={projectId}
                onUploadComplete={() => setActiveTab('documents')}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
