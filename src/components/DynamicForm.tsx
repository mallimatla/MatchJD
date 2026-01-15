'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useFormConfig, useDropdownConfig, FieldConfig } from '@/hooks/useConfig';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface DynamicFormProps {
  formId: string;
  initialValues?: Record<string, any>;
  onSubmit: (values: Record<string, any>) => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

interface FieldInputProps {
  field: FieldConfig;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  disabled?: boolean;
}

// Dynamic field input component
function FieldInput({ field, value, onChange, error, disabled }: FieldInputProps) {
  const baseInputClass = cn(
    'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-colors',
    error && 'border-red-500',
    disabled && 'bg-gray-100 cursor-not-allowed'
  );

  switch (field.type) {
    case 'text':
    case 'email':
      return (
        <input
          type={field.type}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          className={baseInputClass}
        />
      );

    case 'number':
      return (
        <input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
          placeholder={field.placeholder}
          disabled={disabled}
          min={field.validation?.min}
          max={field.validation?.max}
          className={baseInputClass}
        />
      );

    case 'currency':
      return (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
          <input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
            placeholder={field.placeholder || '0.00'}
            disabled={disabled}
            min={0}
            step="0.01"
            className={cn(baseInputClass, 'pl-7')}
          />
        </div>
      );

    case 'date':
      return (
        <input
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={baseInputClass}
        />
      );

    case 'textarea':
      return (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          rows={4}
          className={baseInputClass}
        />
      );

    case 'checkbox':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value || false}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-sm text-gray-600">{field.helpText || 'Yes'}</span>
        </label>
      );

    case 'select':
      return (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={baseInputClass}
        >
          <option value="">Select {field.label}...</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            </option>
          ))}
        </select>
      );

    default:
      return (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          className={baseInputClass}
        />
      );
  }
}

// Dropdown field that loads options from config
function ConfigDropdownField({
  field,
  value,
  onChange,
  error,
  disabled,
  dropdownId,
}: FieldInputProps & { dropdownId: string }) {
  const { options, loading } = useDropdownConfig(dropdownId);

  const baseInputClass = cn(
    'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-colors',
    error && 'border-red-500',
    disabled && 'bg-gray-100 cursor-not-allowed'
  );

  if (loading) {
    return (
      <div className={cn(baseInputClass, 'flex items-center gap-2 text-gray-400')}>
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading options...
      </div>
    );
  }

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={baseInputClass}
    >
      <option value="">Select {field.label}...</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

// Main Dynamic Form component
export function DynamicForm({
  formId,
  initialValues = {},
  onSubmit,
  onCancel,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  loading = false,
  disabled = false,
  className,
}: DynamicFormProps) {
  const { config, visibleFields, loading: configLoading } = useFormConfig(formId);
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Update values when initialValues change
  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    visibleFields.forEach((field) => {
      const value = values[field.name];

      // Required check
      if (field.required && (value === undefined || value === null || value === '')) {
        newErrors[field.name] = `${field.label} is required`;
        return;
      }

      // Email validation
      if (field.type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          newErrors[field.name] = 'Invalid email address';
        }
      }

      // Number validation
      if (field.type === 'number' && value !== undefined && value !== '') {
        const numValue = Number(value);
        if (field.validation?.min !== undefined && numValue < field.validation.min) {
          newErrors[field.name] = `Minimum value is ${field.validation.min}`;
        }
        if (field.validation?.max !== undefined && numValue > field.validation.max) {
          newErrors[field.name] = `Maximum value is ${field.validation.max}`;
        }
      }

      // Pattern validation
      if (field.validation?.pattern && value) {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(value)) {
          newErrors[field.name] = `${field.label} format is invalid`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (error) {
      console.error('Form submission error:', error);
    }
    setSubmitting(false);
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setValues((prev) => ({ ...prev, [fieldName]: value }));
    // Clear error when user starts typing
    if (errors[fieldName]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!config) {
    // Fallback - render nothing if config not found
    return (
      <div className="text-center py-8 text-gray-500">
        Form configuration not found. Please configure in Admin panel.
      </div>
    );
  }

  // Group fields by section if sections are defined
  const sections = new Map<string, FieldConfig[]>();
  visibleFields.forEach((field) => {
    const section = field.section || 'default';
    if (!sections.has(section)) {
      sections.set(section, []);
    }
    sections.get(section)!.push(field);
  });

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-6', className)}>
      {Array.from(sections.entries()).map(([sectionName, fields]) => (
        <div key={sectionName} className="space-y-4">
          {sectionName !== 'default' && (
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2">
              {sectionName.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            </h3>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((field) => (
              <div
                key={field.id}
                className={cn(
                  field.type === 'textarea' && 'md:col-span-2'
                )}
              >
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>

                <FieldInput
                  field={field}
                  value={values[field.name]}
                  onChange={(value) => handleFieldChange(field.name, value)}
                  error={errors[field.name]}
                  disabled={disabled || loading || submitting}
                />

                {field.helpText && !errors[field.name] && (
                  <p className="mt-1 text-xs text-gray-500">{field.helpText}</p>
                )}

                {errors[field.name] && (
                  <p className="mt-1 text-xs text-red-500">{errors[field.name]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting || loading}
          >
            {cancelLabel}
          </Button>
        )}
        <Button type="submit" disabled={submitting || loading || disabled}>
          {submitting || loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              {submitLabel}...
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  );
}

// Compact version for inline editing
export function DynamicFieldEditor({
  formId,
  fieldName,
  value,
  onChange,
  disabled,
}: {
  formId: string;
  fieldName: string;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
}) {
  const { config } = useFormConfig(formId);
  const field = config?.fields.find((f) => f.name === fieldName);

  if (!field) {
    return (
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-2 py-1 border rounded text-sm"
      />
    );
  }

  return (
    <FieldInput
      field={field}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
