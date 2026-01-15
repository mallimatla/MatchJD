'use client';

import { useState, useMemo } from 'react';
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
  Search,
  Filter,
  X,
  Grid3X3,
  List,
  ChevronDown,
  ArrowUpDown,
  SlidersHorizontal,
  Zap,
  Calendar,
  DollarSign,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProjects, useReviewQueue, useAllDocuments, useAllParcels } from '@/hooks/useFirestore';
import { useSystemConfig } from '@/hooks/useConfig';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ReviewQueue } from '@/components/ReviewQueue';
import { NotificationsPanel } from '@/components/NotificationsPanel';
import { cn, formatDate, getStatusColor, formatCurrency } from '@/lib/utils';
import type { Project } from '@/types';

type ViewMode = 'card' | 'table';
type SortField = 'name' | 'createdAt' | 'capacityMwAc' | 'estimatedCapex' | 'status';
type SortDirection = 'asc' | 'desc';

const PROJECT_STATUSES = [
  { value: 'prospecting', label: 'Prospecting' },
  { value: 'active', label: 'Active' },
  { value: 'under_development', label: 'Under Development' },
  { value: 'construction', label: 'Construction' },
  { value: 'operational', label: 'Operational' },
  { value: 'on_hold', label: 'On Hold' },
];

const PROJECT_TYPES = [
  { value: 'solar', label: 'Solar' },
  { value: 'wind', label: 'Wind' },
  { value: 'solar_storage', label: 'Solar + Storage' },
  { value: 'storage', label: 'Storage' },
];

const CAPACITY_RANGES = [
  { value: '0-50', label: '0-50 MW', min: 0, max: 50 },
  { value: '50-100', label: '50-100 MW', min: 50, max: 100 },
  { value: '100-250', label: '100-250 MW', min: 100, max: 250 },
  { value: '250+', label: '250+ MW', min: 250, max: Infinity },
];

