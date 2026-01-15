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
  AlertTriangle,
  MapPin,
  FileText,
  Building,
  ChevronDown,
  ChevronUp,
  Info,
  SkipForward,
} from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { firebaseDb, firebaseAuth } from '@/lib/firebase';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';

interface Workflow {
  id: string;
  workflowType: string;
  status: string;
  currentNode: string;
  currentStepIndex: number;
  data: Record<string, any>;
  history: Array<{ node: string; timestamp: any; action: string }>;
  createdAt: any;
  updatedAt: any;
  tenantId: string;
  projectId: string;
}

interface WorkflowStatusProps {
  projectId: string;
  parcelsCount?: number;
  documentsCount?: number;
  onWorkflowStart?: (workflowType: string, workflowId: string) => void;
}

const WORKFLOW_DEFINITIONS: Record<string, {
  label: string;
  description: string;
  icon: React.ReactNode;
  prerequisites: { type: string; message: string }[];
  steps: { name: string; label: string; description: string; requiresReview?: boolean }[];
}> = {
  land_acquisition: {
    label: 'Land Acquisition',
    description: 'Complete land acquisition process from site analysis to lease execution',
    icon: <MapPin className="w-5 h-5" />,
    prerequisites: [
      { type: 'parcels', message: 'Add at least one parcel to the project before starting this workflow' },
    ],
    steps: [
      { name: 'site_analysis', label: 'Site Analysis', description: 'Evaluate each parcel for solar suitability (zoning, environmental, grid proximity)' },
      { name: 'due_diligence', label: 'Due Diligence', description: 'Complete DD workstreams (title, environmental, survey, permits)' },
      { name: 'lease_negotiation', label: 'Lease Negotiation', description: 'Negotiate lease terms based on market analysis' },
      { name: 'legal_review', label: 'Legal Review', description: 'Attorney review required before lease execution', requiresReview: true },
      { name: 'execute_lease', label: 'Execute Lease', description: 'Finalize lease and update parcel status' },
    ],
  },
  project_lifecycle: {
    label: 'Project Lifecycle',
    description: 'Manage project through development milestones to construction',
    icon: <Building className="w-5 h-5" />,
    prerequisites: [],
    steps: [
      { name: 'prospecting', label: 'Prospecting', description: 'Initial site identification and assessment' },
      { name: 'site_control', label: 'Site Control', description: 'Secure land rights through lease or option' },
      { name: 'development', label: 'Development', description: 'Interconnection, permits, engineering, PPA' },
      { name: 'construction_ready', label: 'Construction Ready', description: 'Final approval gate - NTP authorization required', requiresReview: true },
    ],
  },
  document_processing: {
    label: 'Document Processing',
    description: 'AI-powered extraction and classification of legal documents',
    icon: <FileText className="w-5 h-5" />,
    prerequisites: [
      { type: 'documents', message: 'Upload at least one document before starting this workflow' },
    ],
    steps: [
      { name: 'classify', label: 'Classification', description: 'Classify document type (lease, PPA, easement, etc.)' },
      { name: 'extract', label: 'Data Extraction', description: 'Extract structured data from document text' },
      { name: 'validate', label: 'Validation', description: 'Validate extraction quality and completeness' },
      { name: 'hitl_gate', label: 'Human Review', description: 'Human review for legal documents or low confidence', requiresReview: true },
      { name: 'complete', label: 'Complete', description: 'Document processed and data stored' },
    ],
  },
};

function PrerequisiteModal({
  workflowType,
  onClose,
  missingPrereqs
}: {
  workflowType: string;
  onClose: () => void;
  missingPrereqs: string[];
}) {
  const definition = WORKFLOW_DEFINITIONS[workflowType];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-yellow-100 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Prerequisites Required</h3>
            <p className="text-sm text-gray-500">Complete these steps before starting {definition?.label}</p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {missingPrereqs.map((prereq, index) => (
            <div key={index} className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg">
              <XCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-yellow-800">{prereq}</span>
            </div>
          ))}
        </div>

        <Button onClick={onClose} className="w-full">
          Got it
        </Button>
      </div>
    </div>
  );
}

