'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sun,
  Plus,
  FileText,
  MapPin,
  AlertCircle,
  LogOut,
  Loader2,
  FolderOpen,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProjects, useReviewQueue, useAllDocuments, useAllParcels } from '@/hooks/useFirestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ReviewQueue } from '@/components/ReviewQueue';
import { NotificationsPanel } from '@/components/NotificationsPanel';
import { cn, formatDate, getStatusColor, formatCurrency } from '@/lib/utils';
import type { Project } from '@/types';

export default function DashboardPage() {
  const { user, signOut, loading: authLoading } = useAuth();
  const { data: projects, loading: projectsLoading } = useProjects();
  const { data: reviewItems } = useReviewQueue();
  const { data: allDocuments } = useAllDocuments();
  const { data: allParcels } = useAllParcels();
  const [activeTab, setActiveTab] = useState<'projects' | 'review'>('projects');
  const router = useRouter();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Sun className="w-8 h-8 text-primary" />
              <span className="text-xl font-bold">Neurogrid</span>
            </div>
            <div className="flex items-center gap-4">
              <NotificationsPanel onNavigate={(url) => router.push(url)} />
              <span className="text-sm text-gray-600">{user.email}</span>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FolderOpen className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Projects</p>
                  <p className="text-2xl font-bold">{projects.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <FileText className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Documents</p>
                  <p className="text-2xl font-bold">{allDocuments.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <MapPin className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Parcels</p>
                  <p className="text-2xl font-bold">{allParcels.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pending Review</p>
                  <p className="text-2xl font-bold">{reviewItems.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <Button
            variant={activeTab === 'projects' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('projects')}
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            Projects
          </Button>
          <Button
            variant={activeTab === 'review' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('review')}
          >
            <AlertCircle className="w-4 h-4 mr-2" />
            Review Queue
            {reviewItems.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {reviewItems.length}
              </Badge>
            )}
          </Button>
        </div>

        {/* Tab Content */}
        {activeTab === 'projects' ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Projects</h2>
              <Button onClick={() => router.push('/projects/new')}>
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </div>

            {projectsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : projects.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FolderOpen className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No projects yet
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Get started by creating your first solar project
                  </p>
                  <Button onClick={() => router.push('/projects/new')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Project
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {projects.map((project: any) => (
                  <Card
                    key={project.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => router.push(`/projects/${project.id}`)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">{project.name}</h3>
                          <p className="text-gray-500 text-sm mt-1">
                            {project.county}, {project.state}
                          </p>
                        </div>
                        <Badge className={getStatusColor(project.status)}>
                          {project.status?.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                        <div>
                          <p className="text-gray-500">Capacity</p>
                          <p className="font-medium">{project.capacityMwAc || 0} MW AC</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Est. CAPEX</p>
                          <p className="font-medium">
                            {formatCurrency(project.estimatedCapex || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Target COD</p>
                          <p className="font-medium">{project.targetCod || 'TBD'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          <ReviewQueue />
        )}
      </main>
    </div>
  );
}
