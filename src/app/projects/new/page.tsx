'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Sun, CheckCircle2 } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { firebaseDb, firebaseAuth } from '@/lib/firebase';
import { useFormConfig, useDropdownConfig, useSystemConfig } from '@/hooks/useConfig';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function NewProjectPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [initialized, setInitialized] = useState(false);

  const { visibleFields, loading: configLoading } = useFormConfig('project');
  const { options: projectTypeOptions } = useDropdownConfig('projectType');
  const { config: systemConfig } = useSystemConfig();

  // Initialize form data
  useEffect(() => {
    if (visibleFields.length > 0 && !initialized) {
      const initialData: Record<string, any> = {};
      visibleFields.forEach(field => {
        initialData[field.name] = field.defaultValue !== undefined ? field.defaultValue : '';
      });
      setFormData(initialData);
      setInitialized(true);
    }
  }, [visibleFields, initialized]);

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    if (errors[fieldName]) {
      setErrors(prev => ({ ...prev, [fieldName]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    visibleFields.forEach(field => {
      const value = formData[field.name];
      if (field.required && (value === '' || value === undefined || value === null)) {
        newErrors[field.name] = `Required`;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const user = firebaseAuth.currentUser;
    if (!user) return;

    setIsLoading(true);
    try {
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

  const renderField = (field: any) => {
    const value = formData[field.name] !== undefined ? formData[field.name] : '';
    const hasError = errors[field.name];

    const inputClass = cn(
      "w-full px-3 py-2 border rounded-lg text-sm transition-colors",
      "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
      hasError ? "border-red-300 bg-red-50" : "border-gray-300 hover:border-gray-400"
    );

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className={cn(inputClass, "min-h-[80px] resize-none")}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
          />
        );

      case 'select':
        const options = field.name === 'type' && projectTypeOptions.length > 0
          ? projectTypeOptions
          : (field.options || []).map((opt: string) => ({
              value: opt,
              label: opt.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
            }));

        return (
          <select
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className={cn(inputClass, "bg-white cursor-pointer")}
          >
            <option value="">Select...</option>
            {options.map((opt: any) => (
              <option key={opt.value || opt} value={opt.value || opt}>
                {opt.label || opt}
              </option>
            ))}
          </select>
        );

      case 'number':
      case 'currency':
        return (
          <div className="relative">
            {field.type === 'currency' && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                {systemConfig?.defaultCurrency === 'EUR' ? '€' : systemConfig?.defaultCurrency === 'INR' ? '₹' : '$'}
              </span>
            )}
            <input
              type="number"
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              className={cn(inputClass, field.type === 'currency' && "pl-7")}
              placeholder={field.placeholder || '0'}
              step={field.type === 'currency' ? '0.01' : '0.1'}
            />
          </div>
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className={inputClass}
          />
        );

      case 'checkbox':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => handleFieldChange(field.name, e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-sm text-gray-600">{field.helpText || 'Enable'}</span>
          </label>
        );

      default:
        return (
          <input
            type={field.type === 'email' ? 'email' : 'text'}
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className={inputClass}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
          />
        );
    }
  };

  const requiredFields = visibleFields.filter(f => f.required);
  const filledRequired = requiredFields.filter(f => {
    const val = formData[f.name];
    return val !== '' && val !== undefined && val !== null;
  }).length;

  if (configLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>{filledRequired}/{requiredFields.length} required</span>
            <CheckCircle2 className={cn(
              "w-4 h-4",
              filledRequired === requiredFields.length ? "text-green-500" : "text-gray-300"
            )} />
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Sun className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Create New Project</CardTitle>
                <p className="text-sm text-gray-500 mt-0.5">Fill in the project details</p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {visibleFields.map((field) => {
                  const isFullWidth = field.type === 'textarea';

                  return (
                    <div key={field.id} className={isFullWidth ? 'sm:col-span-2' : ''}>
                      {field.type !== 'checkbox' && (
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-0.5">*</span>}
                        </label>
                      )}
                      {renderField(field)}
                      {errors[field.name] && (
                        <p className="text-xs text-red-500 mt-1">{errors[field.name]}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    'Create Project'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
