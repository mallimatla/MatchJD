'use client';

import { useState, useEffect } from 'react';
import {
  User,
  Calendar,
  MapPin,
  DollarSign,
  Building,
  FileText,
  Zap,
  Hash,
  List,
  Percent,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase';
import { cn } from '@/lib/utils';

// Types
interface DocumentDisplayField {
  path: string;
  label: string;
  type: 'text' | 'currency' | 'date' | 'percentage' | 'number' | 'list';
  visible: boolean;
  order: number;
}

interface DocumentDisplayConfig {
  category: string;
  label: string;
  fields: DocumentDisplayField[];
}

// Helper to get nested value from object using dot notation
// Also tries to extract meaningful values from objects (like .name or .value)
function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;

  // First try the exact path
  let value = path.split('.').reduce((current, key) => current?.[key], obj);

  // If value is an object, try to extract a meaningful value
  if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
    // Common nested properties to look for
    if (value.name !== undefined) return value.name;
    if (value.value !== undefined) return value.value;
    if (value.amount !== undefined) return value.amount;
    if (value.total !== undefined) return value.total;
    // If it has a single key, return that value
    const keys = Object.keys(value);
    if (keys.length === 1) return value[keys[0]];
  }

  return value;
}

// Smart value extractor - tries multiple paths to find data
function extractValue(data: any, path: string): any {
  if (!data || !path) return undefined;

  // Try exact path first
  let value = getNestedValue(data, path);
  if (value !== undefined && value !== null) return value;

  // Try path.name (for nested party objects)
  value = getNestedValue(data, `${path}.name`);
  if (value !== undefined && value !== null) return value;

  // Try path.value
  value = getNestedValue(data, `${path}.value`);
  if (value !== undefined && value !== null) return value;

  // For price-related fields, try nested price object
  if (path.toLowerCase().includes('price') || path.toLowerCase().includes('cost')) {
    value = getNestedValue(data, `price.${path}`);
    if (value !== undefined && value !== null) return value;
    value = getNestedValue(data, `price.contractPrice`);
    if (value !== undefined && value !== null) return value;
  }

  // For escalation fields
  if (path.toLowerCase().includes('escalation')) {
    value = getNestedValue(data, `price.annualEscalation`);
    if (value !== undefined && value !== null) return value;
    value = getNestedValue(data, `rent.annualEscalationPercent`);
    if (value !== undefined && value !== null) return value;
  }

  return undefined;
}

// Format value based on type
function formatValue(value: any, type: string): string {
  if (value === null || value === undefined) return 'N/A';

  switch (type) {
    case 'currency':
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      if (isNaN(numValue)) return 'N/A';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(numValue);

    case 'percentage':
      const pctValue = typeof value === 'string' ? parseFloat(value) : value;
      if (isNaN(pctValue)) return 'N/A';
      return `${pctValue}%`;

    case 'number':
      const num = typeof value === 'string' ? parseFloat(value) : value;
      if (isNaN(num)) return 'N/A';
      return num.toLocaleString();

    case 'date':
      if (!value) return 'N/A';
      try {
        const date = new Date(value);
        if (isNaN(date.getTime())) return String(value);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      } catch {
        return String(value);
      }

    case 'list':
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      return String(value);

    default:
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value);
  }
}

// Get icon for field type
function getFieldIcon(type: string) {
  switch (type) {
    case 'currency':
      return DollarSign;
    case 'date':
      return Calendar;
    case 'percentage':
      return Percent;
    case 'number':
      return Hash;
    case 'list':
      return List;
    default:
      return FileText;
  }
}

