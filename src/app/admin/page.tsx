'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings,
  FileText,
  FormInput,
  ListChecks,
  Workflow,
  Database,
  Shield,
  Save,
  Plus,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronRight,
  Lock,
  LogOut,
  Eye,
  EyeOff,
  Check,
  X,
  GripVertical,
  Copy,
  AlertCircle,
  Users,
  Mail,
} from 'lucide-react';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { WorkflowBuilder } from '@/components/admin/WorkflowBuilder';

// Permanent admin email - this user cannot be removed from admin list
const PERMANENT_ADMIN = 'mallimatla@gmail.com';

type AdminSection = 'forms' | 'documents' | 'dropdowns' | 'workflows' | 'dd-templates' | 'system' | 'admin-users';

interface FieldConfig {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date' | 'textarea' | 'checkbox' | 'email' | 'currency';
  required: boolean;
  placeholder?: string;
  options?: string[]; // For select type
  defaultValue?: any;
  visible: boolean;
  order: number;
  section?: string;
  helpText?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

interface FormConfig {
  id: string;
  name: string;
  description: string;
  fields: FieldConfig[];
}

interface DocumentDisplayConfig {
  category: string;
  label: string;
  fields: {
    path: string;
    label: string;
    type: 'text' | 'currency' | 'date' | 'percentage' | 'number' | 'list';
    visible: boolean;
    order: number;
  }[];
}

interface DropdownConfig {
  id: string;
  name: string;
  description: string;
  options: { value: string; label: string; color?: string }[];
}

interface WorkflowConfig {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
  version: number;
  nodes: any[];
  connections: any[];
  variables: any[];
  triggers: any[];
  steps: {
    id: string;
    name: string;
    label: string;
    description: string;
    requiresHitl: boolean;
    enabled: boolean;
  }[];
  createdAt?: Date;
  updatedAt?: Date;
}

interface DDTemplate {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
  checklist: { id: string; item: string; required: boolean }[];
}

interface SystemConfig {
  appName: string;
  companyName: string;
  supportEmail: string;
  defaultCurrency: string;
  dateFormat: string;
  features: {
    documentProcessing: boolean;
    workflowAutomation: boolean;
    aiAnalysis: boolean;
    notifications: boolean;
  };
}

// Default configurations
const DEFAULT_FORM_CONFIGS: FormConfig[] = [
  {
    id: 'project',
    name: 'Project Form',
    description: 'Fields for creating and editing projects',
    fields: [
      { id: 'name', name: 'name', label: 'Project Name', type: 'text', required: true, visible: true, order: 1, placeholder: 'Enter project name' },
      { id: 'type', name: 'type', label: 'Project Type', type: 'select', required: true, visible: true, order: 2, options: ['utility_solar', 'distributed', 'storage'] },
      { id: 'state', name: 'state', label: 'State', type: 'text', required: true, visible: true, order: 3, placeholder: 'e.g., CA' },
      { id: 'county', name: 'county', label: 'County', type: 'text', required: true, visible: true, order: 4, placeholder: 'e.g., Kern' },
      { id: 'capacityMwAc', name: 'capacityMwAc', label: 'Capacity (MW AC)', type: 'number', required: true, visible: true, order: 5 },
      { id: 'capexUsd', name: 'capexUsd', label: 'Estimated CAPEX', type: 'currency', required: false, visible: true, order: 6 },
      { id: 'targetCod', name: 'targetCod', label: 'Target COD', type: 'date', required: false, visible: true, order: 7 },
      { id: 'description', name: 'description', label: 'Description', type: 'textarea', required: false, visible: true, order: 8, placeholder: 'Project description...' },
    ],
  },
  {
    id: 'parcel',
    name: 'Parcel Form',
    description: 'Fields for creating and editing parcels',
    fields: [
      { id: 'apn', name: 'apn', label: 'APN', type: 'text', required: true, visible: true, order: 1, placeholder: 'Assessor Parcel Number' },
      { id: 'county', name: 'county', label: 'County', type: 'text', required: true, visible: true, order: 2 },
      { id: 'state', name: 'state', label: 'State', type: 'text', required: true, visible: true, order: 3 },
      { id: 'acres', name: 'acres', label: 'Acreage', type: 'number', required: true, visible: true, order: 4 },
      { id: 'zoning', name: 'zoning', label: 'Zoning', type: 'text', required: false, visible: true, order: 5 },
      { id: 'landUse', name: 'landUse', label: 'Land Use', type: 'text', required: false, visible: true, order: 6 },
      { id: 'ownerName', name: 'ownerName', label: 'Owner Name', type: 'text', required: false, visible: true, order: 7 },
      { id: 'ownerAddress', name: 'ownerAddress', label: 'Owner Address', type: 'textarea', required: false, visible: true, order: 8 },
      { id: 'assessedValue', name: 'assessedValue', label: 'Assessed Value', type: 'currency', required: false, visible: true, order: 9 },
      { id: 'marketValue', name: 'marketValue', label: 'Market Value', type: 'currency', required: false, visible: true, order: 10 },
    ],
  },
];

const DEFAULT_DOCUMENT_DISPLAY: DocumentDisplayConfig[] = [
  {
    category: 'lease',
    label: 'Land Lease',
    fields: [
      { path: 'lessor.name', label: 'Lessor', type: 'text', visible: true, order: 1 },
      { path: 'lessee.name', label: 'Lessee', type: 'text', visible: true, order: 2 },
      { path: 'totalAcres', label: 'Total Acres', type: 'number', visible: true, order: 3 },
      { path: 'initialTermYears', label: 'Initial Term', type: 'number', visible: true, order: 4 },
      { path: 'rent.baseRentPerAcre', label: 'Rent/Acre', type: 'currency', visible: true, order: 5 },
      { path: 'rent.annualEscalationPercent', label: 'Annual Escalation', type: 'percentage', visible: true, order: 6 },
      { path: 'rent.signingBonus', label: 'Signing Bonus', type: 'currency', visible: true, order: 7 },
      { path: 'commencementDate', label: 'Commencement', type: 'date', visible: true, order: 8 },
      { path: 'expirationDate', label: 'Expiration', type: 'date', visible: true, order: 9 },
      { path: 'parcelNumbers', label: 'Parcel Numbers', type: 'list', visible: true, order: 10 },
    ],
  },
  {
    category: 'ppa',
    label: 'Power Purchase Agreement',
    fields: [
      { path: 'seller', label: 'Seller', type: 'text', visible: true, order: 1 },
      { path: 'buyer', label: 'Buyer', type: 'text', visible: true, order: 2 },
      { path: 'contractCapacity', label: 'Capacity (MW)', type: 'number', visible: true, order: 3 },
      { path: 'contractPrice', label: 'Price ($/MWh)', type: 'currency', visible: true, order: 4 },
      { path: 'termYears', label: 'Term (Years)', type: 'number', visible: true, order: 5 },
      { path: 'annualEscalation', label: 'Escalation', type: 'percentage', visible: true, order: 6 },
      { path: 'expectedCOD', label: 'Expected COD', type: 'date', visible: true, order: 7 },
      { path: 'expectedAnnualGeneration', label: 'Annual Generation (MWh)', type: 'number', visible: true, order: 8 },
    ],
  },
  {
    category: 'easement',
    label: 'Easement Agreement',
    fields: [
      { path: 'grantor', label: 'Grantor', type: 'text', visible: true, order: 1 },
      { path: 'grantee', label: 'Grantee', type: 'text', visible: true, order: 2 },
      { path: 'purpose', label: 'Purpose', type: 'text', visible: true, order: 3 },
      { path: 'corridorWidth', label: 'Corridor Width (ft)', type: 'number', visible: true, order: 4 },
      { path: 'initialPayment', label: 'Initial Payment', type: 'currency', visible: true, order: 5 },
      { path: 'annualPayment', label: 'Annual Payment', type: 'currency', visible: true, order: 6 },
    ],
  },
];

const DEFAULT_DROPDOWNS: DropdownConfig[] = [
  {
    id: 'projectType',
    name: 'Project Types',
    description: 'Types of solar projects',
    options: [
      { value: 'utility_solar', label: 'Utility Solar', color: 'blue' },
      { value: 'distributed', label: 'Distributed Generation', color: 'green' },
      { value: 'storage', label: 'Energy Storage', color: 'purple' },
      { value: 'hybrid', label: 'Solar + Storage', color: 'orange' },
    ],
  },
  {
    id: 'projectStatus',
    name: 'Project Status',
    description: 'Project lifecycle stages',
    options: [
      { value: 'prospecting', label: 'Prospecting', color: 'gray' },
      { value: 'site_control', label: 'Site Control', color: 'blue' },
      { value: 'development', label: 'Development', color: 'yellow' },
      { value: 'construction_ready', label: 'Construction Ready', color: 'orange' },
      { value: 'construction', label: 'Construction', color: 'purple' },
      { value: 'operational', label: 'Operational', color: 'green' },
      { value: 'decommissioned', label: 'Decommissioned', color: 'red' },
    ],
  },
  {
    id: 'parcelStatus',
    name: 'Parcel Status',
    description: 'Land parcel acquisition status',
    options: [
      { value: 'available', label: 'Available', color: 'gray' },
      { value: 'under_option', label: 'Under Option', color: 'yellow' },
      { value: 'leased', label: 'Leased', color: 'green' },
      { value: 'owned', label: 'Owned', color: 'blue' },
    ],
  },
  {
    id: 'documentCategory',
    name: 'Document Categories',
    description: 'Types of documents processed',
    options: [
      { value: 'lease', label: 'Land Lease', color: 'blue' },
      { value: 'ppa', label: 'Power Purchase Agreement', color: 'green' },
      { value: 'easement', label: 'Easement', color: 'purple' },
      { value: 'option', label: 'Option Agreement', color: 'yellow' },
      { value: 'title_report', label: 'Title Report', color: 'gray' },
      { value: 'survey', label: 'Survey', color: 'orange' },
      { value: 'interconnection_agreement', label: 'Interconnection', color: 'red' },
      { value: 'environmental_report', label: 'Environmental', color: 'teal' },
    ],
  },
  {
    id: 'urgencyLevels',
    name: 'Urgency Levels',
    description: 'Priority levels for review requests',
    options: [
      { value: 'low', label: 'Low', color: 'gray' },
      { value: 'medium', label: 'Medium', color: 'yellow' },
      { value: 'high', label: 'High', color: 'orange' },
      { value: 'critical', label: 'Critical', color: 'red' },
    ],
  },
];

const DEFAULT_WORKFLOWS: WorkflowConfig[] = [
  {
    id: 'document_processing',
    name: 'Document Processing',
    enabled: true,
    description: 'AI-powered document extraction and classification',
    version: 1,
    nodes: [
      { id: 'trigger_1', type: 'trigger_document_upload', name: 'Document Upload', description: 'When document is uploaded', position: { x: 50, y: 100 }, config: {}, inputs: [], outputs: ['output'] },
      { id: 'ai_1', type: 'ai_classifier', name: 'Document Classifier', description: 'AI classifies document type', position: { x: 300, y: 100 }, config: { model: 'claude-3-sonnet', categories: ['lease', 'ppa', 'easement', 'title_report'], confidenceThreshold: 0.8 }, inputs: ['input'], outputs: ['output'] },
      { id: 'ai_2', type: 'ai_extractor', name: 'Data Extractor', description: 'Extract structured data', position: { x: 550, y: 100 }, config: { model: 'claude-3-sonnet', validateOutput: true }, inputs: ['input'], outputs: ['output'] },
      { id: 'cond_1', type: 'condition', name: 'Check Confidence', description: 'If confidence >= 90%', position: { x: 800, y: 100 }, config: { conditions: [{ field: 'confidence', operator: 'greater', value: '0.9' }] }, inputs: ['input'], outputs: ['true', 'false'] },
      { id: 'hitl_1', type: 'hitl_gate', name: 'Human Review', description: 'Manual review required', position: { x: 1050, y: 180 }, config: { reviewType: 'approval', urgency: 'medium' }, inputs: ['input'], outputs: ['output'] },
      { id: 'end_1', type: 'end_success', name: 'Complete', description: 'Processing complete', position: { x: 1300, y: 100 }, config: {}, inputs: ['input'], outputs: [] },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'trigger_1', sourceOutput: 'output', targetNodeId: 'ai_1', targetInput: 'input' },
      { id: 'c2', sourceNodeId: 'ai_1', sourceOutput: 'output', targetNodeId: 'ai_2', targetInput: 'input' },
      { id: 'c3', sourceNodeId: 'ai_2', sourceOutput: 'output', targetNodeId: 'cond_1', targetInput: 'input' },
      { id: 'c4', sourceNodeId: 'cond_1', sourceOutput: 'true', targetNodeId: 'end_1', targetInput: 'input' },
      { id: 'c5', sourceNodeId: 'cond_1', sourceOutput: 'false', targetNodeId: 'hitl_1', targetInput: 'input' },
      { id: 'c6', sourceNodeId: 'hitl_1', sourceOutput: 'output', targetNodeId: 'end_1', targetInput: 'input' },
    ],
    variables: [],
    triggers: [{ id: 't1', type: 'event', config: { eventType: 'document.created' }, enabled: true }],
    steps: [
      { id: 'classify', name: 'classify', label: 'Classification', description: 'AI classifies document type', requiresHitl: false, enabled: true },
      { id: 'extract', name: 'extract', label: 'Data Extraction', description: 'Extract structured data', requiresHitl: false, enabled: true },
      { id: 'validate', name: 'validate', label: 'Validation', description: 'Validate extraction quality', requiresHitl: false, enabled: true },
      { id: 'hitl_gate', name: 'hitl_gate', label: 'Human Review', description: 'Human review gate', requiresHitl: true, enabled: true },
      { id: 'complete', name: 'complete', label: 'Complete', description: 'Finalize processing', requiresHitl: false, enabled: true },
    ],
  },
  {
    id: 'land_acquisition',
    name: 'Land Acquisition',
    enabled: true,
    description: 'Complete land acquisition workflow from analysis to lease',
    version: 1,
    nodes: [
      { id: 'trigger_1', type: 'trigger_manual', name: 'Start Acquisition', description: 'Manually triggered', position: { x: 50, y: 100 }, config: {}, inputs: [], outputs: ['output'] },
      { id: 'ai_1', type: 'ai_analyzer', name: 'Site Analysis', description: 'AI analyzes site suitability', position: { x: 300, y: 100 }, config: { analysisType: 'site_suitability' }, inputs: ['input'], outputs: ['output'] },
      { id: 'cond_1', type: 'condition', name: 'Site Suitable?', description: 'Check suitability score', position: { x: 550, y: 100 }, config: { conditions: [{ field: 'score', operator: 'greater', value: '70' }] }, inputs: ['input'], outputs: ['true', 'false'] },
      { id: 'action_1', type: 'action_create_record', name: 'Create DD', description: 'Initialize due diligence', position: { x: 800, y: 50 }, config: { collection: 'ddWorkstreams' }, inputs: ['input'], outputs: ['output'] },
      { id: 'ai_2', type: 'ai_custom', name: 'Lease Terms', description: 'AI recommends lease terms', position: { x: 1050, y: 50 }, config: { systemPrompt: 'You are a solar land lease expert.' }, inputs: ['input'], outputs: ['output'] },
      { id: 'hitl_1', type: 'hitl_gate', name: 'Legal Review', description: 'Attorney review required', position: { x: 1300, y: 50 }, config: { reviewType: 'edit', urgency: 'high' }, inputs: ['input'], outputs: ['output'] },
      { id: 'end_1', type: 'end_success', name: 'Lease Executed', description: 'Acquisition complete', position: { x: 1550, y: 50 }, config: {}, inputs: ['input'], outputs: [] },
      { id: 'end_2', type: 'end_failure', name: 'Not Suitable', description: 'Site not suitable', position: { x: 800, y: 200 }, config: {}, inputs: ['input'], outputs: [] },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'trigger_1', sourceOutput: 'output', targetNodeId: 'ai_1', targetInput: 'input' },
      { id: 'c2', sourceNodeId: 'ai_1', sourceOutput: 'output', targetNodeId: 'cond_1', targetInput: 'input' },
      { id: 'c3', sourceNodeId: 'cond_1', sourceOutput: 'true', targetNodeId: 'action_1', targetInput: 'input' },
      { id: 'c4', sourceNodeId: 'cond_1', sourceOutput: 'false', targetNodeId: 'end_2', targetInput: 'input' },
      { id: 'c5', sourceNodeId: 'action_1', sourceOutput: 'output', targetNodeId: 'ai_2', targetInput: 'input' },
      { id: 'c6', sourceNodeId: 'ai_2', sourceOutput: 'output', targetNodeId: 'hitl_1', targetInput: 'input' },
      { id: 'c7', sourceNodeId: 'hitl_1', sourceOutput: 'output', targetNodeId: 'end_1', targetInput: 'input' },
    ],
    variables: [],
    triggers: [],
    steps: [
      { id: 'site_analysis', name: 'site_analysis', label: 'Site Analysis', description: 'AI analyzes site suitability', requiresHitl: false, enabled: true },
      { id: 'due_diligence', name: 'due_diligence', label: 'Due Diligence', description: 'Initialize DD workstreams', requiresHitl: false, enabled: true },
      { id: 'lease_negotiation', name: 'lease_negotiation', label: 'Lease Negotiation', description: 'AI recommends lease terms', requiresHitl: false, enabled: true },
      { id: 'legal_review', name: 'legal_review', label: 'Legal Review', description: 'Attorney review required', requiresHitl: true, enabled: true },
      { id: 'execute_lease', name: 'execute_lease', label: 'Execute Lease', description: 'Finalize lease execution', requiresHitl: false, enabled: true },
    ],
  },
  {
    id: 'project_lifecycle',
    name: 'Project Lifecycle',
    enabled: true,
    description: 'Manage project through development milestones',
    version: 1,
    nodes: [
      { id: 'trigger_1', type: 'trigger_event', name: 'Project Created', description: 'When project is created', position: { x: 50, y: 100 }, config: { eventType: 'project.created' }, inputs: [], outputs: ['output'] },
      { id: 'action_1', type: 'action_send_notification', name: 'Welcome', description: 'Send welcome notification', position: { x: 300, y: 100 }, config: { title: 'Project Started', type: 'info' }, inputs: ['input'], outputs: ['output'] },
      { id: 'delay_1', type: 'delay', name: 'Wait 1 Day', description: 'Wait for initial setup', position: { x: 550, y: 100 }, config: { duration: 1, unit: 'days' }, inputs: ['input'], outputs: ['output'] },
      { id: 'action_2', type: 'action_send_notification', name: 'Reminder', description: 'Add parcels reminder', position: { x: 800, y: 100 }, config: { title: 'Add Parcels', message: 'Add parcels to continue', type: 'warning' }, inputs: ['input'], outputs: ['output'] },
      { id: 'end_1', type: 'end_success', name: 'Complete', description: 'Lifecycle started', position: { x: 1050, y: 100 }, config: {}, inputs: ['input'], outputs: [] },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'trigger_1', sourceOutput: 'output', targetNodeId: 'action_1', targetInput: 'input' },
      { id: 'c2', sourceNodeId: 'action_1', sourceOutput: 'output', targetNodeId: 'delay_1', targetInput: 'input' },
      { id: 'c3', sourceNodeId: 'delay_1', sourceOutput: 'output', targetNodeId: 'action_2', targetInput: 'input' },
      { id: 'c4', sourceNodeId: 'action_2', sourceOutput: 'output', targetNodeId: 'end_1', targetInput: 'input' },
    ],
    variables: [],
    triggers: [{ id: 't1', type: 'event', config: { eventType: 'project.created' }, enabled: true }],
    steps: [
      { id: 'prospecting', name: 'prospecting', label: 'Prospecting', description: 'Initial site identification', requiresHitl: false, enabled: true },
      { id: 'site_control', name: 'site_control', label: 'Site Control', description: 'Secure land rights', requiresHitl: false, enabled: true },
      { id: 'development', name: 'development', label: 'Development', description: 'Permits and engineering', requiresHitl: false, enabled: true },
      { id: 'construction_ready', name: 'construction_ready', label: 'Construction Ready', description: 'NTP approval gate', requiresHitl: true, enabled: true },
    ],
  },
];

