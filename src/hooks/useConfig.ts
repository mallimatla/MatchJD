'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase';

// Types for configuration
export interface FieldConfig {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date' | 'textarea' | 'checkbox' | 'email' | 'currency';
  required: boolean;
  placeholder?: string;
  options?: string[];
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

export interface FormConfig {
  id: string;
  name: string;
  description: string;
  fields: FieldConfig[];
}

export interface DocumentDisplayField {
  path: string;
  label: string;
  type: 'text' | 'currency' | 'date' | 'percentage' | 'number' | 'list';
  visible: boolean;
  order: number;
}

export interface DocumentDisplayConfig {
  category: string;
  label: string;
  fields: DocumentDisplayField[];
}

export interface DropdownOption {
  value: string;
  label: string;
  color?: string;
}

export interface DropdownConfig {
  id: string;
  name: string;
  description: string;
  options: DropdownOption[];
}

export interface WorkflowStepConfig {
  id: string;
  name: string;
  label: string;
  description: string;
  requiresHitl: boolean;
  enabled: boolean;
}

export interface WorkflowConfig {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
  steps: WorkflowStepConfig[];
}

export interface DDChecklistItem {
  id: string;
  item: string;
  required: boolean;
}

export interface DDTemplate {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
  checklist: DDChecklistItem[];
}

export interface SystemConfig {
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

// Default configurations (fallbacks)
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

// Hook to get form configuration
export function useFormConfig(formId: string) {
  const [config, setConfig] = useState<FormConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(firebaseDb, 'config', 'forms'),
      (snapshot) => {
        if (snapshot.exists()) {
          const configs = snapshot.data().configs as FormConfig[];
          const formConfig = configs.find((c) => c.id === formId);
          setConfig(formConfig || null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error loading form config:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [formId]);

  // Get visible fields sorted by order
  const visibleFields = config?.fields
    .filter((f) => f.visible)
    .sort((a, b) => a.order - b.order) || [];

  return { config, visibleFields, loading, error };
}

// Hook to get document display configuration
export function useDocumentDisplayConfig(category: string) {
  const [config, setConfig] = useState<DocumentDisplayConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(firebaseDb, 'config', 'documentDisplay'),
      (snapshot) => {
        if (snapshot.exists()) {
          const configs = snapshot.data().configs as DocumentDisplayConfig[];
          const displayConfig = configs.find((c) => c.category === category);
          setConfig(displayConfig || null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error loading document display config:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [category]);

  // Get visible fields sorted by order
  const visibleFields = config?.fields
    .filter((f) => f.visible)
    .sort((a, b) => a.order - b.order) || [];

  return { config, visibleFields, loading };
}

// Hook to get dropdown options
export function useDropdownConfig(dropdownId: string) {
  const [config, setConfig] = useState<DropdownConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(firebaseDb, 'config', 'dropdowns'),
      (snapshot) => {
        if (snapshot.exists()) {
          const configs = snapshot.data().configs as DropdownConfig[];
          const dropdownConfig = configs.find((c) => c.id === dropdownId);
          setConfig(dropdownConfig || null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error loading dropdown config:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [dropdownId]);

  return { config, options: config?.options || [], loading };
}

// Hook to get all dropdown configs
export function useAllDropdownConfigs() {
  const [configs, setConfigs] = useState<DropdownConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(firebaseDb, 'config', 'dropdowns'),
      (snapshot) => {
        if (snapshot.exists()) {
          setConfigs(snapshot.data().configs as DropdownConfig[] || []);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error loading dropdown configs:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Helper to get options by dropdown ID
  const getOptions = (dropdownId: string): DropdownOption[] => {
    const config = configs.find((c) => c.id === dropdownId);
    return config?.options || [];
  };

  // Helper to get label for a value
  const getLabel = (dropdownId: string, value: string): string => {
    const options = getOptions(dropdownId);
    return options.find((o) => o.value === value)?.label || value;
  };

  // Helper to get color for a value
  const getColor = (dropdownId: string, value: string): string => {
    const options = getOptions(dropdownId);
    return options.find((o) => o.value === value)?.color || 'gray';
  };

  return { configs, loading, getOptions, getLabel, getColor };
}

// Hook to get workflow configuration
export function useWorkflowConfig(workflowId?: string) {
  const [configs, setConfigs] = useState<WorkflowConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(firebaseDb, 'config', 'workflows'),
      (snapshot) => {
        if (snapshot.exists()) {
          setConfigs(snapshot.data().configs as WorkflowConfig[] || []);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error loading workflow config:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Get specific workflow
  const workflow = workflowId ? configs.find((c) => c.id === workflowId) : null;

  // Get enabled workflows
  const enabledWorkflows = configs.filter((c) => c.enabled);

  // Check if workflow is enabled
  const isEnabled = (id: string): boolean => {
    const config = configs.find((c) => c.id === id);
    return config?.enabled ?? true;
  };

  // Get enabled steps for a workflow
  const getEnabledSteps = (id: string): WorkflowStepConfig[] => {
    const config = configs.find((c) => c.id === id);
    return config?.steps.filter((s) => s.enabled) || [];
  };

  return { configs, workflow, enabledWorkflows, loading, isEnabled, getEnabledSteps };
}

// Hook to get DD templates
export function useDDTemplates() {
  const [templates, setTemplates] = useState<DDTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(firebaseDb, 'config', 'ddTemplates'),
      (snapshot) => {
        if (snapshot.exists()) {
          setTemplates(snapshot.data().configs as DDTemplate[] || []);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error loading DD templates:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Get enabled templates
  const enabledTemplates = templates.filter((t) => t.enabled);

  // Get template by ID
  const getTemplate = (id: string): DDTemplate | undefined => {
    return templates.find((t) => t.id === id);
  };

  return { templates, enabledTemplates, loading, getTemplate };
}

// Hook to get system configuration
export function useSystemConfig() {
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(firebaseDb, 'config', 'system'),
      (snapshot) => {
        if (snapshot.exists()) {
          setConfig(snapshot.data() as SystemConfig);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error loading system config:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Feature check helpers
  const isFeatureEnabled = (feature: keyof SystemConfig['features']): boolean => {
    return config.features[feature] ?? true;
  };

  return { config, loading, isFeatureEnabled };
}

// Helper function to get nested value from object using dot notation
export function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Helper function to format value based on type
export function formatConfigValue(value: any, type: string, config?: SystemConfig): string {
  if (value === null || value === undefined) return 'N/A';

  const currency = config?.defaultCurrency || 'USD';
  const dateFormat = config?.dateFormat || 'MM/DD/YYYY';

  switch (type) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
      }).format(Number(value));

    case 'percentage':
      return `${Number(value)}%`;

    case 'number':
      return Number(value).toLocaleString();

    case 'date':
      if (!value) return 'N/A';
      const date = new Date(value);
      if (dateFormat === 'DD/MM/YYYY') {
        return date.toLocaleDateString('en-GB');
      } else if (dateFormat === 'YYYY-MM-DD') {
        return date.toISOString().split('T')[0];
      }
      return date.toLocaleDateString('en-US');

    case 'list':
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      return String(value);

    default:
      return String(value);
  }
}

// One-time fetch functions for server-side or initial load
export async function fetchFormConfig(formId: string): Promise<FormConfig | null> {
  try {
    const snapshot = await getDoc(doc(firebaseDb, 'config', 'forms'));
    if (snapshot.exists()) {
      const configs = snapshot.data().configs as FormConfig[];
      return configs.find((c) => c.id === formId) || null;
    }
  } catch (error) {
    console.error('Error fetching form config:', error);
  }
  return null;
}

export async function fetchDropdownOptions(dropdownId: string): Promise<DropdownOption[]> {
  try {
    const snapshot = await getDoc(doc(firebaseDb, 'config', 'dropdowns'));
    if (snapshot.exists()) {
      const configs = snapshot.data().configs as DropdownConfig[];
      const config = configs.find((c) => c.id === dropdownId);
      return config?.options || [];
    }
  } catch (error) {
    console.error('Error fetching dropdown options:', error);
  }
  return [];
}

export async function fetchSystemConfig(): Promise<SystemConfig> {
  try {
    const snapshot = await getDoc(doc(firebaseDb, 'config', 'system'));
    if (snapshot.exists()) {
      return snapshot.data() as SystemConfig;
    }
  } catch (error) {
    console.error('Error fetching system config:', error);
  }
  return DEFAULT_SYSTEM_CONFIG;
}
