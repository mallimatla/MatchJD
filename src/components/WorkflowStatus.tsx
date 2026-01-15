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
  MapPin,
  FileText,
  Scale,
  Building,
  Zap,
  ChevronDown,
  ChevronUp,
  Info,
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
  description: string;
  status: 'pending' | 'completed' | 'current' | 'paused' | 'failed';
}

interface Workflow {
  id: string;
  workflowType: string;
  status: string;
  currentNode: string;
  data: Record<string, any>;
  history: Array<{ node: string; timestamp: any; data: any }>;
  createdAt: any;
  updatedAt: any;
}

interface WorkflowStatusProps {
  projectId: string;
  onWorkflowStart?: (workflowType: string, workflowId: string) => void;
}

const WORKFLOW_DEFINITIONS: Record<string, {
  label: string;
  description: string;
  icon: React.ReactNode;
  steps: { name: string; label: string; description: string }[];
}> = {
  document_processing: {
    label: 'Document Processing',
    description: 'AI-powered extraction and classification of legal documents',
    icon: <FileText className="w-5 h-5" />,
    steps: [
      { name: 'classify', label: 'Classification', description: 'AI classifies document type (lease, PPA, easement, etc.)' },
      { name: 'extract', label: 'Data Extraction', description: 'Extract structured data from document text' },
      { name: 'validate', label: 'Validation', description: 'Validate extraction quality and completeness' },
      { name: 'hitl_gate', label: 'Human Review', description: 'Human review for legal documents or low confidence' },
      { name: 'complete', label: 'Complete', description: 'Document processed and data stored' },
    ],
  },
  land_acquisition: {
    label: 'Land Acquisition',
    description: 'Complete land acquisition process from site analysis to lease execution',
    icon: <MapPin className="w-5 h-5" />,
    steps: [
      { name: 'site_analysis', label: 'Site Analysis', description: 'AI evaluates each parcel for solar suitability (zoning, environmental, grid proximity)' },
      { name: 'due_diligence', label: 'Due Diligence', description: 'Initialize DD workstreams (title, environmental, survey, permits)' },
      { name: 'lease_negotiation', label: 'Lease Negotiation', description: 'AI recommends lease terms based on market analysis' },
      { name: 'legal_review', label: 'Legal Review', description: 'Attorney review required before lease execution' },
      { name: 'execute_lease', label: 'Execute Lease', description: 'Finalize lease and update parcel status' },
    ],
  },
  project_lifecycle: {
    label: 'Project Lifecycle',
    description: 'Manage project through development milestones to construction',
    icon: <Building className="w-5 h-5" />,
    steps: [
      { name: 'prospecting', label: 'Prospecting', description: 'Initial site identification and assessment' },
      { name: 'site_control', label: 'Site Control', description: 'Secure land rights through lease or option' },
      { name: 'development', label: 'Development', description: 'Interconnection, permits, engineering, PPA' },
      { name: 'construction_ready', label: 'Construction Ready', description: 'Final approval gate - NTP authorization required' },
    ],
  },
};

