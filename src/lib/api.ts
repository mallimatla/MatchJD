import { httpsCallable } from 'firebase/functions';
import { firebaseFunctions, firebaseAuth } from './firebase';
import type { Document, Project, Parcel, HITLRequest, ApiResponse } from '@/types';

// ============================================
// Firebase Cloud Functions API Client
// ============================================

// Helper to call cloud functions with auth
async function callFunction<T, R>(name: string, data: T): Promise<R> {
  const fn = httpsCallable<T, R>(firebaseFunctions, name);
  const result = await fn(data);
  return result.data;
}

// ============================================
// Document APIs
// ============================================

export async function uploadDocument(
  projectId: string,
  file: File
): Promise<ApiResponse<Document>> {
  // Get upload URL from cloud function
  const { uploadUrl, documentId } = await callFunction<
    { projectId: string; filename: string; contentType: string },
    { uploadUrl: string; documentId: string }
  >('getUploadUrl', {
    projectId,
    filename: file.name,
    contentType: file.type,
  });

  // Upload file directly to Firebase Storage
  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
    },
  });

  // Trigger processing
  return callFunction<{ documentId: string }, ApiResponse<Document>>(
    'processDocument',
    { documentId }
  );
}

export async function getDocuments(
  projectId: string
): Promise<ApiResponse<Document[]>> {
  return callFunction<{ projectId: string }, ApiResponse<Document[]>>(
    'getDocuments',
    { projectId }
  );
}

export async function getDocument(
  documentId: string
): Promise<ApiResponse<Document>> {
  return callFunction<{ documentId: string }, ApiResponse<Document>>(
    'getDocument',
    { documentId }
  );
}

// ============================================
// Project APIs
// ============================================

export async function createProject(
  data: Omit<Project, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>
): Promise<ApiResponse<Project>> {
  return callFunction<typeof data, ApiResponse<Project>>('createProject', data);
}

export async function getProjects(): Promise<ApiResponse<Project[]>> {
  return callFunction<{}, ApiResponse<Project[]>>('getProjects', {});
}

export async function getProject(
  projectId: string
): Promise<ApiResponse<Project>> {
  return callFunction<{ projectId: string }, ApiResponse<Project>>(
    'getProject',
    { projectId }
  );
}

export async function updateProject(
  projectId: string,
  data: Partial<Project>
): Promise<ApiResponse<Project>> {
  return callFunction<{ projectId: string; data: Partial<Project> }, ApiResponse<Project>>(
    'updateProject',
    { projectId, data }
  );
}

// ============================================
// Parcel APIs
// ============================================

export async function getParcels(
  projectId: string
): Promise<ApiResponse<Parcel[]>> {
  return callFunction<{ projectId: string }, ApiResponse<Parcel[]>>(
    'getParcels',
    { projectId }
  );
}

export async function analyzeParcel(
  parcelId: string
): Promise<ApiResponse<{ analysis: Record<string, any> }>> {
  return callFunction<{ parcelId: string }, ApiResponse<{ analysis: Record<string, any> }>>(
    'analyzeParcel',
    { parcelId }
  );
}

// ============================================
// HITL (Human-in-the-Loop) APIs
// ============================================

export async function getReviewQueue(): Promise<ApiResponse<HITLRequest[]>> {
  return callFunction<{}, ApiResponse<HITLRequest[]>>('getReviewQueue', {});
}

export async function approveReview(
  requestId: string,
  notes?: string
): Promise<ApiResponse<HITLRequest>> {
  return callFunction<{ requestId: string; approved: boolean; notes?: string }, ApiResponse<HITLRequest>>(
    'resolveReview',
    { requestId, approved: true, notes }
  );
}

export async function rejectReview(
  requestId: string,
  notes: string
): Promise<ApiResponse<HITLRequest>> {
  return callFunction<{ requestId: string; approved: boolean; notes: string }, ApiResponse<HITLRequest>>(
    'resolveReview',
    { requestId, approved: false, notes }
  );
}

// ============================================
// Workflow APIs
// ============================================

export async function startWorkflow(
  workflowType: string,
  input: Record<string, any>
): Promise<ApiResponse<{ workflowId: string }>> {
  return callFunction<
    { workflowType: string; input: Record<string, any> },
    ApiResponse<{ workflowId: string }>
  >('startWorkflow', { workflowType, input });
}

export async function getWorkflowStatus(
  workflowId: string
): Promise<ApiResponse<{ status: string; state: Record<string, any> }>> {
  return callFunction<
    { workflowId: string },
    ApiResponse<{ status: string; state: Record<string, any> }>
  >('getWorkflowStatus', { workflowId });
}

// ============================================
// AI Agent APIs
// ============================================

export async function runAgentTask(
  agentType: 'site_researcher' | 'lease_analyst' | 'dd_coordinator',
  taskInput: Record<string, any>
): Promise<ApiResponse<{ result: Record<string, any> }>> {
  return callFunction<
    { agentType: string; taskInput: Record<string, any> },
    ApiResponse<{ result: Record<string, any> }>
  >('runAgentTask', { agentType, taskInput });
}
