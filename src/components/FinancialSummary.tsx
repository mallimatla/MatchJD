'use client';

import { useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  Calculator,
  PieChart,
  BarChart3,
  Info,
  Edit2,
  Save,
  X,
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { cn, formatCurrency } from '@/lib/utils';
import type { Project } from '@/types';

interface FinancialSummaryProps {
  project: Project & {
    // Extended financial fields
    ppaPrice?: number;
    ppaBuyer?: string;
    ppaTermYears?: number;
    ppaStatus?: string;
    landCostPerAcre?: number;
    epcCostPerWatt?: number;
    interconnectionCost?: number;
    developmentCost?: number;
    financingType?: 'tax_equity' | 'debt' | 'cash' | 'hybrid';
    targetIRR?: number;
    estimatedRevenue?: number;
  };
}

interface FinancialMetric {
  label: string;
  value: number | string;
  format: 'currency' | 'percent' | 'number' | 'text';
  icon?: React.ReactNode;
  description?: string;
}

function MetricCard({ metric }: { metric: FinancialMetric }) {
  const [showInfo, setShowInfo] = useState(false);

  const formatValue = () => {
    if (metric.format === 'currency' && typeof metric.value === 'number') {
      return formatCurrency(metric.value);
    }
    if (metric.format === 'percent' && typeof metric.value === 'number') {
      return `${metric.value.toFixed(1)}%`;
    }
    if (metric.format === 'number' && typeof metric.value === 'number') {
      return metric.value.toLocaleString();
    }
    return metric.value;
  };

  return (
    <div className="p-4 bg-gray-50 rounded-lg relative">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500">{metric.label}</span>
        {metric.description && (
          <button
            className="text-gray-400 hover:text-gray-600"
            onClick={() => setShowInfo(!showInfo)}
          >
            <Info className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {metric.icon}
        <span className="text-xl font-bold">{formatValue()}</span>
      </div>
      {showInfo && metric.description && (
        <div className="absolute z-10 top-full left-0 mt-1 p-2 bg-white border rounded shadow-lg text-sm text-gray-600 w-full">
          {metric.description}
        </div>
      )}
    </div>
  );
}

export function FinancialSummary({ project }: FinancialSummaryProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    estimatedCapex: project.estimatedCapex || 0,
    ppaPrice: project.ppaPrice || 0,
    landCostPerAcre: project.landCostPerAcre || 0,
    epcCostPerWatt: project.epcCostPerWatt || 0,
    interconnectionCost: project.interconnectionCost || 0,
    developmentCost: project.developmentCost || 0,
    targetIRR: project.targetIRR || 0,
  });

  // Calculate derived metrics
  const capacityMw = project.capacityMwAc || 0;
  const capacityKw = capacityMw * 1000;

  // Estimated annual generation (assume 20% capacity factor for solar)
  const capacityFactor = 0.20;
  const hoursPerYear = 8760;
  const estimatedMwhPerYear = capacityMw * capacityFactor * hoursPerYear;

  // Revenue calculation
  const ppaPrice = project.ppaPrice || 35; // $/MWh default
  const estimatedAnnualRevenue = estimatedMwhPerYear * ppaPrice;

  // Cost breakdown
  const totalCapex = project.estimatedCapex || (capacityKw * (project.epcCostPerWatt || 1.2));

  // Simple IRR proxy (not real IRR calculation)
  const simplePayback = totalCapex > 0 ? totalCapex / estimatedAnnualRevenue : 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(firebaseDb, 'projects', project.id), {
        ...formData,
        updatedAt: serverTimestamp(),
      });
      setEditing(false);
    } catch (error) {
      console.error('Error saving financial data:', error);
    }
    setSaving(false);
  };

  const primaryMetrics: FinancialMetric[] = [
    {
      label: 'Total CAPEX',
      value: totalCapex,
      format: 'currency',
      icon: <DollarSign className="w-5 h-5 text-green-600" />,
      description: 'Total capital expenditure for project construction',
    },
    {
      label: 'Capacity',
      value: `${capacityMw} MW AC`,
      format: 'text',
      icon: <BarChart3 className="w-5 h-5 text-blue-600" />,
      description: 'Nameplate AC capacity of the solar facility',
    },
    {
      label: 'Est. Annual Generation',
      value: `${Math.round(estimatedMwhPerYear).toLocaleString()} MWh`,
      format: 'text',
      icon: <TrendingUp className="w-5 h-5 text-yellow-600" />,
      description: 'Estimated annual energy production at 20% capacity factor',
    },
    {
      label: 'Est. Annual Revenue',
      value: estimatedAnnualRevenue,
      format: 'currency',
      icon: <Calculator className="w-5 h-5 text-purple-600" />,
      description: 'Projected annual revenue from PPA',
    },
  ];

  const ppaMetrics: FinancialMetric[] = [
    {
      label: 'PPA Price',
      value: ppaPrice,
      format: 'currency',
      description: 'Contracted price per MWh',
    },
    {
      label: 'PPA Buyer',
      value: project.ppaBuyer || 'Not contracted',
      format: 'text',
    },
    {
      label: 'PPA Term',
      value: project.ppaTermYears ? `${project.ppaTermYears} years` : 'TBD',
      format: 'text',
    },
    {
      label: 'PPA Status',
      value: project.ppaStatus || 'Prospecting',
      format: 'text',
    },
  ];

  const costBreakdown = [
    { label: 'EPC Cost', value: (project.epcCostPerWatt || 1.2) * capacityKw, percent: 70 },
    { label: 'Interconnection', value: project.interconnectionCost || totalCapex * 0.1, percent: 10 },
    { label: 'Development', value: project.developmentCost || totalCapex * 0.08, percent: 8 },
    { label: 'Land', value: (project.landCostPerAcre || 1000) * (capacityMw * 5), percent: 5 }, // ~5 acres/MW
    { label: 'Other', value: totalCapex * 0.07, percent: 7 },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <PieChart className="w-5 h-5" />
            Financial Summary
          </CardTitle>
          {!editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Edit2 className="w-4 h-4 mr-2" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          /* Edit Form */
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total CAPEX ($)
                </label>
                <input
                  type="number"
                  value={formData.estimatedCapex}
                  onChange={(e) => setFormData({ ...formData, estimatedCapex: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PPA Price ($/MWh)
                </label>
                <input
                  type="number"
                  value={formData.ppaPrice}
                  onChange={(e) => setFormData({ ...formData, ppaPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  EPC Cost ($/W)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.epcCostPerWatt}
                  onChange={(e) => setFormData({ ...formData, epcCostPerWatt: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Land Cost ($/acre)
                </label>
                <input
                  type="number"
                  value={formData.landCostPerAcre}
                  onChange={(e) => setFormData({ ...formData, landCostPerAcre: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Interconnection Cost ($)
                </label>
                <input
                  type="number"
                  value={formData.interconnectionCost}
                  onChange={(e) => setFormData({ ...formData, interconnectionCost: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target IRR (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.targetIRR}
                  onChange={(e) => setFormData({ ...formData, targetIRR: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
          </div>
        ) : (
          /* Display Mode */
          <div className="space-y-6">
            {/* Primary Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {primaryMetrics.map((metric, i) => (
                <MetricCard key={i} metric={metric} />
              ))}
            </div>

            {/* Cost Breakdown */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Cost Breakdown</h4>
              <div className="space-y-2">
                {costBreakdown.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-28 text-sm text-gray-600">{item.label}</span>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          i === 0 ? 'bg-blue-500' :
                          i === 1 ? 'bg-green-500' :
                          i === 2 ? 'bg-purple-500' :
                          i === 3 ? 'bg-yellow-500' : 'bg-gray-400'
                        )}
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                    <span className="w-24 text-sm text-right font-medium">
                      {formatCurrency(item.value)}
                    </span>
                    <span className="w-12 text-sm text-gray-500 text-right">
                      {item.percent}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* PPA Details */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">PPA Details</h4>
              <div className="grid grid-cols-4 gap-4">
                {ppaMetrics.map((metric, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">{metric.label}</p>
                    <p className="font-semibold">
                      {metric.format === 'currency' && typeof metric.value === 'number'
                        ? `$${metric.value}/MWh`
                        : metric.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
              <div className="text-center">
                <p className="text-sm text-gray-600">$/Watt DC</p>
                <p className="text-2xl font-bold text-blue-700">
                  ${(totalCapex / (capacityKw * 1.3)).toFixed(2)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Simple Payback</p>
                <p className="text-2xl font-bold text-purple-700">
                  {simplePayback.toFixed(1)} yrs
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Target IRR</p>
                <p className="text-2xl font-bold text-green-700">
                  {project.targetIRR || 10}%
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