function WorkflowProgress({ workflow, expanded, onToggle }: {
  workflow: Workflow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const definition = WORKFLOW_DEFINITIONS[workflow.workflowType];
  if (!definition) return null;

  const currentIndex = definition.steps.findIndex(s => s.name === workflow.currentNode);

  const getStepStatus = (index: number): 'pending' | 'completed' | 'current' | 'paused' | 'failed' => {
    if (workflow.status === 'failed') {
      if (index === currentIndex) return 'failed';
      if (index < currentIndex) return 'completed';
      return 'pending';
    }
    if (workflow.status === 'completed') {
      return 'completed';
    }
    if (workflow.status === 'paused' && index === currentIndex) return 'paused';
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'current';
    return 'pending';
  };

  // Get data from workflow for current step
  const getCurrentStepData = () => {
    const data = workflow.data;
    if (!data) return null;

    switch (workflow.currentNode) {
      case 'site_analysis':
        return data.siteAnalysis;
      case 'due_diligence':
        return { ddStatus: data.ddStatus, workstreams: data.ddWorkstreams };
      case 'lease_negotiation':
        return data.leaseTerms;
      case 'legal_review':
        return { leaseTerms: data.leaseTerms, siteAnalysis: data.siteAnalysis };
      default:
        return data.phase ? { phase: data.phase } : null;
    }
  };

  const stepData = getCurrentStepData();

  return (
    <div className="space-y-4">
      {/* Header with expand toggle */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            workflow.status === 'completed' ? 'bg-green-100 text-green-600' :
            workflow.status === 'paused' ? 'bg-yellow-100 text-yellow-600' :
            workflow.status === 'failed' ? 'bg-red-100 text-red-600' :
            'bg-blue-100 text-blue-600'
          )}>
            {definition.icon}
          </div>
          <div>
            <h4 className="font-medium">{definition.label}</h4>
            <p className="text-sm text-gray-500">{definition.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative">
        {/* Progress line */}
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200" />
        <div
          className={cn(
            "absolute top-4 left-4 h-0.5 transition-all duration-500",
            workflow.status === 'completed' ? 'bg-green-500' :
            workflow.status === 'failed' ? 'bg-red-500' :
            'bg-primary'
          )}
          style={{
            width: workflow.status === 'completed'
              ? '100%'
              : `${Math.max(0, (currentIndex / (definition.steps.length - 1)) * 100)}%`
          }}
        />

        {/* Steps */}
        <div className="relative flex justify-between">
          {definition.steps.map((step, index) => {
            const status = getStepStatus(index);
            return (
              <div key={step.name} className="flex flex-col items-center" style={{ width: `${100 / definition.steps.length}%` }}>
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
                  'text-xs mt-2 text-center px-1',
                  status === 'current' || status === 'paused' ? 'font-medium text-gray-900' : 'text-gray-500'
                )}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Current step details */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Current Step: {definition.steps[currentIndex]?.label || 'Complete'}
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  {definition.steps[currentIndex]?.description || 'Workflow completed successfully'}
                </p>
              </div>
            </div>
          </div>

          {/* Step data if available */}
          {stepData && Object.keys(stepData).length > 0 && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <h5 className="text-sm font-medium text-gray-700 mb-2">Step Output</h5>
              <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-48">
                {JSON.stringify(stepData, null, 2)}
              </pre>
            </div>
          )}

          {/* History timeline */}
          {workflow.history && workflow.history.length > 0 && (
            <div className="border-t pt-4">
              <h5 className="text-sm font-medium text-gray-700 mb-3">Execution History</h5>
              <div className="space-y-2">
                {workflow.history.map((entry, index) => (
                  <div key={index} className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="font-medium">
                      {definition.steps.find(s => s.name === entry.node)?.label || entry.node}
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-500">
                      {entry.timestamp?.toDate ?
                        entry.timestamp.toDate().toLocaleString() :
                        new Date(entry.timestamp).toLocaleString()
                      }
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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

function WorkflowInfoCard({ type, onStart, starting }: {
  type: string;
  onStart: () => void;
  starting: boolean;
}) {
  const definition = WORKFLOW_DEFINITIONS[type];
  if (!definition) return null;

  return (
    <div className="p-4 border rounded-lg hover:border-primary transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            {definition.icon}
          </div>
          <div>
            <h4 className="font-medium">{definition.label}</h4>
            <p className="text-sm text-gray-500 mt-1">{definition.description}</p>
            <div className="mt-3 space-y-1">
              {definition.steps.slice(0, 3).map((step, i) => (
                <div key={step.name} className="flex items-center gap-2 text-xs text-gray-600">
                  <ArrowRight className="w-3 h-3" />
                  <span>{step.label}</span>
                </div>
              ))}
              {definition.steps.length > 3 && (
                <span className="text-xs text-gray-400 ml-5">
                  +{definition.steps.length - 3} more steps
                </span>
              )}
            </div>
          </div>
        </div>
        <Button
          size="sm"
          onClick={onStart}
          disabled={starting}
        >
          {starting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Play className="w-4 h-4 mr-1" />
              Start
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export function WorkflowStatus({ projectId, onWorkflowStart }: WorkflowStatusProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const user = firebaseAuth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

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

      // Auto-expand first active workflow
      const active = workflowData.find(w => w.status === 'running' || w.status === 'paused');
      if (active && !expandedId) {
        setExpandedId(active.id);
      }
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
      if (data.success) {
        setExpandedId(data.data.workflowId);
        if (onWorkflowStart) {
          onWorkflowStart(workflowType, data.data.workflowId);
        }
      }
    } catch (error) {
      console.error('Error starting workflow:', error);
    }
    setStarting(null);
  };

  const activeWorkflows = workflows.filter(w => w.status === 'running' || w.status === 'paused' || w.status === 'pending');
  const completedWorkflows = workflows.filter(w => w.status === 'completed');
  const failedWorkflows = workflows.filter(w => w.status === 'failed');

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
          <div className="space-y-6">
            <div className="text-center py-6">
              <Clock className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Workflows Started</h3>
              <p className="text-gray-500 mb-6">
                Start a workflow to automate project tasks and track progress.
              </p>
            </div>

            {/* Workflow options */}
            <div className="grid gap-4">
              <WorkflowInfoCard
                type="land_acquisition"
                onStart={() => handleStartWorkflow('land_acquisition')}
                starting={starting === 'land_acquisition'}
              />
              <WorkflowInfoCard
                type="project_lifecycle"
                onStart={() => handleStartWorkflow('project_lifecycle')}
                starting={starting === 'project_lifecycle'}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active Workflows */}
            {activeWorkflows.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Active Workflows ({activeWorkflows.length})
                </h4>
                <div className="space-y-4">
                  {activeWorkflows.map(workflow => (
                    <div key={workflow.id} className="p-4 bg-gray-50 rounded-lg border">
                      <WorkflowProgress
                        workflow={workflow}
                        expanded={expandedId === workflow.id}
                        onToggle={() => setExpandedId(expandedId === workflow.id ? null : workflow.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Failed Workflows */}
            {failedWorkflows.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-red-500 mb-3 flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Failed Workflows ({failedWorkflows.length})
                </h4>
                <div className="space-y-4">
                  {failedWorkflows.map(workflow => (
                    <div key={workflow.id} className="p-4 bg-red-50 rounded-lg border border-red-200">
                      <WorkflowProgress
                        workflow={workflow}
                        expanded={expandedId === workflow.id}
                        onToggle={() => setExpandedId(expandedId === workflow.id ? null : workflow.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completed Workflows */}
            {completedWorkflows.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-green-600 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Completed Workflows ({completedWorkflows.length})
                </h4>
                <div className="space-y-2">
                  {completedWorkflows.map(workflow => (
                    <div
                      key={workflow.id}
                      className="p-3 bg-green-50 rounded-lg border border-green-200 cursor-pointer hover:bg-green-100 transition-colors"
                      onClick={() => setExpandedId(expandedId === workflow.id ? null : workflow.id)}
                    >
                      {expandedId === workflow.id ? (
                        <WorkflowProgress
                          workflow={workflow}
                          expanded={true}
                          onToggle={() => setExpandedId(null)}
                        />
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                            <div>
                              <span className="font-medium">
                                {WORKFLOW_DEFINITIONS[workflow.workflowType]?.label || workflow.workflowType}
                              </span>
                              <p className="text-xs text-gray-500">
                                Completed {workflow.updatedAt?.toDate ?
                                  workflow.updatedAt.toDate().toLocaleDateString() :
                                  'recently'
                                }
                              </p>
                            </div>
                          </div>
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
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
