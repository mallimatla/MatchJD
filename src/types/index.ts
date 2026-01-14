// ============================================
// Core Types for Neurogrid
// ============================================

// Document Types
export type DocumentCategory =
  | 'lease'
  | 'option'
  | 'easement'
  | 'title_report'
  | 'survey'
  | 'interconnection_agreement'
  | 'system_impact_study'
  | 'facility_study'
  | 'cup_application'
  | 'environmental_report'
  | 'ppa'
  | 'unknown';

export type DocumentStatus =
  | 'uploading'
  | 'processing'
  | 'review_required'
  | 'approved'
  | 'rejected'
  | 'failed';

export interface Document {
  id: string;
  projectId: string;
  tenantId: string;
  filename: string;
  storageUrl: string;
  category: DocumentCategory | null;
  status: DocumentStatus;
  extractedData: Record<string, any> | null;
  confidence: number;
  requiresReview: boolean;
  reviewReasons: string[];
  createdAt: Date;
  updatedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
}

// Project Types
export type ProjectStatus =
  | 'prospecting'
  | 'site_control'
  | 'due_diligence'
  | 'development'
  | 'construction'
  | 'operational'
  | 'decommissioned';

export type ProjectType =
  | 'utility_solar'
  | 'distributed_solar'
  | 'storage'
  | 'hybrid';

export interface Project {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  projectType: ProjectType;
  status: ProjectStatus;
  state: string;
  county: string;
  latitude: number;
  longitude: number;
  capacityMwAc: number;
  capacityMwDc: number;
  storageMwh?: number;
  estimatedCapex: number;
  targetCod: string;
  createdAt: Date;
  updatedAt: Date;
}

// Parcel Types
export type ParcelStatus =
  | 'available'
  | 'under_option'
  | 'leased'
  | 'owned';

export interface Parcel {
  id: string;
  projectId: string;
  tenantId: string;
  apn: string;
  county: string;
  state: string;
  acres: number;
  zoning: string;
  landUse: string;
  ownerName: string;
  ownerAddress: string;
  status: ParcelStatus;
  assessedValue: number;
  marketValue: number;
  geometry?: GeoJSON.MultiPolygon;
  centroid?: GeoJSON.Point;
  createdAt: Date;
  updatedAt: Date;
}

// Lease Extraction Types
export interface LeaseExtraction {
  documentDate: string | null;
  effectiveDate: string | null;
  lessor: {
    name: string;
    entityType: string | null;
    address: string | null;
  };
  lessee: {
    name: string;
    entityType: string | null;
    address: string | null;
  };
  propertyDescription: string | null;
  county: string | null;
  state: string | null;
  parcelNumbers: string[];
  totalAcres: number | null;
  initialTermYears: number | null;
  commencementDate: string | null;
  expirationDate: string | null;
  rent: {
    baseRentPerAcre: number | null;
    annualEscalationPercent: number | null;
    signingBonus: number | null;
  };
  extensionOptions: Array<{
    termYears: number;
    noticeDays: number;
  }>;
  purchaseOption: {
    exists: boolean;
    priceFormula: string | null;
  };
  permittedUses: string[];
  terminationProvisions: string[];
}

// HITL (Human-in-the-Loop) Types
export type HITLRequestType = 'review' | 'approval' | 'decision';
export type HITLUrgency = 'low' | 'medium' | 'high' | 'critical';
export type HITLStatus = 'pending' | 'approved' | 'rejected' | 'deferred';

export interface HITLRequest {
  id: string;
  tenantId: string;
  requestType: HITLRequestType;
  urgency: HITLUrgency;
  status: HITLStatus;
  documentId?: string;
  projectId?: string;
  description: string;
  context: Record<string, any>;
  assignedTo?: string;
  deadline?: Date;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: string;
  notes?: string;
}

// Workflow Types
export type WorkflowStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed';

export interface WorkflowExecution {
  id: string;
  tenantId: string;
  workflowType: string;
  status: WorkflowStatus;
  input: Record<string, any>;
  state: Record<string, any>;
  output: Record<string, any> | null;
  error: string | null;
  checkpointId: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// User Types
export interface User {
  id: string;
  email: string;
  displayName: string;
  tenantId: string;
  role: 'admin' | 'manager' | 'analyst' | 'viewer';
  createdAt: Date;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// GeoJSON types (subset for our needs)
declare global {
  namespace GeoJSON {
    interface Point {
      type: 'Point';
      coordinates: [number, number];
    }
    interface MultiPolygon {
      type: 'MultiPolygon';
      coordinates: number[][][][];
    }
  }
}
