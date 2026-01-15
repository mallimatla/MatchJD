'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Sun,
  FileText,
  MapPin,
  DollarSign,
  Calendar,
  Zap,
  Building2,
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { firebaseDb, firebaseAuth } from '@/lib/firebase';
import { useFormConfig, useDropdownConfig, useSystemConfig } from '@/hooks/useConfig';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Field type to icon mapping
const fieldIcons: Record<string, any> = {
  name: FileText,
  type: Zap,
  state: MapPin,
  county: MapPin,
  capacityMwAc: Zap,
  capacityMwDc: Zap,
  capexUsd: DollarSign,
  estimatedCapex: DollarSign,
  targetCod: Calendar,
  description: FileText,
};

// Group fields into sections for better organization
const getFieldSection = (fieldName: string): string => {
  const sections: Record<string, string[]> = {
    'Basic Information': ['name', 'type', 'description'],
    'Location': ['state', 'county', 'address', 'latitude', 'longitude'],
    'Technical Specifications': ['capacityMwAc', 'capacityMwDc', 'capacity'],
    'Financial': ['capexUsd', 'estimatedCapex', 'budget', 'cost'],
    'Timeline': ['targetCod', 'startDate', 'endDate', 'deadline'],
  };

  for (const [section, fields] of Object.entries(sections)) {
    if (fields.some(f => fieldName.toLowerCase().includes(f.toLowerCase()))) {
      return section;
    }
  }
  return 'Additional Information';
};

// Determine if fields should be in a row together
const shouldGroupFields = (field1: string, field2: string): boolean => {
  const pairs = [
    ['state', 'county'],
    ['capacityMwAc', 'capacityMwDc'],
    ['latitude', 'longitude'],
    ['startDate', 'endDate'],
  ];
  return pairs.some(pair =>
    (pair.includes(field1.toLowerCase()) && pair.includes(field2.toLowerCase()))
  );
};

