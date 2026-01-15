'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { firebaseDb, firebaseAuth } from '@/lib/firebase';
import { useFormConfig, useDropdownConfig } from '@/hooks/useConfig';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function NewProjectPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Load dynamic form configuration
  const { visibleFields, loading: configLoading } = useFormConfig('project');
  const { options: projectTypeOptions } = useDropdownConfig('projectType');

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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  // Render a field based on its configuration
  const renderField = (field: any) => {
    const commonClasses = "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary";

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            value={formData[field.name] || ''}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className={commonClasses}
            rows={3}
            placeholder={field.placeholder}
            required={field.required}
          />
        );

      case 'select':
        // Check if this is the project type field - use dropdown config
        const options = field.name === 'type' && projectTypeOptions.length > 0
          ? projectTypeOptions
          : (field.options || []).map((opt: string) => ({ value: opt, label: opt }));

        return (
          <select
            value={formData[field.name] || ''}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className={commonClasses}
            required={field.required}
          >
            <option value="">Select {field.label}</option>
            {options.map((opt: any) => (
              <option key={typeof opt === 'string' ? opt : opt.value} value={typeof opt === 'string' ? opt : opt.value}>
                {typeof opt === 'string' ? opt : opt.label}
              </option>
            ))}
          </select>
        );

      case 'number':
      case 'currency':
        return (
          <input
            type="number"
            value={formData[field.name] || ''}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className={commonClasses}
            placeholder={field.placeholder}
            step={field.type === 'currency' ? '0.01' : '0.1'}
            required={field.required}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={formData[field.name] || ''}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className={commonClasses}
            required={field.required}
          />
        );

      case 'checkbox':
        return (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData[field.name] || false}
              onChange={(e) => handleFieldChange(field.name, e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-sm text-gray-600">{field.helpText || field.label}</span>
          </label>
        );

      case 'email':
        return (
          <input
            type="email"
            value={formData[field.name] || ''}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className={commonClasses}
            placeholder={field.placeholder}
            required={field.required}
          />
        );

      default: // text
        return (
          <input
            type="text"
            value={formData[field.name] || ''}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className={commonClasses}
            placeholder={field.placeholder}
            required={field.required}
          />
        );
    }
  };

  if (configLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Create New Project</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {visibleFields.map((field) => (
                <div key={field.id}>
                  {field.type !== 'checkbox' && (
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label} {field.required && '*'}
                    </label>
                  )}
                  {renderField(field)}
                  {field.helpText && field.type !== 'checkbox' && (
                    <p className="text-xs text-gray-500 mt-1">{field.helpText}</p>
                  )}
                </div>
              ))}

              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
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