const DEFAULT_DD_TEMPLATES: DDTemplate[] = [
  {
    id: 'title_review',
    name: 'Title Review',
    category: 'legal',
    enabled: true,
    checklist: [
      { id: '1', item: 'Order title commitment', required: true },
      { id: '2', item: 'Review ownership history', required: true },
      { id: '3', item: 'Identify liens and encumbrances', required: true },
      { id: '4', item: 'Verify legal description matches survey', required: true },
      { id: '5', item: 'Review existing easements', required: false },
      { id: '6', item: 'Confirm no boundary disputes', required: false },
    ],
  },
  {
    id: 'environmental',
    name: 'Environmental Review',
    category: 'environmental',
    enabled: true,
    checklist: [
      { id: '1', item: 'Phase I ESA', required: true },
      { id: '2', item: 'Wetlands delineation', required: true },
      { id: '3', item: 'Endangered species review', required: true },
      { id: '4', item: 'Cultural resources survey', required: false },
      { id: '5', item: 'NEPA/CEQA compliance', required: false },
    ],
  },
  {
    id: 'survey',
    name: 'Land Survey',
    category: 'technical',
    enabled: true,
    checklist: [
      { id: '1', item: 'ALTA/NSPS survey', required: true },
      { id: '2', item: 'Topographic survey', required: true },
      { id: '3', item: 'Boundary verification', required: true },
      { id: '4', item: 'Flood zone determination', required: false },
    ],
  },
  {
    id: 'permitting',
    name: 'Permitting',
    category: 'permits',
    enabled: true,
    checklist: [
      { id: '1', item: 'Zoning verification', required: true },
      { id: '2', item: 'CUP application (if needed)', required: false },
      { id: '3', item: 'Building permit requirements', required: true },
      { id: '4', item: 'Stormwater permit', required: false },
      { id: '5', item: 'FAA determination', required: false },
    ],
  },
  {
    id: 'interconnection',
    name: 'Interconnection',
    category: 'grid',
    enabled: true,
    checklist: [
      { id: '1', item: 'Submit interconnection application', required: true },
      { id: '2', item: 'Feasibility study', required: true },
      { id: '3', item: 'System impact study', required: true },
      { id: '4', item: 'Facility study', required: false },
      { id: '5', item: 'Interconnection agreement', required: true },
    ],
  },
  {
    id: 'financial',
    name: 'Financial Analysis',
    category: 'financial',
    enabled: true,
    checklist: [
      { id: '1', item: 'Pro forma model', required: true },
      { id: '2', item: 'Tax equity analysis', required: false },
      { id: '3', item: 'Debt financing terms', required: false },
      { id: '4', item: 'Insurance requirements', required: true },
    ],
  },
];