// Compact data preview for inline display
export function CompactDocumentPreview({
  category,
  data,
}: {
  category: string;
  data: any;
}) {
  const [config, setConfig] = useState<DocumentDisplayConfig | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(firebaseDb, 'config', 'documentDisplay'),
      (snapshot) => {
        if (snapshot.exists()) {
          const configs = snapshot.data().configs as DocumentDisplayConfig[];
          const displayConfig = configs.find((c) => c.category === category);
          setConfig(displayConfig || null);
        }
      },
      (err) => {
        console.error('Error loading document display config:', err);
      }
    );

    return () => unsubscribe();
  }, [category]);

  if (!data || Object.keys(data).length === 0) {
    return (
      <span className="text-gray-400 italic text-xs">No extracted data</span>
    );
  }

  // Get visible fields sorted by order, take first 5
  const visibleFields = config?.fields
    .filter((f) => f.visible)
    .sort((a, b) => a.order - b.order)
    .slice(0, 5) || [];

  // If no config, show generic fields
  if (visibleFields.length === 0) {
    const entries = Object.entries(data).slice(0, 4);
    return (
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {entries.map(([key, value], i) => {
          if (typeof value === 'object' && value !== null) {
            // Try to get a name or value from nested object
            const displayValue = (value as any).name || (value as any).value || JSON.stringify(value);
            return (
              <span key={i} className="text-gray-600">
                <span className="text-gray-400">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}:
                </span>{' '}
                <span className="font-medium text-gray-700">{displayValue}</span>
              </span>
            );
          }
          return (
            <span key={i} className="text-gray-600">
              <span className="text-gray-400">
                {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}:
              </span>{' '}
              <span className="font-medium text-gray-700">{String(value)}</span>
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {visibleFields.map((field, i) => {
        const value = extractValue(data, field.path);
        if (value === undefined || value === null) return null;

        return (
          <span key={i} className="text-gray-600">
            <span className="text-gray-400">{field.label}:</span>{' '}
            <span className="font-medium text-gray-700">
              {formatValue(value, field.type)}
            </span>
          </span>
        );
      })}
    </div>
  );
}

// Full document data display - dynamic grid layout
export function DocumentDataDisplay({
  category,
  data,
  variant = 'full',
  className,
}: {
  category: string;
  data: any;
  variant?: 'full' | 'compact' | 'card';
  className?: string;
}) {
  const [config, setConfig] = useState<DocumentDisplayConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

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

  if (loading) {
    return (
      <div className={cn('animate-pulse', className)}>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || Object.keys(data).length === 0) {
    return (
      <div className={cn('text-center py-8 text-gray-500', className)}>
        <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
        <p>No extracted data available</p>
      </div>
    );
  }

  // Get visible fields sorted by order
  const visibleFields = config?.fields
    .filter((f) => f.visible)
    .sort((a, b) => a.order - b.order) || [];

  // If no config found, fall back to showing raw data
  if (!config || visibleFields.length === 0) {
    return (
      <div className={cn('space-y-3', className)}>
        <p className="text-sm text-gray-500 italic">
          No display configuration found for category: {category}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(data).slice(0, 10).map(([key, value], i) => (
            <div key={i} className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">
                {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
              </div>
              <div className="font-medium text-sm">
                {typeof value === 'object' && value !== null
                  ? (value as any).name || JSON.stringify(value)
                  : String(value)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Card variant - collapsible
  if (variant === 'card') {
    return (
      <div className={cn('border rounded-lg overflow-hidden', className)}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-500" />
            <span className="font-medium">{config.label} Data</span>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </button>
        {expanded && (
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {visibleFields.map((field, i) => {
                const value = extractValue(data, field.path);
                const Icon = getFieldIcon(field.type);

                return (
                  <div key={i} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                      <Icon className="w-3 h-3" />
                      {field.label}
                    </div>
                    <div className="font-medium text-sm">
                      {formatValue(value, field.type)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    return (
      <div className={cn('flex flex-wrap gap-3', className)}>
        {visibleFields.slice(0, 6).map((field, i) => {
          const value = extractValue(data, field.path);

          return (
            <div key={i} className="text-sm">
              <span className="text-gray-500">{field.label}:</span>{' '}
              <span className="font-medium">{formatValue(value, field.type)}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // Full variant - grid layout with colored backgrounds
  const colorSchemes = [
    'bg-blue-50 text-blue-700',
    'bg-green-50 text-green-700',
    'bg-purple-50 text-purple-700',
    'bg-orange-50 text-orange-700',
    'bg-teal-50 text-teal-700',
    'bg-pink-50 text-pink-700',
    'bg-indigo-50 text-indigo-700',
    'bg-amber-50 text-amber-700',
  ];

  // Check if any configured fields have actual data
  const fieldsWithData = visibleFields.filter((field) => {
    const value = extractValue(data, field.path);
    return value !== undefined && value !== null;
  });

  // If no configured fields have data, show raw extracted data instead
  if (fieldsWithData.length === 0 && Object.keys(data).length > 0) {
    return (
      <div className={cn('space-y-3', className)}>
        <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
          Note: Configured field paths don&apos;t match extracted data. Showing raw extraction results:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(data).slice(0, 12).map(([key, value], i) => {
            const colorScheme = colorSchemes[i % colorSchemes.length];
            const [bgColor, textColor] = colorScheme.split(' ');

            // Format the key for display
            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());

            // Format the value - handle nested objects
            let displayValue: string;
            if (value === null || value === undefined) {
              displayValue = 'N/A';
            } else if (typeof value === 'object' && !Array.isArray(value)) {
              displayValue = (value as any).name || (value as any).value || JSON.stringify(value);
            } else if (Array.isArray(value)) {
              displayValue = value.join(', ') || 'Empty';
            } else {
              displayValue = String(value);
            }

            return (
              <div key={i} className={cn('p-3 rounded-lg', bgColor)}>
                <div className={cn('flex items-center gap-2 font-medium text-sm mb-1', textColor)}>
                  <FileText className="w-3.5 h-3.5" />
                  {label}
                </div>
                <div className="text-sm text-gray-900 font-medium">
                  {displayValue}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {visibleFields.map((field, i) => {
          const value = extractValue(data, field.path);
          const Icon = getFieldIcon(field.type);
          const colorScheme = colorSchemes[i % colorSchemes.length];
          const [bgColor, textColor] = colorScheme.split(' ');

          return (
            <div key={i} className={cn('p-3 rounded-lg', bgColor)}>
              <div className={cn('flex items-center gap-2 font-medium text-sm mb-1', textColor)}>
                <Icon className="w-3.5 h-3.5" />
                {field.label}
              </div>
              <div className="text-sm text-gray-900 font-medium">
                {formatValue(value, field.type)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Hook for getting all document display configs
export function useAllDocumentDisplayConfigs() {
  const [configs, setConfigs] = useState<DocumentDisplayConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(firebaseDb, 'config', 'documentDisplay'),
      (snapshot) => {
        if (snapshot.exists()) {
          setConfigs(snapshot.data().configs as DocumentDisplayConfig[] || []);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error loading document display configs:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Helper to get config by category
  const getConfig = (category: string): DocumentDisplayConfig | undefined => {
    return configs.find((c) => c.category === category);
  };

  // Helper to get category label
  const getCategoryLabel = (category: string): string => {
    const config = getConfig(category);
    return config?.label || category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return { configs, loading, getConfig, getCategoryLabel };
}

export default DocumentDataDisplay;
