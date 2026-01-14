'use client';

import { useState } from 'react';
import {
  Search,
  FileText,
  Scale,
  Wrench,
  HardHat,
  Sun,
  Power,
  ChevronRight,
  CheckCircle,
  Clock,
  Lock,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import type { ProjectStatus } from '@/types';

interface ProjectLifecycleProps {
  projectId: string;
  currentStatus: ProjectStatus;
  onStatusChange?: (newStatus: ProjectStatus) => void;
}

interface LifecycleStage {
  status: ProjectStatus;
  label: string;
  description: string;
  icon: React.ReactNode;
  requirements: string[];
  milestones: string[];
}

const LIFECYCLE_STAGES: LifecycleStage[] = [
  {
    status: 'prospecting',
    label: 'Prospecting',
    description: 'Site identification and initial feasibility assessment',
    icon: <Search className="w-5 h-5" />,
    requirements: [],
    milestones: [
      'Site identified',
      'Initial landowner contact',
      'Preliminary feasibility complete',
      'Go/No-Go decision',
    ],
  },
  {
    status: 'site_control',
    label: 'Site Control',
    description: 'Land acquisition and lease execution',
    icon: <FileText className="w-5 h-5" />,
    requirements: [
      'Prospecting milestone completed',
      'Initial site analysis approved',
    ],
    milestones: [
      'LOI executed',
      'Lease/Option drafted',
      'Legal review complete',
      'Lease executed',
    ],
  },
  {
    status: 'due_diligence',
    label: 'Due Diligence',
    description: 'Environmental, legal, and technical reviews',
    icon: <Scale className="w-5 h-5" />,
    requirements: [
      'Lease executed',
      'Site control secured',
    ],
    milestones: [
      'Title review complete',
      'Phase I ESA complete',
      'Survey complete',
      'Interconnection application submitted',
    ],
  },
  {
    status: 'development',
    label: 'Development',
    description: 'Permitting, PPA negotiation, and project design',
    icon: <Wrench className="w-5 h-5" />,
    requirements: [
      'Due diligence complete',
      'No fatal flaws identified',
    ],
    milestones: [
      'CUP approved',
      'Interconnection agreement executed',
      'PPA executed',
      'EPC contract signed',
    ],
  },
  {
    status: 'construction',
    label: 'Construction',
    description: 'Project construction and commissioning',
    icon: <HardHat className="w-5 h-5" />,
    requirements: [
      'All permits obtained',
      'PPA executed',
      'Financing closed',
      'NTP issued',
    ],
    milestones: [
      'Site mobilization',
      'Foundation complete',
      'Racking installed',
      'Modules installed',
      'Electrical complete',
      'Commissioning',
    ],
  },
  {
    status: 'operational',
    label: 'Operational',
    description: 'Commercial operation and asset management',
    icon: <Sun className="w-5 h-5" />,
    requirements: [
      'Construction complete',
      'Final inspections passed',
      'COD achieved',
    ],
    milestones: [
      'COD declared',
      'Performance testing complete',
      'O&M contract active',
    ],
  },
  {
    status: 'decommissioned',
    label: 'Decommissioned',
    description: 'End of life and site restoration',
    icon: <Power className="w-5 h-5" />,
    requirements: [
      'End of project term',
      'Decommissioning plan approved',
    ],
    milestones: [
      'Equipment removed',
      'Site restored',
      'Final inspections',
    ],
  },
];

export function ProjectLifecycle({ projectId, currentStatus, onStatusChange }: ProjectLifecycleProps) {
  const [updating, setUpdating] = useState(false);
  const [selectedStage, setSelectedStage] = useState<LifecycleStage | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const currentIndex = LIFECYCLE_STAGES.findIndex(s => s.status === currentStatus);

  const handleStatusChange = async (newStatus: ProjectStatus) => {
    setUpdating(true);
    try {
      await updateDoc(doc(firebaseDb, 'projects', projectId), {
        status: newStatus,
        [`${newStatus}StartedAt`]: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (onStatusChange) {
        onStatusChange(newStatus);
      }
      setShowConfirm(false);
      setSelectedStage(null);
    } catch (error) {
      console.error('Error updating project status:', error);
    }
    setUpdating(false);
  };

  const canAdvanceTo = (targetIndex: number): boolean => {
    // Can only advance one step at a time (or go back)
    return targetIndex === currentIndex + 1 || targetIndex < currentIndex;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Lifecycle</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Timeline */}
        <div className="relative mb-8">
          {/* Progress line */}
          <div className="absolute top-6 left-6 right-6 h-1 bg-gray-200 rounded" />
          <div
            className="absolute top-6 left-6 h-1 bg-primary rounded transition-all duration-500"
            style={{
              width: `calc(${(currentIndex / (LIFECYCLE_STAGES.length - 1)) * 100}% - 24px)`,
            }}
          />

          {/* Stages */}
          <div className="relative flex justify-between">
            {LIFECYCLE_STAGES.map((stage, index) => {
              const isPast = index < currentIndex;
              const isCurrent = index === currentIndex;
              const isFuture = index > currentIndex;
              const isNext = index === currentIndex + 1;

              return (
                <div
                  key={stage.status}
                  className="flex flex-col items-center cursor-pointer"
                  onClick={() => {
                    if (canAdvanceTo(index) || isCurrent) {
                      setSelectedStage(stage);
                    }
                  }}
                >
                  <div
                    className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center border-2 bg-white z-10 transition-all',
                      isPast && 'border-primary bg-primary text-white',
                      isCurrent && 'border-primary ring-4 ring-primary/20',
                      isFuture && !isNext && 'border-gray-300 text-gray-400',
                      isNext && 'border-primary/50 text-primary/50 hover:border-primary hover:text-primary',
                      isCurrent && 'text-primary'
                    )}
                  >
                    {isPast ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : (
                      stage.icon
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-xs mt-2 text-center max-w-[80px]',
                      isCurrent && 'font-medium text-primary',
                      isPast && 'text-gray-600',
                      isFuture && 'text-gray-400'
                    )}
                  >
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Current Stage Details */}
        {selectedStage ? (
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  {selectedStage.icon}
                  {selectedStage.label}
                </h3>
                <p className="text-gray-600 mt-1">{selectedStage.description}</p>
              </div>
              {selectedStage.status === currentStatus && (
                <Badge variant="info">Current Stage</Badge>
              )}
              {LIFECYCLE_STAGES.findIndex(s => s.status === selectedStage.status) < currentIndex && (
                <Badge variant="success">Completed</Badge>
              )}
            </div>

            {/* Requirements */}
            {selectedStage.requirements.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Requirements</h4>
                <ul className="space-y-1">
                  {selectedStage.requirements.map((req, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Milestones */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Key Milestones</h4>
              <ul className="space-y-1">
                {selectedStage.milestones.map((milestone, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4 text-gray-400" />
                    {milestone}
                  </li>
                ))}
              </ul>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t">
              <Button variant="ghost" onClick={() => setSelectedStage(null)}>
                Close
              </Button>
              {canAdvanceTo(LIFECYCLE_STAGES.findIndex(s => s.status === selectedStage.status)) &&
               selectedStage.status !== currentStatus && (
                <Button
                  onClick={() => setShowConfirm(true)}
                  disabled={updating}
                >
                  {updating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ChevronRight className="w-4 h-4 mr-2" />
                  )}
                  Move to {selectedStage.label}
                </Button>
              )}
            </div>

            {/* Confirmation Dialog */}
            {showConfirm && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-800">Confirm Status Change</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      Are you sure you want to change the project status to "{selectedStage.label}"?
                      This action will be logged and may trigger downstream workflows.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowConfirm(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleStatusChange(selectedStage.status)}
                        disabled={updating}
                      >
                        {updating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Confirm
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-4">
            Click on a stage to view details or advance the project
          </div>
        )}
      </CardContent>
    </Card>
  );
}
