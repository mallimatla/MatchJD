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
  Workflow,
  DollarSign,
  FileSearch,
  BarChart3,
  Settings,
} from 'lucide-react';
import { useDocument, useDocuments, useParcels } from '@/hooks/useFirestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DocumentUpload } from '@/components/DocumentUpload';
import { ParcelsList } from '@/components/ParcelsList';
import { WorkflowStatus } from '@/components/WorkflowStatus';
import { SiteAnalysis } from '@/components/SiteAnalysis';
import { DueDiligenceDashboard } from '@/components/DueDiligenceDashboard';
import { FinancialSummary } from '@/components/FinancialSummary';
import { ProjectLifecycle } from '@/components/ProjectLifecycle';
import { cn, formatDate, getStatusColor, formatCurrency } from '@/lib/utils';
import type { Project, Document, Parcel } from '@/types';

type TabType = 'overview' | 'documents' | 'parcels' | 'workflows' | 'analysis' | 'dd' | 'financials' | 'upload';

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

  const [activeTab, setActiveTab] = useState<TabType>('overview');

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

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: <Settings className="w-4 h-4" /> },
    { id: 'documents' as const, label: `Documents (${documents.length})`, icon: <FileText className="w-4 h-4" /> },
    { id: 'parcels' as const, label: `Parcels (${parcels.length})`, icon: <MapPin className="w-4 h-4" /> },
    { id: 'workflows' as const, label: 'Workflows', icon: <Workflow className="w-4 h-4" /> },
    { id: 'analysis' as const, label: 'Site Analysis', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'dd' as const, label: 'Due Diligence', icon: <FileSearch className="w-4 h-4" /> },
    { id: 'financials' as const, label: 'Financials', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'upload' as const, label: 'Upload', icon: <Upload className="w-4 h-4" /> },
  ];

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

          {/* Quick Stats */}
          <div className="grid grid-cols-5 gap-4 mt-6">
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
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-500">Parcels/Docs</p>
              <p className="font-semibold">{parcels.length} / {documents.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'default' : 'ghost'}
              onClick={() => setActiveTab(tab.id)}
              className="whitespace-nowrap"
            >
              {tab.icon}
              <span className="ml-2">{tab.label}</span>
            </Button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Project Lifecycle */}
            <ProjectLifecycle
              projectId={projectId}
              currentStatus={project.status || 'prospecting'}
            />

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-6">
              {/* Recent Documents */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Recent Documents</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab('documents')}>
                      View All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {documents.length === 0 ? (
                    <p className="text-gray-500 text-sm">No documents yet</p>
                  ) : (
                    <div className="space-y-2">
                      {documents.slice(0, 3).map((doc: any) => (
                        <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center gap-2">
                            {getDocumentStatusIcon(doc.status)}
                            <span className="text-sm truncate max-w-[200px]">{doc.filename}</span>
                          </div>
                          <Badge className={cn('text-xs', getStatusColor(doc.status))}>
                            {doc.status?.replace('_', ' ')}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Parcels Summary */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Parcels Summary</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab('parcels')}>
                      View All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {parcels.length === 0 ? (
                    <p className="text-gray-500 text-sm">No parcels yet</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-blue-50 rounded-lg text-center">
                          <p className="text-2xl font-bold text-blue-700">{parcels.length}</p>
                          <p className="text-xs text-blue-600">Total Parcels</p>
                        </div>
                        <div className="p-3 bg-green-50 rounded-lg text-center">
                          <p className="text-2xl font-bold text-green-700">
                            {parcels.reduce((sum: number, p: any) => sum + (p.acres || 0), 0).toFixed(0)}
                          </p>
                          <p className="text-xs text-green-600">Total Acres</p>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {parcels.filter((p: any) => p.status === 'leased').length} leased, {' '}
                        {parcels.filter((p: any) => p.status === 'under_option').length} under option
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3 flex-wrap">
                  <Button variant="outline" onClick={() => setActiveTab('upload')}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Document
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab('parcels')}>
                    <MapPin className="w-4 h-4 mr-2" />
                    Add Parcel
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab('analysis')}>
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Run Site Analysis
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab('dd')}>
                    <FileSearch className="w-4 h-4 mr-2" />
                    Start Due Diligence
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab('workflows')}>
                    <Workflow className="w-4 h-4 mr-2" />
                    Start Workflow
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'documents' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Documents</CardTitle>
                <Button onClick={() => setActiveTab('upload')}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </Button>
              </div>
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
          <ParcelsList
            projectId={projectId}
            county={project.county}
            state={project.state}
          />
        )}

        {activeTab === 'workflows' && (
          <WorkflowStatus
            projectId={projectId}
            parcelsCount={parcels.length}
            documentsCount={documents.length}
          />
        )}

        {activeTab === 'analysis' && (
          <SiteAnalysis
            projectId={projectId}
            parcels={parcels as Parcel[]}
            projectRequirements={{
              requiredCapacityMw: project.capacityMwAc,
            }}
          />
        )}

        {activeTab === 'dd' && (
          <DueDiligenceDashboard projectId={projectId} />
        )}

        {activeTab === 'financials' && (
          <FinancialSummary project={project as any} />
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
