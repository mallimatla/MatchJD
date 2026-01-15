'use client';

import { useState, useEffect } from 'react';
import {
  FileSearch,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Plus,
  Loader2,
  ChevronDown,
  ChevronUp,
  Calendar,
  User,
  FileText,
} from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { firebaseDb, firebaseAuth } from '@/lib/firebase';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { cn, formatDate } from '@/lib/utils';

interface DDWorkstream {
  id: string;
  projectId: string;
  tenantId: string;
  name: string;
  category: 'legal' | 'environmental' | 'technical' | 'financial' | 'permitting' | 'interconnection';
  status: 'not_started' | 'in_progress' | 'blocked' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignee?: string;
  dueDate?: Date;
  notes?: string;
  checklist: Array<{
    id: string;
    item: string;
    completed: boolean;
    completedAt?: Date;
  }>;
  issues: Array<{
    id: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    resolved: boolean;
    resolvedAt?: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

interface DueDiligenceDashboardProps {
  projectId: string;
}

const DD_TEMPLATES: Record<string, { name: string; category: DDWorkstream['category']; checklist: string[] }> = {
  title_review: {
    name: 'Title Review',
    category: 'legal',
    checklist: [
      'Order title commitment',
      'Review title exceptions',
      'Identify required curative items',
      'Clear title objections',
      'Obtain final title policy',
    ],
  },
  environmental_review: {
    name: 'Environmental Review',
    category: 'environmental',
    checklist: [
      'Phase I ESA ordered',
      'Phase I ESA completed',
      'Wetland delineation (if needed)',
      'Endangered species review',
      'Cultural resources review',
      'NEPA compliance (if applicable)',
    ],
  },
  survey: {
    name: 'Survey',
    category: 'technical',
    checklist: [
      'ALTA survey ordered',
      'Boundary survey completed',
      'Easements identified',
      'Encroachments noted',
      'Final survey certified',
    ],
  },
  permitting: {
    name: 'Permitting',
    category: 'permitting',
    checklist: [
      'Identify required permits',
      'Pre-application meeting',
      'CUP application submitted',
      'Public hearing scheduled',
      'CUP approved',
      'Building permits obtained',
    ],
  },
  interconnection: {
    name: 'Interconnection',
    category: 'interconnection',
    checklist: [
      'Interconnection application submitted',
      'System impact study initiated',
      'System impact study completed',
      'Facility study initiated',
      'Facility study completed',
      'Interconnection agreement executed',
    ],
  },
  financial_analysis: {
    name: 'Financial Analysis',
    category: 'financial',
    checklist: [
      'Pro forma model developed',
      'Tax equity structure confirmed',
      'PPA pricing validated',
      'Insurance requirements reviewed',
      'Financial close checklist prepared',
    ],
  },
};

const CATEGORY_COLORS: Record<DDWorkstream['category'], string> = {
  legal: 'bg-blue-100 text-blue-800',
  environmental: 'bg-green-100 text-green-800',
  technical: 'bg-purple-100 text-purple-800',
  financial: 'bg-emerald-100 text-emerald-800',
  permitting: 'bg-orange-100 text-orange-800',
  interconnection: 'bg-yellow-100 text-yellow-800',
};

const STATUS_COLORS: Record<DDWorkstream['status'], string> = {
  not_started: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  blocked: 'bg-red-100 text-red-800',
  completed: 'bg-green-100 text-green-800',
};

function WorkstreamCard({
  workstream,
  onUpdate,
}: {
  workstream: DDWorkstream;
  onUpdate: (updates: Partial<DDWorkstream>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const completedItems = workstream.checklist.filter(c => c.completed).length;
  const progress = workstream.checklist.length > 0
    ? Math.round((completedItems / workstream.checklist.length) * 100)
    : 0;

  const handleChecklistToggle = (itemId: string) => {
    const updatedChecklist = workstream.checklist.map(item =>
      item.id === itemId
        ? { ...item, completed: !item.completed, completedAt: !item.completed ? new Date() : undefined }
        : item
    );
    onUpdate({ checklist: updatedChecklist });
  };

  const handleStatusChange = (status: DDWorkstream['status']) => {
    onUpdate({ status });
  };

  return (
    <div className="border rounded-lg p-4 hover:border-primary transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold">{workstream.name}</span>
            <Badge className={CATEGORY_COLORS[workstream.category]}>
              {workstream.category}
            </Badge>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  progress === 100 ? 'bg-green-500' :
                  progress >= 50 ? 'bg-blue-500' : 'bg-gray-400'
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm text-gray-500 w-16 text-right">
              {completedItems}/{workstream.checklist.length}
            </span>
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-4 text-sm text-gray-500">
            {workstream.assignee && (
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {workstream.assignee}
              </div>
            )}
            {workstream.dueDate && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(workstream.dueDate)}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status selector */}
          <select
            value={workstream.status}
            onChange={(e) => handleStatusChange(e.target.value as DDWorkstream['status'])}
            className={cn(
              'text-xs px-2 py-1 rounded border-0 cursor-pointer',
              STATUS_COLORS[workstream.status]
            )}
          >
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="completed">Completed</option>
          </select>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-4 pt-4 border-t space-y-4">
          {/* Checklist */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Checklist</h4>
            <div className="space-y-2">
              {workstream.checklist.map(item => (
                <label
                  key={item.id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                >
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => handleChecklistToggle(item.id)}
                    className="rounded border-gray-300"
                  />
                  <span className={cn(
                    'text-sm',
                    item.completed && 'line-through text-gray-400'
                  )}>
                    {item.item}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Issues */}
          {workstream.issues.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Issues</h4>
              <div className="space-y-2">
                {workstream.issues.map(issue => (
                  <div
                    key={issue.id}
                    className={cn(
                      'p-2 rounded text-sm',
                      issue.resolved ? 'bg-gray-50 text-gray-500' :
                      issue.severity === 'high' ? 'bg-red-50 text-red-800' :
                      issue.severity === 'medium' ? 'bg-yellow-50 text-yellow-800' :
                      'bg-blue-50 text-blue-800'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {issue.resolved ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="w-4 h-4" />
                      )}
                      <span className={issue.resolved ? 'line-through' : ''}>
                        {issue.description}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {workstream.notes && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Notes</h4>
              <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                {workstream.notes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DueDiligenceDashboard({ projectId }: DueDiligenceDashboardProps) {
  const [workstreams, setWorkstreams] = useState<DDWorkstream[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const user = firebaseAuth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    // Simple query without orderBy to avoid index requirement
    const q = query(
      collection(firebaseDb, 'ddWorkstreams'),
      where('projectId', '==', projectId),
      where('tenantId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as DDWorkstream[];
      // Sort client-side instead
      data.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || a.createdAt || 0;
        const bTime = b.createdAt?.toDate?.() || b.createdAt || 0;
        return new Date(aTime).getTime() - new Date(bTime).getTime();
      });
      setWorkstreams(data);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching DD workstreams:', error);
      alert('Error loading workstreams: ' + error.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [projectId]);

  const handleAddWorkstream = async (templateKey: string) => {
    const user = firebaseAuth.currentUser;
    if (!user) {
      alert('Please log in to add workstreams');
      return;
    }

    setAdding(true);
    try {
      const template = DD_TEMPLATES[templateKey];
      console.log('Adding workstream:', template.name, 'for project:', projectId);

      const docRef = await addDoc(collection(firebaseDb, 'ddWorkstreams'), {
        projectId,
        tenantId: user.uid,
        name: template.name,
        category: template.category,
        status: 'not_started',
        priority: 'medium',
        checklist: template.checklist.map((item, index) => ({
          id: `${templateKey}-${index}`,
          item,
          completed: false,
        })),
        issues: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      console.log('Workstream added with ID:', docRef.id);
      setShowAddMenu(false);
    } catch (error: any) {
      console.error('Error adding workstream:', error);
      alert('Error adding workstream: ' + error.message);
    }
    setAdding(false);
  };

  const handleUpdateWorkstream = async (workstreamId: string, updates: Partial<DDWorkstream>) => {
    try {
      await updateDoc(doc(firebaseDb, 'ddWorkstreams', workstreamId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating workstream:', error);
    }
  };

  // Calculate summary stats
  const totalItems = workstreams.reduce((sum, w) => sum + w.checklist.length, 0);
  const completedItems = workstreams.reduce(
    (sum, w) => sum + w.checklist.filter(c => c.completed).length,
    0
  );
  const blockedCount = workstreams.filter(w => w.status === 'blocked').length;
  const openIssues = workstreams.reduce(
    (sum, w) => sum + w.issues.filter(i => !i.resolved).length,
    0
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileSearch className="w-5 h-5" />
            Due Diligence
          </CardTitle>
          <div className="relative">
            <Button onClick={() => setShowAddMenu(!showAddMenu)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Workstream
            </Button>

            {showAddMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white border rounded-lg shadow-lg z-10">
                <div className="p-2">
                  <p className="text-xs text-gray-500 px-2 py-1">Select a template:</p>
                  {Object.entries(DD_TEMPLATES).map(([key, template]) => (
                    <button
                      key={key}
                      onClick={() => handleAddWorkstream(key)}
                      disabled={adding || workstreams.some(w => w.name === template.name)}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 flex items-center gap-2',
                        workstreams.some(w => w.name === template.name) && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <Badge className={cn('text-xs', CATEGORY_COLORS[template.category])}>
                        {template.category}
                      </Badge>
                      {template.name}
                      {workstreams.some(w => w.name === template.name) && (
                        <CheckCircle className="w-3 h-3 text-green-500 ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="p-3 bg-blue-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-700">{workstreams.length}</p>
            <p className="text-xs text-blue-600">Workstreams</p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-green-700">
              {totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0}%
            </p>
            <p className="text-xs text-green-600">Complete</p>
          </div>
          <div className="p-3 bg-red-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-red-700">{blockedCount}</p>
            <p className="text-xs text-red-600">Blocked</p>
          </div>
          <div className="p-3 bg-yellow-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-yellow-700">{openIssues}</p>
            <p className="text-xs text-yellow-600">Open Issues</p>
          </div>
        </div>

        {workstreams.length === 0 ? (
          <div className="text-center py-8">
            <FileSearch className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Due Diligence Items</h3>
            <p className="text-gray-500 mb-4">
              Add workstreams to track due diligence progress for this project.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {workstreams.map(workstream => (
              <WorkstreamCard
                key={workstream.id}
                workstream={workstream}
                onUpdate={(updates) => handleUpdateWorkstream(workstream.id, updates)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
