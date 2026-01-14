'use client';

import { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { firebaseDb, firebaseAuth } from '@/lib/firebase';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';

interface WorkflowStep {
  name: string;
  label: string;
  status: 'pending' | 'completed' | 'current' | 'paused' | 'failed';
}

interface Workflow {
  id: string;
  workflowType: string;
  status: string;
  currentNode: string;
  data: Record<string, any>;
  createdAt: any;
  updatedAt: any;
}

interface WorkflowStatusProps {
  projectId: string;
  onWorkflowStart?: (workflowType: string, workflowId: string) => void;
}

const WORKFLOW_DEFINITIONS: Record<string, { label: string; steps: { name: string; label: string }[] }> = {
  document_processing: {
    label: 'Document Processing',
    steps: [
      { name: 'classify', label: 'Classification' },
      { name: 'extract', label: 'Data Extraction' },
      { name: 'validate', label: 'Validation' },
      { name: 'hitl_gate', label: 'Human Review' },
      { name: 'complete', label: 'Complete' },
    ],
  },
  land_acquisition: {
    label: 'Land Acquisition',
    steps: [
      { name: 'site_analysis', label: 'Site Analysis' },
      { name: 'due_diligence', label: 'Due Diligence' },
      { name: 'lease_negotiation', label: 'Lease Negotiation' },
      { name: 'legal_review', label: 'Legal Review' },
      { name: 'execute_lease', label: 'Execute Lease' },
    ],
  },
  project_lifecycle: {
    label: 'Project Lifecycle',
    steps: [
      { name: 'prospecting', label: 'Prospecting' },
      { name: 'site_control', label: 'Site Control' },
      { name: 'development', label: 'Development' },
      { name: 'construction_ready', label: 'Construction Ready' },
    ],
  },
};

function WorkflowProgress({ workflow }: { workflow: Workflow }) {
  const definition = WORKFLOW_DEFINITIONS[workflow.workflowType];
  if (!definition) return null;

  const currentIndex = definition.steps.findIndex(s => s.name === workflow.currentNode);

  const getStepStatus = (index: number): 'pending' | 'completed' | 'current' | 'paused' | 'failed' => {
    if (workflow.status === 'failed') {
      if (index === currentIndex) return 'failed';
      if (index < currentIndex) return 'completed';
      return 'pending';
    }
    if (workflow.status === 'paused' && index === currentIndex) return 'paused';
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'current';
    return 'pending';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">{definition.label}</h4>
        <Badge
          variant={
            workflow.status === 'completed' ? 'success' :
            workflow.status === 'paused' ? 'warning' :
            workflow.status === 'failed' ? 'destructive' :
            workflow.status === 'running' ? 'info' : 'default'
          }
        >
          {workflow.status}
        </Badge>
      </div>

      <div className="relative">
        {/* Progress line */}
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200" />
        <div
          className="absolute top-4 left-4 h-0.5 bg-primary transition-all duration-500"
          style={{ width: `${Math.max(0, (currentIndex / (definition.steps.length - 1)) * 100)}%` }}
        />

        {/* Steps */}
        <div className="relative flex justify-between">
          {definition.steps.map((step, index) => {
            const status = getStepStatus(index);
            return (
              <div key={step.name} className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center border-2 bg-white z-10 transition-colors',
                    status === 'completed' && 'border-green-500 bg-green-500 text-white',
                    status === 'current' && 'border-primary bg-primary text-white',
                    status === 'paused' && 'border-yellow-500 bg-yellow-500 text-white',
                    status === 'failed' && 'border-red-500 bg-red-500 text-white',
                    status === 'pending' && 'border-gray-300 text-gray-400'
                  )}
                >
                  {status === 'completed' && <CheckCircle className="w-4 h-4" />}
                  {status === 'current' && <Loader2 className="w-4 h-4 animate-spin" />}
                  {status === 'paused' && <Pause className="w-4 h-4" />}
                  {status === 'failed' && <XCircle className="w-4 h-4" />}
                  {status === 'pending' && <span className="text-xs">{index + 1}</span>}
                </div>
                <span className={cn(
                  'text-xs mt-2 text-center max-w-[80px]',
                  status === 'current' || status === 'paused' ? 'font-medium text-gray-900' : 'text-gray-500'
                )}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Paused indicator */}
      {workflow.status === 'paused' && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">Waiting for Human Review</span>
          </div>
          <p className="text-sm text-yellow-700 mt-1">
            This workflow is paused at "{definition.steps[currentIndex]?.label}" pending approval.
            Check the Review Queue to continue.
          </p>
        </div>
      )}
    </div>
  );
}

export function WorkflowStatus({ projectId, onWorkflowStart }: WorkflowStatusProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    const user = firebaseAuth.currentUser;
    if (!user) return;

    const q = query(
      collection(firebaseDb, 'workflows'),
      where('tenantId', '==', user.uid),
      where('data.projectId', '==', projectId),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const workflowData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Workflow[];
      setWorkflows(workflowData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching workflows:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [projectId]);

  const handleStartWorkflow = async (workflowType: string) => {
    setStarting(workflowType);
    try {
      const functions = getFunctions();
      const startWorkflowFn = httpsCallable(functions, 'startWorkflow');
      const result = await startWorkflowFn({
        workflowType,
        input: { projectId },
      });

      const data = result.data as { success: boolean; data: { workflowId: string } };
      if (data.success && onWorkflowStart) {
        onWorkflowStart(workflowType, data.data.workflowId);
      }
    } catch (error) {
      console.error('Error starting workflow:', error);
    }
    setStarting(null);
  };

  const activeWorkflows = workflows.filter(w => w.status !== 'completed' && w.status !== 'failed');
  const completedWorkflows = workflows.filter(w => w.status === 'completed');

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
          <CardTitle>Workflows</CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStartWorkflow('land_acquisition')}
              disabled={starting !== null}
            >
              {starting === 'land_acquisition' ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Start Land Acquisition
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStartWorkflow('project_lifecycle')}
              disabled={starting !== null}
            >
              {starting === 'project_lifecycle' ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Start Lifecycle
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {workflows.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Workflows Started</h3>
            <p className="text-gray-500 mb-4">
              Start a workflow to automate project tasks and track progress.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active Workflows */}
            {activeWorkflows.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-3">Active Workflows</h4>
                <div className="space-y-4">
                  {activeWorkflows.map(workflow => (
                    <div key={workflow.id} className="p-4 bg-gray-50 rounded-lg">
                      <WorkflowProgress workflow={workflow} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completed Workflows */}
            {completedWorkflows.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-3">Completed Workflows</h4>
                <div className="space-y-2">
                  {completedWorkflows.map(workflow => (
                    <div key={workflow.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="font-medium">
                          {WORKFLOW_DEFINITIONS[workflow.workflowType]?.label || workflow.workflowType}
                        </span>
                      </div>
                      <Badge variant="success">Completed</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