const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  appName: 'Neurogrid',
  companyName: 'Solar Development Co.',
  supportEmail: 'support@example.com',
  defaultCurrency: 'USD',
  dateFormat: 'MM/DD/YYYY',
  features: {
    documentProcessing: true,
    workflowAutomation: true,
    aiAnalysis: true,
    notifications: true,
  },
};

// Not Authorized Component
function NotAuthorized({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl">Access Denied</CardTitle>
          <p className="text-gray-500 mt-2">
            You don&apos;t have permission to access the admin portal.
            Contact your administrator to request access.
          </p>
        </CardHeader>
        <CardContent>
          <Button onClick={onBack} className="w-full">
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Login Required Component
function LoginRequired({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl">Admin Portal</CardTitle>
          <p className="text-gray-500 mt-2">
            Please log in to your account to access the admin portal.
          </p>
        </CardHeader>
        <CardContent>
          <Button onClick={onLogin} className="w-full">
            <Lock className="w-4 h-4 mr-2" />
            Go to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Main Admin Page
export default function AdminPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckComplete, setAdminCheckComplete] = useState(false);
  const [activeSection, setActiveSection] = useState<AdminSection>('forms');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Configuration states
  const [formConfigs, setFormConfigs] = useState<FormConfig[]>(DEFAULT_FORM_CONFIGS);
  const [documentDisplayConfigs, setDocumentDisplayConfigs] = useState<DocumentDisplayConfig[]>(DEFAULT_DOCUMENT_DISPLAY);
  const [dropdownConfigs, setDropdownConfigs] = useState<DropdownConfig[]>(DEFAULT_DROPDOWNS);
  const [workflowConfigs, setWorkflowConfigs] = useState<WorkflowConfig[]>(DEFAULT_WORKFLOWS);
  const [ddTemplates, setDdTemplates] = useState<DDTemplate[]>(DEFAULT_DD_TEMPLATES);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG);
  const [adminEmails, setAdminEmails] = useState<string[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // UI states
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);

  // Check if user is admin - permanent admin OR in adminEmails list from Firestore
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setAdminCheckComplete(true);
        return;
      }

      // Permanent admin always has access
      if (user.email === PERMANENT_ADMIN) {
        setIsAdmin(true);
        setAdminCheckComplete(true);
        return;
      }

      // Check if user email is in the admin emails list from Firestore
      try {
        const adminDoc = await getDoc(doc(firebaseDb, 'config', 'adminUsers'));
        if (adminDoc.exists()) {
          const emails = adminDoc.data().emails || [];
          setIsAdmin(emails.includes(user.email));
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      }

      setAdminCheckComplete(true);
    };

    if (!authLoading) {
      checkAdmin();
    }
  }, [user, authLoading]);

  // Load configurations from Firestore
  useEffect(() => {
    if (!user || !isAdmin) return;

    const loadConfigs = async () => {
      try {
        // Load form configs
        const formDoc = await getDoc(doc(firebaseDb, 'config', 'forms'));
        if (formDoc.exists()) {
          setFormConfigs(formDoc.data().configs || DEFAULT_FORM_CONFIGS);
        }

        // Load document display configs
        const docDisplayDoc = await getDoc(doc(firebaseDb, 'config', 'documentDisplay'));
        if (docDisplayDoc.exists()) {
          setDocumentDisplayConfigs(docDisplayDoc.data().configs || DEFAULT_DOCUMENT_DISPLAY);
        }

        // Load dropdown configs
        const dropdownDoc = await getDoc(doc(firebaseDb, 'config', 'dropdowns'));
        if (dropdownDoc.exists()) {
          setDropdownConfigs(dropdownDoc.data().configs || DEFAULT_DROPDOWNS);
        }

        // Load workflow configs
        const workflowDoc = await getDoc(doc(firebaseDb, 'config', 'workflows'));
        if (workflowDoc.exists()) {
          setWorkflowConfigs(workflowDoc.data().configs || DEFAULT_WORKFLOWS);
        }

        // Load DD templates
        const ddDoc = await getDoc(doc(firebaseDb, 'config', 'ddTemplates'));
        if (ddDoc.exists()) {
          setDdTemplates(ddDoc.data().configs || DEFAULT_DD_TEMPLATES);
        }

        // Load system config
        const systemDoc = await getDoc(doc(firebaseDb, 'config', 'system'));
        if (systemDoc.exists()) {
          setSystemConfig(systemDoc.data() as SystemConfig || DEFAULT_SYSTEM_CONFIG);
        }

        // Load admin emails
        const adminDoc = await getDoc(doc(firebaseDb, 'config', 'adminUsers'));
        if (adminDoc.exists()) {
          setAdminEmails(adminDoc.data().emails || []);
        }
      } catch (error) {
        console.error('Error loading configs:', error);
      }
    };

    loadConfigs();
  }, [user, isAdmin]);

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('idle');

    try {
      await Promise.all([
        setDoc(doc(firebaseDb, 'config', 'forms'), { configs: formConfigs, updatedAt: new Date() }),
        setDoc(doc(firebaseDb, 'config', 'documentDisplay'), { configs: documentDisplayConfigs, updatedAt: new Date() }),
        setDoc(doc(firebaseDb, 'config', 'dropdowns'), { configs: dropdownConfigs, updatedAt: new Date() }),
        setDoc(doc(firebaseDb, 'config', 'workflows'), { configs: workflowConfigs, updatedAt: new Date() }),
        setDoc(doc(firebaseDb, 'config', 'ddTemplates'), { configs: ddTemplates, updatedAt: new Date() }),
        setDoc(doc(firebaseDb, 'config', 'system'), { ...systemConfig, updatedAt: new Date() }),
        setDoc(doc(firebaseDb, 'config', 'adminUsers'), { emails: adminEmails, updatedAt: new Date() }),
      ]);

      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Error saving configs:', error);
      setSaveStatus('error');
    }

    setSaving(false);
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  // Form field management
  const addFormField = (formId: string) => {
    const newField: FieldConfig = {
      id: `field_${Date.now()}`,
      name: 'new_field',
      label: 'New Field',
      type: 'text',
      required: false,
      visible: true,
      order: formConfigs.find(f => f.id === formId)?.fields.length || 0 + 1,
    };

    setFormConfigs(configs =>
      configs.map(form =>
        form.id === formId
          ? { ...form, fields: [...form.fields, newField] }
          : form
      )
    );
  };

  const updateFormField = (formId: string, fieldId: string, updates: Partial<FieldConfig>) => {
    setFormConfigs(configs =>
      configs.map(form =>
        form.id === formId
          ? {
              ...form,
              fields: form.fields.map(field =>
                field.id === fieldId ? { ...field, ...updates } : field
              ),
            }
          : form
      )
    );
  };

  const deleteFormField = (formId: string, fieldId: string) => {
    setFormConfigs(configs =>
      configs.map(form =>
        form.id === formId
          ? { ...form, fields: form.fields.filter(field => field.id !== fieldId) }
          : form
      )
    );
  };

  // Dropdown option management
  const addDropdownOption = (dropdownId: string) => {
    setDropdownConfigs(configs =>
      configs.map(dropdown =>
        dropdown.id === dropdownId
          ? {
              ...dropdown,
              options: [
                ...dropdown.options,
                { value: `option_${Date.now()}`, label: 'New Option', color: 'gray' },
              ],
            }
          : dropdown
      )
    );
  };

  const updateDropdownOption = (dropdownId: string, index: number, updates: any) => {
    setDropdownConfigs(configs =>
      configs.map(dropdown =>
        dropdown.id === dropdownId
          ? {
              ...dropdown,
              options: dropdown.options.map((opt, i) =>
                i === index ? { ...opt, ...updates } : opt
              ),
            }
          : dropdown
      )
    );
  };

  const deleteDropdownOption = (dropdownId: string, index: number) => {
    setDropdownConfigs(configs =>
      configs.map(dropdown =>
        dropdown.id === dropdownId
          ? { ...dropdown, options: dropdown.options.filter((_, i) => i !== index) }
          : dropdown
      )
    );
  };

  if (authLoading || !adminCheckComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginRequired onLogin={() => router.push('/login')} />;
  }

  if (!isAdmin) {
    return <NotAuthorized onBack={() => router.push('/dashboard')} />;
  }

  const sections = [
    { id: 'forms', label: 'Form Fields', icon: FormInput, description: 'Configure form fields for projects and parcels' },
    { id: 'documents', label: 'Document Display', icon: FileText, description: 'Configure what fields to show from extracted documents' },
    { id: 'dropdowns', label: 'Dropdown Options', icon: ListChecks, description: 'Manage dropdown options (types, statuses, categories)' },
    { id: 'workflows', label: 'Workflows', icon: Workflow, description: 'Enable/disable workflows and configure steps' },
    { id: 'dd-templates', label: 'DD Templates', icon: Database, description: 'Configure due diligence workstream templates' },
    { id: 'system', label: 'System Settings', icon: Settings, description: 'General system configuration' },
    { id: 'admin-users', label: 'Admin Users', icon: Users, description: 'Manage users who can access the admin portal' },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Admin Portal</h1>
              <p className="text-sm text-gray-500">System Configuration</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                saveStatus === 'success' && 'bg-green-600 hover:bg-green-700',
                saveStatus === 'error' && 'bg-red-600 hover:bg-red-700'
              )}
            >
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              ) : saveStatus === 'success' ? (
                <Check className="w-4 h-4 mr-2" />
              ) : saveStatus === 'error' ? (
                <X className="w-4 h-4 mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {saving ? 'Saving...' : saveStatus === 'success' ? 'Saved!' : saveStatus === 'error' ? 'Error' : 'Save All'}
            </Button>
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              Back to App
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className={cn(
        "mx-auto px-4 py-6",
        editingWorkflowId ? "max-w-full" : "max-w-7xl"
      )}>
        <div className={cn(
          "grid gap-6",
          editingWorkflowId ? "grid-cols-1" : "grid-cols-12"
        )}>
          {/* Sidebar - hidden when editing workflow */}
          {!editingWorkflowId && (
            <div className="col-span-3">
              <Card>
                <CardContent className="p-4">
                  <nav className="space-y-1">
                    {sections.map((section) => {
                      const Icon = section.icon;
                      return (
                        <button
                          key={section.id}
                          onClick={() => setActiveSection(section.id as AdminSection)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                            activeSection === section.id
                              ? 'bg-primary text-white'
                              : 'text-gray-700 hover:bg-gray-100'
                          )}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="font-medium">{section.label}</span>
                        </button>
                      );
                    })}
                  </nav>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Main Content - full width when editing workflow */}
          <div className={editingWorkflowId ? "" : "col-span-9"}>
            <Card className={editingWorkflowId ? "border-0 shadow-none" : ""}>
              {/* Hide header when editing workflow - we have custom header */}
              {!editingWorkflowId && (
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {(() => {
                      const section = sections.find(s => s.id === activeSection);
                      const Icon = section?.icon || Settings;
                      return (
                        <>
                          <Icon className="w-5 h-5" />
                          {section?.label}
                        </>
                      );
                    })()}
                  </CardTitle>
                  <p className="text-gray-500 text-sm mt-1">
                    {sections.find(s => s.id === activeSection)?.description}
                  </p>
                </CardHeader>
              )}
              <CardContent className={editingWorkflowId ? "p-0" : ""}>
                {/* Form Fields Section */}
                {activeSection === 'forms' && (
                  <div className="space-y-6">
                    {formConfigs.map((form) => (
                      <div key={form.id} className="border rounded-lg">
                        <button
                          onClick={() => toggleExpand(form.id)}
                          className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                        >
                          <div>
                            <h3 className="font-medium">{form.name}</h3>
                            <p className="text-sm text-gray-500">{form.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge>{form.fields.length} fields</Badge>
                            {expandedItems.has(form.id) ? (
                              <ChevronDown className="w-5 h-5" />
                            ) : (
                              <ChevronRight className="w-5 h-5" />
                            )}
                          </div>
                        </button>

                        {expandedItems.has(form.id) && (
                          <div className="border-t p-4 space-y-3">
                            {form.fields
                              .sort((a, b) => a.order - b.order)
                              .map((field) => (
                                <div key={field.id} className="space-y-2">
                                  <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                                    <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />

                                    <div className="flex-1 grid grid-cols-5 gap-3">
                                      <input
                                        type="text"
                                        value={field.label}
                                        onChange={(e) =>
                                          updateFormField(form.id, field.id, { label: e.target.value })
                                        }
                                        className="px-2 py-1 border rounded text-sm"
                                        placeholder="Label"
                                      />
                                      <input
                                        type="text"
                                        value={field.name}
                                        onChange={(e) =>
                                          updateFormField(form.id, field.id, { name: e.target.value })
                                        }
                                        className="px-2 py-1 border rounded text-sm font-mono"
                                        placeholder="field_name"
                                      />
                                      <select
                                        value={field.type}
                                        onChange={(e) =>
                                          updateFormField(form.id, field.id, {
                                            type: e.target.value as FieldConfig['type'],
                                          })
                                        }
                                        className="px-2 py-1 border rounded text-sm"
                                      >
                                        <option value="text">Text</option>
                                        <option value="number">Number</option>
                                        <option value="currency">Currency</option>
                                        <option value="date">Date</option>
                                        <option value="select">Dropdown</option>
                                        <option value="textarea">Textarea</option>
                                        <option value="checkbox">Checkbox</option>
                                        <option value="email">Email</option>
                                      </select>
                                      <label className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={field.required}
                                          onChange={(e) =>
                                            updateFormField(form.id, field.id, {
                                              required: e.target.checked,
                                            })
                                          }
                                        />
                                        <span className="text-sm">Required</span>
                                      </label>
                                      <label className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={field.visible}
                                          onChange={(e) =>
                                            updateFormField(form.id, field.id, {
                                              visible: e.target.checked,
                                            })
                                          }
                                        />
                                        <span className="text-sm">Visible</span>
                                      </label>
                                    </div>

                                    <button
                                      onClick={() => deleteFormField(form.id, field.id)}
                                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>

                                  {/* Dropdown Options Editor */}
                                  {field.type === 'select' && (
                                    <div className="ml-8 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-blue-800">
                                          Dropdown Options
                                        </span>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            const currentOptions = field.options || [];
                                            updateFormField(form.id, field.id, {
                                              options: [...currentOptions, `option_${currentOptions.length + 1}`],
                                            });
                                          }}
                                          className="h-7 text-xs"
                                        >
                                          <Plus className="w-3 h-3 mr-1" />
                                          Add Option
                                        </Button>
                                      </div>
                                      {(!field.options || field.options.length === 0) ? (
                                        <p className="text-sm text-blue-600">
                                          No options defined. Click &quot;Add Option&quot; to add dropdown choices.
                                        </p>
                                      ) : (
                                        <div className="space-y-2">
                                          {field.options.map((option, optIndex) => (
                                            <div key={optIndex} className="flex items-center gap-2">
                                              <input
                                                type="text"
                                                value={option}
                                                onChange={(e) => {
                                                  const newOptions = [...(field.options || [])];
                                                  newOptions[optIndex] = e.target.value;
                                                  updateFormField(form.id, field.id, { options: newOptions });
                                                }}
                                                className="flex-1 px-2 py-1 border rounded text-sm"
                                                placeholder="Option value"
                                              />
                                              <button
                                                onClick={() => {
                                                  const newOptions = (field.options || []).filter(
                                                    (_, i) => i !== optIndex
                                                  );
                                                  updateFormField(form.id, field.id, { options: newOptions });
                                                }}
                                                className="p-1 text-red-500 hover:bg-red-100 rounded"
                                              >
                                                <X className="w-4 h-4" />
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addFormField(form.id)}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Field
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Document Display Section */}
                {activeSection === 'documents' && (
                  <div className="space-y-6">
                    {/* Add New Category Button */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">
                          Configure what fields to extract and display for each document type.
                          Changes are automatically applied to the user app.
                        </p>
                      </div>
                      <Button
                        onClick={() => {
                          const newCategory: DocumentDisplayConfig = {
                            category: `category_${Date.now()}`,
                            label: 'New Document Type',
                            fields: [],
                          };
                          setDocumentDisplayConfigs([...documentDisplayConfigs, newCategory]);
                          // Auto-expand the new category
                          setExpandedItems(new Set([...Array.from(expandedItems), newCategory.category]));
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Document Type
                      </Button>
                    </div>

                    {documentDisplayConfigs.length === 0 && (
                      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
                        <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500">No document types configured</p>
                        <p className="text-sm text-gray-400 mt-1">Click &quot;Add Document Type&quot; to get started</p>
                      </div>
                    )}

                    {documentDisplayConfigs.map((config, configIndex) => (
                      <div key={config.category} className="border rounded-lg">
                        <div className="flex items-center justify-between p-4 hover:bg-gray-50">
                          <button
                            onClick={() => toggleExpand(config.category)}
                            className="flex-1 flex items-center gap-3 text-left"
                          >
                            <FileText className="w-5 h-5 text-gray-400" />
                            <div>
                              <h3 className="font-medium">{config.label}</h3>
                              <p className="text-sm text-gray-500 font-mono">category: {config.category}</p>
                            </div>
                          </button>
                          <div className="flex items-center gap-3">
                            <Badge>{config.fields.length} field{config.fields.length !== 1 ? 's' : ''}</Badge>
                            <Badge variant="outline">{config.fields.filter(f => f.visible).length} visible</Badge>
                            <button
                              onClick={() => {
                                if (confirm(`Delete "${config.label}" document type? This will remove all its fields.`)) {
                                  setDocumentDisplayConfigs(documentDisplayConfigs.filter((_, i) => i !== configIndex));
                                }
                              }}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                              title="Delete document type"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => toggleExpand(config.category)}>
                              {expandedItems.has(config.category) ? (
                                <ChevronDown className="w-5 h-5 text-gray-500" />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-gray-500" />
                              )}
                            </button>
                          </div>
                        </div>

                        {expandedItems.has(config.category) && (
                          <div className="border-t p-4 space-y-4">
                            {/* Category Settings */}
                            <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Display Name
                                </label>
                                <input
                                  type="text"
                                  value={config.label}
                                  onChange={(e) => {
                                    const newConfigs = [...documentDisplayConfigs];
                                    newConfigs[configIndex].label = e.target.value;
                                    setDocumentDisplayConfigs(newConfigs);
                                  }}
                                  className="w-full px-3 py-2 border rounded-lg text-sm"
                                  placeholder="e.g., Land Lease Agreement"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Category ID <span className="text-gray-400">(used in code)</span>
                                </label>
                                <input
                                  type="text"
                                  value={config.category}
                                  onChange={(e) => {
                                    const newConfigs = [...documentDisplayConfigs];
                                    const oldCategory = newConfigs[configIndex].category;
                                    newConfigs[configIndex].category = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                                    setDocumentDisplayConfigs(newConfigs);
                                    // Update expanded items if category changed
                                    if (expandedItems.has(oldCategory)) {
                                      const newExpanded = new Set(expandedItems);
                                      newExpanded.delete(oldCategory);
                                      newExpanded.add(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                                      setExpandedItems(newExpanded);
                                    }
                                  }}
                                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                                  placeholder="e.g., lease"
                                />
                              </div>
                            </div>

                            {/* Fields Header */}
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-gray-700">Extraction Fields</h4>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const newConfigs = [...documentDisplayConfigs];
                                  newConfigs[configIndex].fields.push({
                                    path: `field_${Date.now()}`,
                                    label: 'New Field',
                                    type: 'text',
                                    visible: true,
                                    order: config.fields.length + 1,
                                  });
                                  setDocumentDisplayConfigs(newConfigs);
                                }}
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Add Field
                              </Button>
                            </div>

                            {config.fields.length === 0 && (
                              <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed">
                                <p className="text-gray-500 text-sm">No fields configured</p>
                                <p className="text-xs text-gray-400 mt-1">Add fields to define what data to extract from this document type</p>
                              </div>
                            )}

                            {/* Fields List */}
                            {config.fields
                              .sort((a, b) => a.order - b.order)
                              .map((field, fieldIndex) => (
                                <div
                                  key={`${config.category}-${fieldIndex}`}
                                  className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg"
                                >
                                  <GripVertical className="w-4 h-4 text-gray-400 cursor-move mt-2" />

                                  <div className="flex-1 space-y-2">
                                    <div className="grid grid-cols-4 gap-3">
                                      <div>
                                        <label className="block text-xs text-gray-500 mb-1">Label</label>
                                        <input
                                          type="text"
                                          value={field.label}
                                          onChange={(e) => {
                                            const newConfigs = [...documentDisplayConfigs];
                                            newConfigs[configIndex].fields[fieldIndex].label = e.target.value;
                                            setDocumentDisplayConfigs(newConfigs);
                                          }}
                                          className="w-full px-2 py-1.5 border rounded text-sm"
                                          placeholder="Display label"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-gray-500 mb-1">
                                          JSON Path <span className="text-gray-400">(dot notation)</span>
                                        </label>
                                        <input
                                          type="text"
                                          value={field.path}
                                          onChange={(e) => {
                                            const newConfigs = [...documentDisplayConfigs];
                                            newConfigs[configIndex].fields[fieldIndex].path = e.target.value;
                                            setDocumentDisplayConfigs(newConfigs);
                                          }}
                                          className="w-full px-2 py-1.5 border rounded text-sm font-mono"
                                          placeholder="e.g., lessor.name"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-gray-500 mb-1">Display Type</label>
                                        <select
                                          value={field.type}
                                          onChange={(e) => {
                                            const newConfigs = [...documentDisplayConfigs];
                                            newConfigs[configIndex].fields[fieldIndex].type = e.target.value as any;
                                            setDocumentDisplayConfigs(newConfigs);
                                          }}
                                          className="w-full px-2 py-1.5 border rounded text-sm"
                                        >
                                          <option value="text">Text</option>
                                          <option value="number">Number</option>
                                          <option value="currency">Currency ($)</option>
                                          <option value="date">Date</option>
                                          <option value="percentage">Percentage (%)</option>
                                          <option value="list">List / Array</option>
                                        </select>
                                      </div>
                                      <div className="flex items-end gap-3">
                                        <label className="flex items-center gap-2 pb-1.5">
                                          <input
                                            type="checkbox"
                                            checked={field.visible}
                                            onChange={(e) => {
                                              const newConfigs = [...documentDisplayConfigs];
                                              newConfigs[configIndex].fields[fieldIndex].visible = e.target.checked;
                                              setDocumentDisplayConfigs(newConfigs);
                                            }}
                                          />
                                          <span className="text-sm">Visible</span>
                                        </label>
                                        <button
                                          onClick={() => {
                                            const newConfigs = [...documentDisplayConfigs];
                                            newConfigs[configIndex].fields = newConfigs[configIndex].fields.filter((_, i) => i !== fieldIndex);
                                            setDocumentDisplayConfigs(newConfigs);
                                          }}
                                          className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                          title="Delete field"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}

                            {/* Help Text */}
                            {config.fields.length > 0 && (
                              <div className="text-xs text-gray-500 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                                <strong>Tip:</strong> Use dot notation for nested paths (e.g., <code className="bg-yellow-100 px-1 rounded">rent.baseRentPerAcre</code>).
                                The AI will extract these fields from uploaded documents of this type.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Dropdown Options Section */}
                {activeSection === 'dropdowns' && (
                  <div className="space-y-6">
                    {dropdownConfigs.map((dropdown) => (
                      <div key={dropdown.id} className="border rounded-lg">
                        <button
                          onClick={() => toggleExpand(dropdown.id)}
                          className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                        >
                          <div>
                            <h3 className="font-medium">{dropdown.name}</h3>
                            <p className="text-sm text-gray-500">{dropdown.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge>{dropdown.options.length} options</Badge>
                            {expandedItems.has(dropdown.id) ? (
                              <ChevronDown className="w-5 h-5" />
                            ) : (
                              <ChevronRight className="w-5 h-5" />
                            )}
                          </div>
                        </button>

                        {expandedItems.has(dropdown.id) && (
                          <div className="border-t p-4 space-y-3">
                            {dropdown.options.map((option, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                              >
                                <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />

                                <div className="flex-1 grid grid-cols-3 gap-3">
                                  <input
                                    type="text"
                                    value={option.value}
                                    onChange={(e) =>
                                      updateDropdownOption(dropdown.id, index, {
                                        value: e.target.value,
                                      })
                                    }
                                    className="px-2 py-1 border rounded text-sm font-mono"
                                    placeholder="value"
                                  />
                                  <input
                                    type="text"
                                    value={option.label}
                                    onChange={(e) =>
                                      updateDropdownOption(dropdown.id, index, {
                                        label: e.target.value,
                                      })
                                    }
                                    className="px-2 py-1 border rounded text-sm"
                                    placeholder="Label"
                                  />
                                  <select
                                    value={option.color || 'gray'}
                                    onChange={(e) =>
                                      updateDropdownOption(dropdown.id, index, {
                                        color: e.target.value,
                                      })
                                    }
                                    className="px-2 py-1 border rounded text-sm"
                                  >
                                    <option value="gray">Gray</option>
                                    <option value="blue">Blue</option>
                                    <option value="green">Green</option>
                                    <option value="yellow">Yellow</option>
                                    <option value="orange">Orange</option>
                                    <option value="red">Red</option>
                                    <option value="purple">Purple</option>
                                    <option value="teal">Teal</option>
                                  </select>
                                </div>

                                <button
                                  onClick={() => deleteDropdownOption(dropdown.id, index)}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addDropdownOption(dropdown.id)}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Option
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Workflows Section */}
                {activeSection === 'workflows' && (
                  <div className="space-y-6">
                    {editingWorkflowId ? (
                      // Workflow Builder View - Full Screen
                      <div className="-m-6">
                        {/* Workflow Editor Header */}
                        <div className="flex items-center justify-between px-6 py-4 bg-white border-b">
                          <div className="flex items-center gap-4">
                            <Button
                              variant="outline"
                              onClick={() => setEditingWorkflowId(null)}
                            >
                              <ChevronRight className="w-4 h-4 mr-2 rotate-180" />
                              Back to Workflows
                            </Button>
                            <div className="h-6 w-px bg-gray-300" />
                            <div>
                              <h2 className="text-lg font-semibold">
                                {workflowConfigs.find(w => w.id === editingWorkflowId)?.name || 'Workflow Editor'}
                              </h2>
                              <p className="text-sm text-gray-500">
                                Visual workflow builder - drag nodes and connect them
                              </p>
                            </div>
                          </div>
                        </div>
                        {/* Workflow Builder */}
                        <div className="p-4 bg-gray-100">
                          {workflowConfigs.find(w => w.id === editingWorkflowId) && (
                            <WorkflowBuilder
                              workflow={workflowConfigs.find(w => w.id === editingWorkflowId) as any}
                              onChange={(updatedWorkflow) => {
                                setWorkflowConfigs(configs =>
                                  configs.map(w =>
                                    w.id === editingWorkflowId
                                      ? { ...w, ...updatedWorkflow, updatedAt: new Date() }
                                      : w
                                  )
                                );
                              }}
                              onSave={handleSave}
                              saving={saving}
                            />
                          )}
                        </div>
                      </div>
                    ) : (
                      // Workflow List View
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-sm text-gray-500">
                            Create and configure AI-powered workflows with visual builder
                          </p>
                          <Button
                            onClick={() => {
                              const newWorkflow: WorkflowConfig = {
                                id: `workflow_${Date.now()}`,
                                name: 'New Workflow',
                                description: 'Custom workflow',
                                enabled: false,
                                version: 1,
                                nodes: [],
                                connections: [],
                                variables: [],
                                triggers: [],
                                steps: [],
                                createdAt: new Date(),
                              };
                              setWorkflowConfigs([...workflowConfigs, newWorkflow]);
                              setEditingWorkflowId(newWorkflow.id);
                            }}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            New Workflow
                          </Button>
                        </div>

                        {workflowConfigs.map((workflow) => (
                          <div key={workflow.id} className="border rounded-lg hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between p-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <h3 className="font-medium text-lg">{workflow.name}</h3>
                                  <Badge variant={workflow.enabled ? 'success' : 'secondary'}>
                                    {workflow.enabled ? 'Active' : 'Draft'}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-500 mt-1">{workflow.description}</p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                                  <span>{workflow.nodes?.length || 0} nodes</span>
                                  <span>{workflow.connections?.length || 0} connections</span>
                                  {workflow.triggers?.length > 0 && (
                                    <span className="text-green-600">
                                      {workflow.triggers.filter((t: any) => t.enabled).length} active trigger(s)
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 mr-4">
                                  <input
                                    type="checkbox"
                                    checked={workflow.enabled}
                                    onChange={(e) => {
                                      setWorkflowConfigs((configs) =>
                                        configs.map((w) =>
                                          w.id === workflow.id
                                            ? { ...w, enabled: e.target.checked }
                                            : w
                                        )
                                      );
                                    }}
                                    className="w-4 h-4"
                                  />
                                  <span className="text-sm">Enabled</span>
                                </label>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditingWorkflowId(workflow.id)}
                                >
                                  <Edit2 className="w-4 h-4 mr-1" />
                                  Edit
                                </Button>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const duplicated = {
                                      ...workflow,
                                      id: `workflow_${Date.now()}`,
                                      name: `${workflow.name} (Copy)`,
                                      enabled: false,
                                    };
                                    setWorkflowConfigs([...workflowConfigs, duplicated]);
                                  }}
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>

                                {!['document_processing', 'land_acquisition', 'project_lifecycle'].includes(workflow.id) && (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                      if (confirm('Delete this workflow?')) {
                                        setWorkflowConfigs(configs => configs.filter(w => w.id !== workflow.id));
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}

                                <ChevronRight className="w-5 h-5 text-gray-400" />
                              </div>
                            </div>

                            {/* Quick preview of workflow nodes */}
                            {workflow.nodes && workflow.nodes.length > 0 && (
                              <div className="border-t px-4 py-3 bg-gray-50">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {workflow.nodes.slice(0, 6).map((node: any, i: number) => (
                                    <span key={node.id} className="flex items-center gap-1">
                                      {i > 0 && <span className="text-gray-400">→</span>}
                                      <Badge variant="outline" className="text-xs">
                                        {node.name}
                                      </Badge>
                                    </span>
                                  ))}
                                  {workflow.nodes.length > 6 && (
                                    <span className="text-xs text-gray-400">
                                      +{workflow.nodes.length - 6} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {/* DD Templates Section */}
                {activeSection === 'dd-templates' && (
                  <div className="space-y-6">
                    {ddTemplates.map((template) => (
                      <div key={template.id} className="border rounded-lg">
                        <div className="flex items-center justify-between p-4">
                          <button
                            onClick={() => toggleExpand(template.id)}
                            className="flex-1 flex items-center gap-3 text-left"
                          >
                            <div>
                              <h3 className="font-medium">{template.name}</h3>
                              <p className="text-sm text-gray-500">Category: {template.category}</p>
                            </div>
                          </button>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={template.enabled}
                                onChange={(e) => {
                                  setDdTemplates((templates) =>
                                    templates.map((t) =>
                                      t.id === template.id
                                        ? { ...t, enabled: e.target.checked }
                                        : t
                                    )
                                  );
                                }}
                                className="w-4 h-4"
                              />
                              <span className="text-sm font-medium">Enabled</span>
                            </label>
                            <Badge>{template.checklist.length} items</Badge>
                            {expandedItems.has(template.id) ? (
                              <ChevronDown className="w-5 h-5" />
                            ) : (
                              <ChevronRight className="w-5 h-5" />
                            )}
                          </div>
                        </div>

                        {expandedItems.has(template.id) && (
                          <div className="border-t p-4 space-y-3">
                            {template.checklist.map((item, index) => (
                              <div
                                key={item.id}
                                className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                              >
                                <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />

                                <div className="flex-1">
                                  <input
                                    type="text"
                                    value={item.item}
                                    onChange={(e) => {
                                      setDdTemplates((templates) =>
                                        templates.map((t) =>
                                          t.id === template.id
                                            ? {
                                                ...t,
                                                checklist: t.checklist.map((c, i) =>
                                                  i === index ? { ...c, item: e.target.value } : c
                                                ),
                                              }
                                            : t
                                        )
                                      );
                                    }}
                                    className="w-full px-2 py-1 border rounded text-sm"
                                  />
                                </div>

                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={item.required}
                                    onChange={(e) => {
                                      setDdTemplates((templates) =>
                                        templates.map((t) =>
                                          t.id === template.id
                                            ? {
                                                ...t,
                                                checklist: t.checklist.map((c, i) =>
                                                  i === index
                                                    ? { ...c, required: e.target.checked }
                                                    : c
                                                ),
                                              }
                                            : t
                                        )
                                      );
                                    }}
                                  />
                                  <span className="text-sm">Required</span>
                                </label>

                                <button
                                  onClick={() => {
                                    setDdTemplates((templates) =>
                                      templates.map((t) =>
                                        t.id === template.id
                                          ? {
                                              ...t,
                                              checklist: t.checklist.filter((_, i) => i !== index),
                                            }
                                          : t
                                      )
                                    );
                                  }}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setDdTemplates((templates) =>
                                  templates.map((t) =>
                                    t.id === template.id
                                      ? {
                                          ...t,
                                          checklist: [
                                            ...t.checklist,
                                            {
                                              id: `item_${Date.now()}`,
                                              item: 'New checklist item',
                                              required: false,
                                            },
                                          ],
                                        }
                                      : t
                                  )
                                );
                              }}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Checklist Item
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* System Settings Section */}
                {activeSection === 'system' && (
                  <div className="space-y-6">
                    <div className="grid gap-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Application Name
                          </label>
                          <input
                            type="text"
                            value={systemConfig.appName}
                            onChange={(e) =>
                              setSystemConfig({ ...systemConfig, appName: e.target.value })
                            }
                            className="w-full px-3 py-2 border rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Company Name
                          </label>
                          <input
                            type="text"
                            value={systemConfig.companyName}
                            onChange={(e) =>
                              setSystemConfig({ ...systemConfig, companyName: e.target.value })
                            }
                            className="w-full px-3 py-2 border rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Support Email
                          </label>
                          <input
                            type="email"
                            value={systemConfig.supportEmail}
                            onChange={(e) =>
                              setSystemConfig({ ...systemConfig, supportEmail: e.target.value })
                            }
                            className="w-full px-3 py-2 border rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Default Currency
                          </label>
                          <select
                            value={systemConfig.defaultCurrency}
                            onChange={(e) =>
                              setSystemConfig({ ...systemConfig, defaultCurrency: e.target.value })
                            }
                            className="w-full px-3 py-2 border rounded-lg"
                          >
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (&#8364;)</option>
                            <option value="GBP">GBP (&#163;)</option>
                            <option value="INR">INR (&#8377;)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Date Format
                          </label>
                          <select
                            value={systemConfig.dateFormat}
                            onChange={(e) =>
                              setSystemConfig({ ...systemConfig, dateFormat: e.target.value })
                            }
                            className="w-full px-3 py-2 border rounded-lg"
                          >
                            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                          </select>
                        </div>
                      </div>

                      <div className="border-t pt-6">
                        <h3 className="font-medium mb-4">Feature Toggles</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={systemConfig.features.documentProcessing}
                              onChange={(e) =>
                                setSystemConfig({
                                  ...systemConfig,
                                  features: {
                                    ...systemConfig.features,
                                    documentProcessing: e.target.checked,
                                  },
                                })
                              }
                              className="w-5 h-5"
                            />
                            <div>
                              <div className="font-medium">Document Processing</div>
                              <div className="text-sm text-gray-500">
                                AI-powered document extraction
                              </div>
                            </div>
                          </label>

                          <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={systemConfig.features.workflowAutomation}
                              onChange={(e) =>
                                setSystemConfig({
                                  ...systemConfig,
                                  features: {
                                    ...systemConfig.features,
                                    workflowAutomation: e.target.checked,
                                  },
                                })
                              }
                              className="w-5 h-5"
                            />
                            <div>
                              <div className="font-medium">Workflow Automation</div>
                              <div className="text-sm text-gray-500">
                                Automated workflow orchestration
                              </div>
                            </div>
                          </label>

                          <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={systemConfig.features.aiAnalysis}
                              onChange={(e) =>
                                setSystemConfig({
                                  ...systemConfig,
                                  features: {
                                    ...systemConfig.features,
                                    aiAnalysis: e.target.checked,
                                  },
                                })
                              }
                              className="w-5 h-5"
                            />
                            <div>
                              <div className="font-medium">AI Analysis</div>
                              <div className="text-sm text-gray-500">
                                AI-powered site and lease analysis
                              </div>
                            </div>
                          </label>

                          <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={systemConfig.features.notifications}
                              onChange={(e) =>
                                setSystemConfig({
                                  ...systemConfig,
                                  features: {
                                    ...systemConfig.features,
                                    notifications: e.target.checked,
                                  },
                                })
                              }
                              className="w-5 h-5"
                            />
                            <div>
                              <div className="font-medium">Notifications</div>
                              <div className="text-sm text-gray-500">
                                Real-time alerts and notifications
                              </div>
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Admin Users Section */}
                {activeSection === 'admin-users' && (
                  <div className="space-y-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                      <div className="flex items-start gap-3">
                        <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-blue-900">Permanent Admin</h4>
                          <p className="text-sm text-blue-700 mt-1">
                            <strong>{PERMANENT_ADMIN}</strong> is the permanent admin and cannot be removed.
                            Add additional admin users below.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Add new admin */}
                    <div className="border rounded-lg p-4">
                      <h3 className="font-medium mb-3">Add New Admin</h3>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="email"
                              value={newAdminEmail}
                              onChange={(e) => setNewAdminEmail(e.target.value)}
                              placeholder="Enter email address"
                              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            />
                          </div>
                        </div>
                        <Button
                          onClick={() => {
                            if (newAdminEmail && !adminEmails.includes(newAdminEmail) && newAdminEmail !== PERMANENT_ADMIN) {
                              setAdminEmails([...adminEmails, newAdminEmail]);
                              setNewAdminEmail('');
                            }
                          }}
                          disabled={!newAdminEmail || adminEmails.includes(newAdminEmail) || newAdminEmail === PERMANENT_ADMIN}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Admin
                        </Button>
                      </div>
                      {newAdminEmail === PERMANENT_ADMIN && (
                        <p className="text-sm text-amber-600 mt-2">This email is already the permanent admin.</p>
                      )}
                      {adminEmails.includes(newAdminEmail) && newAdminEmail !== '' && (
                        <p className="text-sm text-amber-600 mt-2">This email is already an admin.</p>
                      )}
                    </div>

                    {/* Admin list */}
                    <div className="border rounded-lg">
                      <div className="p-4 border-b bg-gray-50">
                        <h3 className="font-medium">Current Admin Users</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {adminEmails.length + 1} admin user{adminEmails.length !== 0 ? 's' : ''} total
                        </p>
                      </div>
                      <div className="divide-y">
                        {/* Permanent admin - always shown first */}
                        <div className="flex items-center justify-between p-4 bg-blue-50">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                              <Shield className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <div className="font-medium">{PERMANENT_ADMIN}</div>
                              <div className="text-sm text-gray-500">Permanent Admin</div>
                            </div>
                          </div>
                          <Badge variant="info">Protected</Badge>
                        </div>

                        {/* Additional admins */}
                        {adminEmails.map((email, index) => (
                          <div key={email} className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                                <Users className="w-5 h-5 text-gray-600" />
                              </div>
                              <div>
                                <div className="font-medium">{email}</div>
                                <div className="text-sm text-gray-500">Admin User</div>
                              </div>
                            </div>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setAdminEmails(adminEmails.filter((_, i) => i !== index));
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Remove
                            </Button>
                          </div>
                        ))}

                        {adminEmails.length === 0 && (
                          <div className="p-8 text-center text-gray-500">
                            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p>No additional admin users added yet.</p>
                            <p className="text-sm mt-1">Add admin users above to grant them access to this portal.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
