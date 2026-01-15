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
} from 'lucide-react';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Admin emails - users with these emails can access admin (add your admin emails here)
const ADMIN_EMAILS = ['admin@example.com', 'admin@neurogrid.com'];

type AdminSection = 'forms' | 'documents' | 'dropdowns' | 'workflows' | 'dd-templates' | 'system';

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
  steps: {
    id: string;
    name: string;
    label: string;
    description: string;
    requiresHitl: boolean;
    enabled: boolean;
  }[];
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

  // UI states
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [editingField, setEditingField] = useState<string | null>(null);

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setAdminCheckComplete(true);
        return;
      }

      try {
        // Check if user email is in admin list
        const emailIsAdmin = ADMIN_EMAILS.includes(user.email || '');

        // Also check user document for admin role
        const userDoc = await getDoc(doc(firebaseDb, 'users', user.uid));
        const roleIsAdmin = userDoc.exists() && userDoc.data()?.role === 'admin';

        // User is admin if email matches OR has admin role in Firestore
        setIsAdmin(emailIsAdmin || roleIsAdmin);
      } catch (error) {
        console.error('Error checking admin status:', error);
        // If we can't check, allow access if email matches admin list
        setIsAdmin(ADMIN_EMAILS.includes(user.email || ''));
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

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar */}
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

          {/* Main Content */}
          <div className="col-span-9">
            <Card>
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
              <CardContent>
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
                                <div
                                  key={field.id}
                                  className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                                >
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
                    {documentDisplayConfigs.map((config) => (
                      <div key={config.category} className="border rounded-lg">
                        <button
                          onClick={() => toggleExpand(config.category)}
                          className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                        >
                          <div>
                            <h3 className="font-medium">{config.label}</h3>
                            <p className="text-sm text-gray-500">Category: {config.category}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge>{config.fields.filter(f => f.visible).length} visible</Badge>
                            {expandedItems.has(config.category) ? (
                              <ChevronDown className="w-5 h-5" />
                            ) : (
                              <ChevronRight className="w-5 h-5" />
                            )}
                          </div>
                        </button>

                        {expandedItems.has(config.category) && (
                          <div className="border-t p-4 space-y-3">
                            {config.fields
                              .sort((a, b) => a.order - b.order)
                              .map((field, index) => (
                                <div
                                  key={field.path}
                                  className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                                >
                                  <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />

                                  <div className="flex-1 grid grid-cols-4 gap-3">
                                    <input
                                      type="text"
                                      value={field.label}
                                      onChange={(e) => {
                                        const newConfigs = [...documentDisplayConfigs];
                                        const configIndex = newConfigs.findIndex(
                                          (c) => c.category === config.category
                                        );
                                        newConfigs[configIndex].fields[index].label = e.target.value;
                                        setDocumentDisplayConfigs(newConfigs);
                                      }}
                                      className="px-2 py-1 border rounded text-sm"
                                      placeholder="Label"
                                    />
                                    <input
                                      type="text"
                                      value={field.path}
                                      onChange={(e) => {
                                        const newConfigs = [...documentDisplayConfigs];
                                        const configIndex = newConfigs.findIndex(
                                          (c) => c.category === config.category
                                        );
                                        newConfigs[configIndex].fields[index].path = e.target.value;
                                        setDocumentDisplayConfigs(newConfigs);
                                      }}
                                      className="px-2 py-1 border rounded text-sm font-mono"
                                      placeholder="data.path"
                                    />
                                    <select
                                      value={field.type}
                                      onChange={(e) => {
                                        const newConfigs = [...documentDisplayConfigs];
                                        const configIndex = newConfigs.findIndex(
                                          (c) => c.category === config.category
                                        );
                                        newConfigs[configIndex].fields[index].type = e.target
                                          .value as any;
                                        setDocumentDisplayConfigs(newConfigs);
                                      }}
                                      className="px-2 py-1 border rounded text-sm"
                                    >
                                      <option value="text">Text</option>
                                      <option value="number">Number</option>
                                      <option value="currency">Currency</option>
                                      <option value="date">Date</option>
                                      <option value="percentage">Percentage</option>
                                      <option value="list">List</option>
                                    </select>
                                    <label className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={field.visible}
                                        onChange={(e) => {
                                          const newConfigs = [...documentDisplayConfigs];
                                          const configIndex = newConfigs.findIndex(
                                            (c) => c.category === config.category
                                          );
                                          newConfigs[configIndex].fields[index].visible =
                                            e.target.checked;
                                          setDocumentDisplayConfigs(newConfigs);
                                        }}
                                      />
                                      <span className="text-sm">Visible</span>
                                    </label>
                                  </div>
                                </div>
                              ))}
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
                    {workflowConfigs.map((workflow) => (
                      <div key={workflow.id} className="border rounded-lg">
                        <div className="flex items-center justify-between p-4">
                          <button
                            onClick={() => toggleExpand(workflow.id)}
                            className="flex-1 flex items-center gap-3 text-left"
                          >
                            <div>
                              <h3 className="font-medium">{workflow.name}</h3>
                              <p className="text-sm text-gray-500">{workflow.description}</p>
                            </div>
                          </button>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2">
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
                              <span className="text-sm font-medium">Enabled</span>
                            </label>
                            <Badge variant={workflow.enabled ? 'success' : 'secondary'}>
                              {workflow.enabled ? 'Active' : 'Disabled'}
                            </Badge>
                            {expandedItems.has(workflow.id) ? (
                              <ChevronDown className="w-5 h-5" />
                            ) : (
                              <ChevronRight className="w-5 h-5" />
                            )}
                          </div>
                        </div>

                        {expandedItems.has(workflow.id) && (
                          <div className="border-t p-4 space-y-3">
                            {workflow.steps.map((step, index) => (
                              <div
                                key={step.id}
                                className={cn(
                                  'flex items-center gap-4 p-3 rounded-lg',
                                  step.enabled ? 'bg-gray-50' : 'bg-gray-100 opacity-60'
                                )}
                              >
                                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">
                                  {index + 1}
                                </div>

                                <div className="flex-1">
                                  <div className="font-medium">{step.label}</div>
                                  <div className="text-sm text-gray-500">{step.description}</div>
                                </div>

                                <div className="flex items-center gap-4">
                                  {step.requiresHitl && (
                                    <Badge variant="warning">HITL Gate</Badge>
                                  )}
                                  <label className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={step.enabled}
                                      onChange={(e) => {
                                        setWorkflowConfigs((configs) =>
                                          configs.map((w) =>
                                            w.id === workflow.id
                                              ? {
                                                  ...w,
                                                  steps: w.steps.map((s) =>
                                                    s.id === step.id
                                                      ? { ...s, enabled: e.target.checked }
                                                      : s
                                                  ),
                                                }
                                              : w
                                          )
                                        );
                                      }}
                                    />
                                    <span className="text-sm">Enabled</span>
                                  </label>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
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
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
