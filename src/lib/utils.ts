import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    // Document statuses
    uploading: 'bg-blue-100 text-blue-800',
    processing: 'bg-yellow-100 text-yellow-800',
    review_required: 'bg-orange-100 text-orange-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    failed: 'bg-red-100 text-red-800',
    // Project statuses
    prospecting: 'bg-gray-100 text-gray-800',
    site_control: 'bg-blue-100 text-blue-800',
    due_diligence: 'bg-yellow-100 text-yellow-800',
    development: 'bg-purple-100 text-purple-800',
    construction: 'bg-orange-100 text-orange-800',
    operational: 'bg-green-100 text-green-800',
    // Parcel statuses
    available: 'bg-gray-100 text-gray-800',
    under_option: 'bg-yellow-100 text-yellow-800',
    leased: 'bg-blue-100 text-blue-800',
    owned: 'bg-green-100 text-green-800',
    // HITL statuses
    pending: 'bg-yellow-100 text-yellow-800',
    // Default
    default: 'bg-gray-100 text-gray-800',
  };
  return colors[status] || colors.default;
}

export function getUrgencyColor(urgency: string): string {
  const colors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-800',
    medium: 'bg-blue-100 text-blue-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
  };
  return colors[urgency] || colors.low;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