export default function NewProjectPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Load dynamic form configuration
  const { visibleFields, loading: configLoading } = useFormConfig('project');
  const { options: projectTypeOptions } = useDropdownConfig('projectType');
  const { config: systemConfig } = useSystemConfig();

  // Group fields by section
  const groupedFields = useMemo(() => {
    const groups: Record<string, typeof visibleFields> = {};

    visibleFields.forEach(field => {
      const section = field.section || getFieldSection(field.name);
      if (!groups[section]) {
        groups[section] = [];
      }
      groups[section].push(field);
    });

    // Sort sections in a logical order
    const sectionOrder = ['Basic Information', 'Location', 'Technical Specifications', 'Financial', 'Timeline', 'Additional Information'];
    const sortedGroups: Record<string, typeof visibleFields> = {};

    sectionOrder.forEach(section => {
      if (groups[section]) {
        sortedGroups[section] = groups[section];
      }
    });

    // Add any remaining sections
    Object.keys(groups).forEach(section => {
      if (!sortedGroups[section]) {
        sortedGroups[section] = groups[section];
      }
    });

    return sortedGroups;
  }, [visibleFields]);

  // Initialize form data with default values when config loads
  useEffect(() => {
    if (visibleFields.length > 0) {
      const initialData: Record<string, any> = {};
      visibleFields.forEach(field => {
        initialData[field.name] = field.defaultValue || '';
      });
      setFormData(initialData);
    }
  }, [visibleFields]);

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    // Clear error when user starts typing
    if (errors[fieldName]) {
      setErrors(prev => ({ ...prev, [fieldName]: '' }));
    }
  };

  const handleFieldBlur = (fieldName: string) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    visibleFields.forEach(field => {
      if (field.required && !formData[field.name]) {
        newErrors[field.name] = `${field.label} is required`;
      }
      if (field.validation?.min && Number(formData[field.name]) < field.validation.min) {
        newErrors[field.name] = `Minimum value is ${field.validation.min}`;
      }
      if (field.validation?.max && Number(formData[field.name]) > field.validation.max) {
        newErrors[field.name] = `Maximum value is ${field.validation.max}`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const user = firebaseAuth.currentUser;
    if (!user) return;

    setIsLoading(true);
    try {
      // Process form data - convert numbers
      const processedData: Record<string, any> = {};
      visibleFields.forEach(field => {
        const value = formData[field.name];
        if (field.type === 'number' || field.type === 'currency') {
          processedData[field.name] = parseFloat(value) || 0;
        } else if (field.type === 'checkbox') {
          processedData[field.name] = Boolean(value);
        } else {
          processedData[field.name] = value || '';
        }
      });

      const docRef = await addDoc(collection(firebaseDb, 'projects'), {
        ...processedData,
        tenantId: user.uid,
        status: 'prospecting',
        latitude: 0,
        longitude: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      router.push(`/projects/${docRef.id}`);
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get icon for field
  const getFieldIcon = (fieldName: string) => {
    const IconComponent = fieldIcons[fieldName];
    return IconComponent ? <IconComponent className="w-4 h-4 text-gray-400" /> : null;
  };

  // Render a field based on its configuration
  const renderField = (field: any) => {
    const hasError = touched[field.name] && errors[field.name];
    const baseClasses = cn(
      "w-full px-4 py-3 border rounded-xl transition-all duration-200",
      "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
      "placeholder:text-gray-400",
      hasError ? "border-red-300 bg-red-50" : "border-gray-200 bg-white hover:border-gray-300"
    );

    const icon = getFieldIcon(field.name);

    switch (field.type) {
      case 'textarea':
        return (
          <div className="relative">
            <textarea
              value={formData[field.name] || ''}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              onBlur={() => handleFieldBlur(field.name)}
              className={cn(baseClasses, "min-h-[120px] resize-none")}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
              required={field.required}
            />
          </div>
        );

      case 'select':
        const options = field.name === 'type' && projectTypeOptions.length > 0
          ? projectTypeOptions
          : (field.options || []).map((opt: string) => ({ value: opt, label: opt }));

        return (
          <div className="relative">
            {icon && <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">{icon}</div>}
            <select
              value={formData[field.name] || ''}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              onBlur={() => handleFieldBlur(field.name)}
              className={cn(baseClasses, icon && "pl-11", "appearance-none cursor-pointer")}
              required={field.required}
            >
              <option value="">Select {field.label}</option>
              {options.map((opt: any) => (
                <option key={typeof opt === 'string' ? opt : opt.value} value={typeof opt === 'string' ? opt : opt.value}>
                  {typeof opt === 'string' ? opt : opt.label}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        );

      case 'number':
      case 'currency':
        return (
          <div className="relative">
            {field.type === 'currency' && (
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                {systemConfig.defaultCurrency === 'USD' ? '$' : systemConfig.defaultCurrency === 'EUR' ? '€' : '₹'}
              </div>
            )}
            {field.type === 'number' && icon && (
              <div className="absolute left-4 top-1/2 -translate-y-1/2">{icon}</div>
            )}
            <input
              type="number"
              value={formData[field.name] || ''}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              onBlur={() => handleFieldBlur(field.name)}
              className={cn(baseClasses, (field.type === 'currency' || icon) && "pl-11")}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              step={field.type === 'currency' ? '0.01' : '0.1'}
              required={field.required}
            />
          </div>
        );

      case 'date':
        return (
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={formData[field.name] || ''}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              onBlur={() => handleFieldBlur(field.name)}
              className={cn(baseClasses, "pl-11")}
              required={field.required}
            />
          </div>
        );

      case 'checkbox':
        return (
          <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={formData[field.name] || false}
              onChange={(e) => handleFieldChange(field.name, e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-gray-700">{field.helpText || field.label}</span>
          </label>
        );

      case 'email':
        return (
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
            </svg>
            <input
              type="email"
              value={formData[field.name] || ''}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              onBlur={() => handleFieldBlur(field.name)}
              className={cn(baseClasses, "pl-11")}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              required={field.required}
            />
          </div>
        );

      default: // text
        return (
          <div className="relative">
            {icon && <div className="absolute left-4 top-1/2 -translate-y-1/2">{icon}</div>}
            <input
              type="text"
              value={formData[field.name] || ''}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              onBlur={() => handleFieldBlur(field.name)}
              className={cn(baseClasses, icon && "pl-11")}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              required={field.required}
            />
          </div>
        );
    }
  };

  // Calculate progress
  const filledFields = visibleFields.filter(f => formData[f.name]).length;
  const requiredFields = visibleFields.filter(f => f.required);
  const filledRequired = requiredFields.filter(f => formData[f.name]).length;
  const progress = visibleFields.length > 0 ? Math.round((filledFields / visibleFields.length) * 100) : 0;

  if (configLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-500">Loading form configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
                <span>{filledRequired}/{requiredFields.length} required fields</span>
                <CheckCircle2 className={cn(
                  "w-4 h-4",
                  filledRequired === requiredFields.length ? "text-green-500" : "text-gray-300"
                )} />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
            <Sun className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Create New Project</h1>
          <p className="text-gray-500 mt-2">Fill in the details below to create a new solar project</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Form Progress</span>
            <span className="text-sm font-medium text-primary">{progress}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-blue-400 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Form Sections */}
          <div className="space-y-6">
            {Object.entries(groupedFields).map(([sectionName, fields]) => (
              <Card key={sectionName} className="overflow-hidden border-0 shadow-sm">
                <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-4 border-b">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                      {sectionName === 'Basic Information' && <FileText className="w-4 h-4 text-primary" />}
                      {sectionName === 'Location' && <MapPin className="w-4 h-4 text-primary" />}
                      {sectionName === 'Technical Specifications' && <Zap className="w-4 h-4 text-primary" />}
                      {sectionName === 'Financial' && <DollarSign className="w-4 h-4 text-primary" />}
                      {sectionName === 'Timeline' && <Calendar className="w-4 h-4 text-primary" />}
                      {sectionName === 'Additional Information' && <Info className="w-4 h-4 text-primary" />}
                    </div>
                    <div>
                      <h2 className="font-semibold text-gray-900">{sectionName}</h2>
                      <p className="text-xs text-gray-500">{fields.length} field{fields.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </div>
                <CardContent className="p-6">
                  <div className="grid gap-6">
                    {/* Render fields - try to pair them in grid */}
                    {(() => {
                      const rows: JSX.Element[] = [];
                      let i = 0;

                      while (i < fields.length) {
                        const field = fields[i];
                        const nextField = fields[i + 1];

                        // Check if this field should be full width
                        const isFullWidth = field.type === 'textarea' || field.type === 'checkbox';

                        // Check if current and next field should be grouped
                        const shouldGroup = nextField &&
                          !isFullWidth &&
                          nextField.type !== 'textarea' as any &&
                          nextField.type !== 'checkbox' as any &&
                          (shouldGroupFields(field.name, nextField.name) ||
                           (field.type !== 'textarea' as any && nextField.type !== 'textarea' as any));

                        if (isFullWidth) {
                          rows.push(
                            <div key={field.id} className="col-span-2">
                              {field.type !== 'checkbox' && (
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                  {field.label}
                                  {field.required && <span className="text-red-500">*</span>}
                                  {field.helpText && (
                                    <span className="text-xs text-gray-400 font-normal">({field.helpText})</span>
                                  )}
                                </label>
                              )}
                              {renderField(field)}
                              {touched[field.name] && errors[field.name] && (
                                <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  {errors[field.name]}
                                </p>
                              )}
                            </div>
                          );
                          i++;
                        } else if (shouldGroup && nextField) {
                          rows.push(
                            <div key={`${field.id}-${nextField.id}`} className="grid grid-cols-2 gap-4 col-span-2">
                              <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                  {field.label}
                                  {field.required && <span className="text-red-500">*</span>}
                                </label>
                                {renderField(field)}
                                {touched[field.name] && errors[field.name] && (
                                  <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {errors[field.name]}
                                  </p>
                                )}
                              </div>
                              <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                  {nextField.label}
                                  {nextField.required && <span className="text-red-500">*</span>}
                                </label>
                                {renderField(nextField)}
                                {touched[nextField.name] && errors[nextField.name] && (
                                  <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {errors[nextField.name]}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                          i += 2;
                        } else {
                          rows.push(
                            <div key={field.id} className="col-span-2 sm:col-span-1">
                              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                {field.label}
                                {field.required && <span className="text-red-500">*</span>}
                              </label>
                              {renderField(field)}
                              {touched[field.name] && errors[field.name] && (
                                <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  {errors[field.name]}
                                </p>
                              )}
                            </div>
                          );
                          i++;
                        }
                      }

                      return rows;
                    })()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12 text-base"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 h-12 text-base bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Creating Project...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Create Project
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Info Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Fields marked with <span className="text-red-500">*</span> are required</p>
          <p className="mt-1">Form fields can be customized in the Admin Portal</p>
        </div>
      </main>
    </div>
  );
}