export default function DashboardPage() {
  const { user, signOut, loading: authLoading } = useAuth();
  const { data: projects, loading: projectsLoading } = useProjects();
  const { data: reviewItems } = useReviewQueue();
  const { data: allDocuments } = useAllDocuments();
  const { data: allParcels } = useAllParcels();
  const { config: systemConfig } = useSystemConfig();
  const [activeTab, setActiveTab] = useState<'projects' | 'review'>('projects');
  const router = useRouter();

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedCapacityRanges, setSelectedCapacityRanges] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);

  // View and sort state
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Get unique states from projects
  const availableStates = useMemo(() => {
    const states = new Set(projects.map((p: any) => p.state).filter(Boolean));
    return Array.from(states).sort() as string[];
  }, [projects]);

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    let result = [...projects];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((p: any) =>
        p.name?.toLowerCase().includes(query) ||
        p.county?.toLowerCase().includes(query) ||
        p.state?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (selectedStatuses.length > 0) {
      result = result.filter((p: any) => selectedStatuses.includes(p.status));
    }

    // Type filter
    if (selectedTypes.length > 0) {
      result = result.filter((p: any) => selectedTypes.includes(p.projectType));
    }

    // Capacity filter
    if (selectedCapacityRanges.length > 0) {
      result = result.filter((p: any) => {
        const capacity = p.capacityMwAc || 0;
        return selectedCapacityRanges.some(rangeValue => {
          const range = CAPACITY_RANGES.find(r => r.value === rangeValue);
          return range && capacity >= range.min && capacity < range.max;
        });
      });
    }

    // State filter
    if (selectedStates.length > 0) {
      result = result.filter((p: any) => selectedStates.includes(p.state));
    }

    // Sort
    result.sort((a: any, b: any) => {
      let aVal: any, bVal: any;

      switch (sortField) {
        case 'name':
          aVal = a.name?.toLowerCase() || '';
          bVal = b.name?.toLowerCase() || '';
          break;
        case 'createdAt':
          aVal = a.createdAt?.toDate?.() || a.createdAt || 0;
          bVal = b.createdAt?.toDate?.() || b.createdAt || 0;
          break;
        case 'capacityMwAc':
          aVal = a.capacityMwAc || 0;
          bVal = b.capacityMwAc || 0;
          break;
        case 'estimatedCapex':
          aVal = a.estimatedCapex || 0;
          bVal = b.estimatedCapex || 0;
          break;
        case 'status':
          aVal = a.status || '';
          bVal = b.status || '';
          break;
        default:
          aVal = 0;
          bVal = 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [projects, searchQuery, selectedStatuses, selectedTypes, selectedCapacityRanges, selectedStates, sortField, sortDirection]);

  const activeFilterCount = selectedStatuses.length + selectedTypes.length + selectedCapacityRanges.length + selectedStates.length;

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedStatuses([]);
    setSelectedTypes([]);
    setSelectedCapacityRanges([]);
    setSelectedStates([]);
  };

  const toggleFilter = (value: string, selected: string[], setSelected: (v: string[]) => void) => {
    if (selected.includes(value)) {
      setSelected(selected.filter(v => v !== value));
    } else {
      setSelected([...selected, value]);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

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
              <span className="text-xl font-bold">{systemConfig.appName}</span>
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
            {/* Search and Controls Bar */}
            <div className="bg-white rounded-lg border p-4 mb-4">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search projects by name, county, or state..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Filter and View Controls */}
                <div className="flex items-center gap-2">
                  {/* Filter Toggle */}
                  <Button
                    variant={showFilters ? 'default' : 'outline'}
                    onClick={() => setShowFilters(!showFilters)}
                    className="relative"
                  >
                    <SlidersHorizontal className="w-4 h-4 mr-2" />
                    Filters
                    {activeFilterCount > 0 && (
                      <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>

                  {/* Sort Dropdown */}
                  <div className="relative group">
                    <Button variant="outline">
                      <ArrowUpDown className="w-4 h-4 mr-2" />
                      Sort
                      <ChevronDown className="w-4 h-4 ml-2" />
                    </Button>
                    <div className="absolute right-0 mt-1 w-48 bg-white border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                      <div className="p-1">
                        {[
                          { field: 'createdAt' as SortField, label: 'Date Created' },
                          { field: 'name' as SortField, label: 'Name' },
                          { field: 'capacityMwAc' as SortField, label: 'Capacity' },
                          { field: 'estimatedCapex' as SortField, label: 'Est. CAPEX' },
                          { field: 'status' as SortField, label: 'Status' },
                        ].map(({ field, label }) => (
                          <button
                            key={field}
                            onClick={() => handleSort(field)}
                            className={cn(
                              'w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 flex items-center justify-between',
                              sortField === field && 'bg-gray-50 font-medium'
                            )}
                          >
                            {label}
                            {sortField === field && (
                              <span className="text-xs text-gray-500">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* View Mode Toggle */}
                  <div className="flex border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setViewMode('card')}
                      className={cn(
                        'p-2 transition-colors',
                        viewMode === 'card' ? 'bg-primary text-white' : 'bg-white hover:bg-gray-50'
                      )}
                      title="Card View"
                    >
                      <Grid3X3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('table')}
                      className={cn(
                        'p-2 transition-colors border-l',
                        viewMode === 'table' ? 'bg-primary text-white' : 'bg-white hover:bg-gray-50'
                      )}
                      title="Table View"
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>

                  {/* New Project Button */}
                  <Button onClick={() => router.push('/projects/new')}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Project
                  </Button>
                </div>
              </div>

              {/* Expanded Filters */}
              {showFilters && (
                <div className="mt-4 pt-4 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Status Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                      <div className="space-y-1">
                        {PROJECT_STATUSES.map(status => (
                          <label key={status.value} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedStatuses.includes(status.value)}
                              onChange={() => toggleFilter(status.value, selectedStatuses, setSelectedStatuses)}
                              className="rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <span className="text-sm">{status.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Type Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Project Type</label>
                      <div className="space-y-1">
                        {PROJECT_TYPES.map(type => (
                          <label key={type.value} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedTypes.includes(type.value)}
                              onChange={() => toggleFilter(type.value, selectedTypes, setSelectedTypes)}
                              className="rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <span className="text-sm">{type.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Capacity Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Capacity</label>
                      <div className="space-y-1">
                        {CAPACITY_RANGES.map(range => (
                          <label key={range.value} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedCapacityRanges.includes(range.value)}
                              onChange={() => toggleFilter(range.value, selectedCapacityRanges, setSelectedCapacityRanges)}
                              className="rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <span className="text-sm">{range.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* State Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {availableStates.length === 0 ? (
                          <p className="text-sm text-gray-500">No states available</p>
                        ) : (
                          availableStates.map(state => (
                            <label key={state} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedStates.includes(state)}
                                onChange={() => toggleFilter(state, selectedStates, setSelectedStates)}
                                className="rounded border-gray-300 text-primary focus:ring-primary"
                              />
                              <span className="text-sm">{state}</span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Clear Filters */}
                  {activeFilterCount > 0 && (
                    <div className="mt-4 pt-4 border-t flex items-center justify-between">
                      <p className="text-sm text-gray-600">
                        {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
                      </p>
                      <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                        <X className="w-4 h-4 mr-1" />
                        Clear all filters
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Results Count */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">
                Showing {filteredProjects.length} of {projects.length} project{projects.length !== 1 ? 's' : ''}
                {searchQuery && ` matching "${searchQuery}"`}
              </p>
            </div>

            {/* Project List */}
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
            ) : filteredProjects.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Search className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No matching projects
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Try adjusting your search or filters
                  </p>
                  <Button variant="outline" onClick={clearAllFilters}>
                    Clear all filters
                  </Button>
                </CardContent>
              </Card>
            ) : viewMode === 'card' ? (
              /* Card View */
              <div className="grid gap-4">
                {filteredProjects.map((project: any) => (
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
                      <div className="grid grid-cols-4 gap-4 mt-4 text-sm">
                        <div>
                          <p className="text-gray-500">Type</p>
                          <p className="font-medium capitalize">{project.projectType?.replace('_', ' ') || 'Solar'}</p>
                        </div>
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
            ) : (
              /* Table View */
              <div className="bg-white rounded-lg border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th
                        className="text-left px-4 py-3 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center gap-1">
                          Project Name
                          {sortField === 'name' && (
                            <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                        Location
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                        Type
                      </th>
                      <th
                        className="text-left px-4 py-3 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('capacityMwAc')}
                      >
                        <div className="flex items-center gap-1">
                          Capacity
                          {sortField === 'capacityMwAc' && (
                            <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th
                        className="text-left px-4 py-3 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('estimatedCapex')}
                      >
                        <div className="flex items-center gap-1">
                          Est. CAPEX
                          {sortField === 'estimatedCapex' && (
                            <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                        Target COD
                      </th>
                      <th
                        className="text-left px-4 py-3 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center gap-1">
                          Status
                          {sortField === 'status' && (
                            <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredProjects.map((project: any) => (
                      <tr
                        key={project.id}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => router.push(`/projects/${project.id}`)}
                      >
                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-900">{project.name}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {project.county}, {project.state}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                          {project.projectType?.replace('_', ' ') || 'Solar'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {project.capacityMwAc || 0} MW
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatCurrency(project.estimatedCapex || 0)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {project.targetCod || 'TBD'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={cn('text-xs', getStatusColor(project.status))}>
                            {project.status?.replace('_', ' ')}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