function WorkflowProgress({
  workflow,
  expanded,
  onToggle,
  onAdvanceStep,
  advancing
}: {
  workflow: Workflow;
  expanded: boolean;
  onToggle: () => void;
  onAdvanceStep: () => void;
  advancing: boolean;
}) {
  const definition = WORKFLOW_DEFINITIONS[workflow.workflowType];
  if (!definition) return null;

  const currentIndex = workflow.currentStepIndex || 0;
  const currentStep = definition.steps[currentIndex];
  const isCompleted = workflow.status === 'completed';
  const isPaused = workflow.status === 'paused';

  const getStepStatus = (index: number) => {
    if (isCompleted) return 'completed';
    if (workflow.status === 'failed' && index === currentIndex) return 'failed';
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return isPaused ? 'paused' : 'current';
    return 'pending';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            isCompleted ? 'bg-green-100 text-green-600' :
            isPaused ? 'bg-yellow-100 text-yellow-600' :
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
          <Badge variant={
            isCompleted ? 'success' :
            isPaused ? 'warning' :
            workflow.status === 'failed' ? 'destructive' : 'info'
          }>
            {workflow.status}
          </Badge>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {/* Progress Steps */}
      <div className="relative">
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200" />
        <div
          className={cn(
            "absolute top-4 left-4 h-0.5 transition-all duration-500",
            isCompleted ? 'bg-green-500' : 'bg-primary'
          )}
          style={{
            width: isCompleted ? '100%' : `${Math.max(0, (currentIndex / (definition.steps.length - 1)) * 100)}%`
          }}
        />

        <div className="relative flex justify-between">
          {definition.steps.map((step, index) => {
            const status = getStepStatus(index);
            return (
              <div key={step.name} className="flex flex-col items-center" style={{ width: `${100 / definition.steps.length}%` }}>
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center border-2 bg-white z-10 transition-colors',
                  status === 'completed' && 'border-green-500 bg-green-500 text-white',
                  status === 'current' && 'border-primary bg-primary text-white',
                  status === 'paused' && 'border-yellow-500 bg-yellow-500 text-white',
                  status === 'failed' && 'border-red-500 bg-red-500 text-white',
                  status === 'pending' && 'border-gray-300 text-gray-400'
                )}>
                  {status === 'completed' && <CheckCircle className="w-4 h-4" />}
                  {status === 'current' && <span className="text-xs font-bold">{index + 1}</span>}
                  {status === 'paused' && <Pause className="w-4 h-4" />}
                  {status === 'failed' && <XCircle className="w-4 h-4" />}
                  {status === 'pending' && <span className="text-xs">{index + 1}</span>}
                </div>
                <span className={cn(
                  'text-xs mt-2 text-center px-1',
                  (status === 'current' || status === 'paused') ? 'font-medium text-gray-900' : 'text-gray-500'
                )}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Current Step Info */}
          {!isCompleted && currentStep && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      Current Step: {currentStep.label}
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      {currentStep.description}
                    </p>
                    {currentStep.requiresReview && (
                      <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        This step requires manual review before proceeding
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdvanceStep();
                  }}
                  disabled={advancing}
                >
                  {advancing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <SkipForward className="w-4 h-4 mr-1" />
                      {currentIndex === definition.steps.length - 1 ? 'Complete' : 'Next Step'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {isCompleted && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Workflow Completed Successfully</span>
              </div>
            </div>
          )}

          {/* History */}
          {workflow.history && workflow.history.length > 0 && (
            <div className="border-t pt-4">
              <h5 className="text-sm font-medium text-gray-700 mb-3">History</h5>
              <div className="space-y-2">
                {workflow.history.map((entry, index) => (
                  <div key={index} className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="font-medium">
                      {definition.steps.find(s => s.name === entry.node)?.label || entry.node}
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-500">
                      {entry.timestamp?.toDate ? entry.timestamp.toDate().toLocaleString() : 'Just now'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WorkflowInfoCard({
  type,
  onStart,
  starting,
  canStart,
  prereqMessage
}: {
  type: string;
  onStart: () => void;
  starting: boolean;
  canStart: boolean;
  prereqMessage?: string;
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
              {definition.steps.slice(0, 3).map((step) => (
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
            {!canStart && prereqMessage && (
              <p className="text-xs text-yellow-600 mt-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {prereqMessage}
              </p>
            )}
          </div>
        </div>
        <Button
          size="sm"
          onClick={onStart}
          disabled={starting}
          variant={canStart ? 'default' : 'outline'}
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

export function WorkflowStatus({ projectId, parcelsCount = 0, documentsCount = 0, onWorkflowStart }: WorkflowStatusProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [prereqModal, setPrereqModal] = useState<{ type: string; messages: string[] } | null>(null);

  useEffect(() => {
    const user = firebaseAuth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    // Simple query without complex indexes
    const q = query(
      collection(firebaseDb, 'workflows'),
      where('projectId', '==', projectId),
      where('tenantId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const workflowData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Workflow[];

      // Sort client-side
      workflowData.sort((a, b) => {
        const aTime = (a.createdAt as any)?.toDate?.() || a.createdAt || 0;
        const bTime = (b.createdAt as any)?.toDate?.() || b.createdAt || 0;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

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
  }, [projectId, expandedId]);

  const checkPrerequisites = (workflowType: string): string[] => {
    const definition = WORKFLOW_DEFINITIONS[workflowType];
    if (!definition) return [];

    const missing: string[] = [];
    for (const prereq of definition.prerequisites) {
      if (prereq.type === 'parcels' && parcelsCount === 0) {
        missing.push(prereq.message);
      }
      if (prereq.type === 'documents' && documentsCount === 0) {
        missing.push(prereq.message);
      }
    }
    return missing;
  };

  const handleStartWorkflow = async (workflowType: string) => {
    const user = firebaseAuth.currentUser;
    if (!user) {
      alert('Please log in to start workflows');
      return;
    }

    // Check prerequisites
    const missingPrereqs = checkPrerequisites(workflowType);
    if (missingPrereqs.length > 0) {
      setPrereqModal({ type: workflowType, messages: missingPrereqs });
      return;
    }

    setStarting(workflowType);
    try {
      const definition = WORKFLOW_DEFINITIONS[workflowType];
      const firstStep = definition.steps[0];

      const docRef = await addDoc(collection(firebaseDb, 'workflows'), {
        projectId,
        tenantId: user.uid,
        workflowType,
        status: 'running',
        currentNode: firstStep.name,
        currentStepIndex: 0,
        data: {},
        history: [{
          node: 'started',
          timestamp: serverTimestamp(),
          action: 'Workflow started'
        }],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      console.log('Workflow created:', docRef.id);
      setExpandedId(docRef.id);

      if (onWorkflowStart) {
        onWorkflowStart(workflowType, docRef.id);
      }
    } catch (error: any) {
      console.error('Error starting workflow:', error);
      alert('Error starting workflow: ' + error.message);
    }
    setStarting(null);
  };

  const handleAdvanceStep = async (workflow: Workflow) => {
    setAdvancing(workflow.id);
    try {
      const definition = WORKFLOW_DEFINITIONS[workflow.workflowType];
      const currentIndex = workflow.currentStepIndex || 0;
      const isLastStep = currentIndex >= definition.steps.length - 1;

      const newHistory = [
        ...(workflow.history || []),
        {
          node: definition.steps[currentIndex].name,
          timestamp: serverTimestamp(),
          action: 'Step completed'
        }
      ];

      if (isLastStep) {
        // Complete the workflow
        await updateDoc(doc(firebaseDb, 'workflows', workflow.id), {
          status: 'completed',
          history: newHistory,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Advance to next step
        const nextStep = definition.steps[currentIndex + 1];
        await updateDoc(doc(firebaseDb, 'workflows', workflow.id), {
          currentNode: nextStep.name,
          currentStepIndex: currentIndex + 1,
          status: nextStep.requiresReview ? 'paused' : 'running',
          history: newHistory,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error: any) {
      console.error('Error advancing workflow:', error);
      alert('Error advancing workflow: ' + error.message);
    }
    setAdvancing(null);
  };

  const activeWorkflows = workflows.filter(w => w.status === 'running' || w.status === 'paused');
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
    <>
      {prereqModal && (
        <PrerequisiteModal
          workflowType={prereqModal.type}
          missingPrereqs={prereqModal.messages}
          onClose={() => setPrereqModal(null)}
        />
      )}

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
                  Start a workflow to track project progress step by step.
                </p>
              </div>

              <div className="grid gap-4">
                <WorkflowInfoCard
                  type="land_acquisition"
                  onStart={() => handleStartWorkflow('land_acquisition')}
                  starting={starting === 'land_acquisition'}
                  canStart={parcelsCount > 0}
                  prereqMessage={parcelsCount === 0 ? 'Requires parcels' : undefined}
                />
                <WorkflowInfoCard
                  type="project_lifecycle"
                  onStart={() => handleStartWorkflow('project_lifecycle')}
                  starting={starting === 'project_lifecycle'}
                  canStart={true}
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
                          onAdvanceStep={() => handleAdvanceStep(workflow)}
                          advancing={advancing === workflow.id}
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
                          onAdvanceStep={() => handleAdvanceStep(workflow)}
                          advancing={advancing === workflow.id}
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
                        className="p-4 bg-green-50 rounded-lg border border-green-200"
                      >
                        <WorkflowProgress
                          workflow={workflow}
                          expanded={expandedId === workflow.id}
                          onToggle={() => setExpandedId(expandedId === workflow.id ? null : workflow.id)}
                          onAdvanceStep={() => {}}
                          advancing={false}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Start new workflow buttons */}
              <div className="border-t pt-4">
                <p className="text-sm text-gray-500 mb-3">Start another workflow:</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStartWorkflow('land_acquisition')}
                    disabled={starting !== null || parcelsCount === 0}
                  >
                    <Play className="w-4 h-4 mr-1" />
                    Land Acquisition
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStartWorkflow('project_lifecycle')}
                    disabled={starting !== null}
                  >
                    <Play className="w-4 h-4 mr-1" />
                    Project Lifecycle
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
