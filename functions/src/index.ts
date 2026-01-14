import * as admin from 'firebase-admin';
import { onCall } from 'firebase-functions/v2/https';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { DocumentProcessor } from './document-ai/processor';
import { WorkflowOrchestrator } from './workflows/orchestrator';
import { AgentRunner } from './agents/runner';

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();
const storage = admin.storage();

// ============================================
// Document Processing Functions
// ============================================

/**
 * Triggered when a document is updated with a storage URL.
 * Starts the AI processing pipeline.
 */
export const onDocumentUploaded = onDocumentUpdated(
  'documents/{documentId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const documentId = event.params.documentId;

    // Only process when status changes to 'processing' and we have a storage URL
    if (
      before?.status !== 'processing' &&
      after?.status === 'processing' &&
      after?.storageUrl
    ) {
      console.log(`Processing document: ${documentId}`);

      try {
        const processor = new DocumentProcessor();
        const result = await processor.process(documentId, after.storageUrl);

        // Update document with results
        await db.doc(`documents/${documentId}`).update({
          category: result.category,
          extractedData: result.extractedData,
          confidence: result.confidence,
          requiresReview: result.requiresReview,
          reviewReasons: result.reviewReasons,
          status: result.requiresReview ? 'review_required' : 'approved',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Create HITL request if review required
        if (result.requiresReview) {
          await db.collection('hitlRequests').add({
            tenantId: after.tenantId,
            documentId,
            projectId: after.projectId,
            requestType: 'review',
            urgency: result.confidence < 0.7 ? 'high' : 'medium',
            status: 'pending',
            description: `Review document extraction: ${after.filename}`,
            context: {
              category: result.category,
              extractedData: result.extractedData,
              confidence: result.confidence,
              reviewReasons: result.reviewReasons,
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        console.log(`Document processed successfully: ${documentId}`);
      } catch (error) {
        console.error(`Error processing document ${documentId}:`, error);
        await db.doc(`documents/${documentId}`).update({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }
  }
);

/**
 * Get a signed upload URL for document upload
 */
export const getUploadUrl = onCall(async (request) => {
  const { projectId, filename, contentType } = request.data;
  const userId = request.auth?.uid;

  if (!userId) {
    throw new Error('Unauthorized');
  }

  const documentId = db.collection('documents').doc().id;
  const filePath = `documents/${userId}/${projectId}/${documentId}/${filename}`;

  const file = storage.bucket().file(filePath);
  const [uploadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    contentType,
  });

  return { uploadUrl, documentId };
});

/**
 * Manually trigger document processing
 */
export const processDocument = onCall(async (request) => {
  const { documentId } = request.data;
  const userId = request.auth?.uid;

  if (!userId) {
    throw new Error('Unauthorized');
  }

  const docRef = db.doc(`documents/${documentId}`);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw new Error('Document not found');
  }

  const data = doc.data()!;
  if (data.tenantId !== userId) {
    throw new Error('Unauthorized');
  }

  // The onDocumentUpdated trigger will handle processing
  await docRef.update({
    status: 'processing',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, documentId };
});

// ============================================
// HITL (Human-in-the-Loop) Functions
// ============================================

/**
 * Resolve a HITL review request
 */
export const resolveReview = onCall(async (request) => {
  const { requestId, approved, notes } = request.data;
  const userId = request.auth?.uid;

  if (!userId) {
    throw new Error('Unauthorized');
  }

  const requestRef = db.doc(`hitlRequests/${requestId}`);
  const requestDoc = await requestRef.get();

  if (!requestDoc.exists) {
    throw new Error('Request not found');
  }

  const requestData = requestDoc.data()!;
  if (requestData.tenantId !== userId) {
    throw new Error('Unauthorized');
  }

  // Update HITL request
  await requestRef.update({
    status: approved ? 'approved' : 'rejected',
    resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
    resolvedBy: userId,
    notes,
  });

  // Update related document if exists
  if (requestData.documentId) {
    await db.doc(`documents/${requestData.documentId}`).update({
      status: approved ? 'approved' : 'rejected',
      reviewedBy: userId,
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Resume workflow if this was a workflow gate
  if (requestData.workflowId) {
    const orchestrator = new WorkflowOrchestrator();
    await orchestrator.resumeWorkflow(requestData.workflowId, {
      approved,
      notes,
      resolvedBy: userId,
    });
  }

  return { success: true };
});

/**
 * Get pending review queue
 */
export const getReviewQueue = onCall(async (request) => {
  const userId = request.auth?.uid;

  if (!userId) {
    throw new Error('Unauthorized');
  }

  const snapshot = await db
    .collection('hitlRequests')
    .where('tenantId', '==', userId)
    .where('status', '==', 'pending')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  const requests = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return { success: true, data: requests };
});

/**
 * Triggered when a HITL request is updated (approved/rejected).
 * Handles downstream workflow actions.
 */
export const onHITLRequestUpdated = onDocumentUpdated(
  'hitlRequests/{requestId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const requestId = event.params.requestId;

    // Only process when status changes from 'pending' to 'approved' or 'rejected'
    if (before?.status === 'pending' && after?.status !== 'pending') {
      console.log(`HITL request ${requestId} resolved: ${after?.status}`);

      const isApproved = after?.status === 'approved';
      const documentId = after?.documentId;
      const projectId = after?.projectId;
      const tenantId = after?.tenantId;
      const category = after?.context?.category;
      const extractedData = after?.context?.extractedData;

      try {
        // Update the associated document status
        if (documentId) {
          await db.doc(`documents/${documentId}`).update({
            status: isApproved ? 'approved' : 'rejected',
            reviewedBy: after?.resolvedBy,
            reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        // If approved and it's a lease document, create parcels from extracted data
        if (isApproved && category === 'lease' && extractedData && projectId && tenantId) {
          console.log(`Creating parcels from approved lease document: ${documentId}`);
          await createParcelsFromLease(extractedData, projectId, tenantId, documentId);
        }

        // If approved and it's a PPA, update project with PPA info
        if (isApproved && category === 'ppa' && extractedData && projectId) {
          console.log(`Updating project with PPA data: ${projectId}`);
          await db.doc(`projects/${projectId}`).update({
            ppaStatus: 'executed',
            ppaPrice: extractedData.contractPrice || extractedData.price?.contractPrice,
            ppaBuyer: extractedData.buyer?.name || extractedData.buyer,
            ppaTermYears: extractedData.termYears || extractedData.term,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        // Resume workflow if this was a workflow gate
        if (after?.workflowId) {
          const orchestrator = new WorkflowOrchestrator();
          await orchestrator.resumeWorkflow(after.workflowId, {
            approved: isApproved,
            notes: after?.notes,
            resolvedBy: after?.resolvedBy,
          });
        }

        console.log(`HITL downstream actions completed for request: ${requestId}`);
      } catch (error) {
        console.error(`Error processing HITL downstream actions for ${requestId}:`, error);
      }
    }
  }
);

/**
 * Helper function to create parcels from lease extraction data
 */
async function createParcelsFromLease(
  extractedData: any,
  projectId: string,
  tenantId: string,
  documentId?: string
): Promise<void> {
  const parcelNumbers = extractedData.parcelNumbers || [];
  const totalAcres = extractedData.totalAcres || 0;
  const county = extractedData.county || '';
  const state = extractedData.state || '';
  const lessorName = extractedData.lessor?.name || '';
  const lessorAddress = extractedData.lessor?.address || '';

  // If no parcel numbers but we have acres, create a single parcel
  if (parcelNumbers.length === 0 && totalAcres > 0) {
    const parcelId = db.collection('parcels').doc().id;
    await db.doc(`parcels/${parcelId}`).set({
      projectId,
      tenantId,
      apn: `PENDING-${Date.now()}`,
      county,
      state,
      acres: totalAcres,
      zoning: 'TBD',
      landUse: 'Agricultural',
      ownerName: lessorName,
      ownerAddress: lessorAddress,
      status: 'leased',
      assessedValue: 0,
      marketValue: 0,
      sourceDocumentId: documentId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`Created single parcel for lease with ${totalAcres} acres`);
    return;
  }

  // Create a parcel for each parcel number
  const acresPerParcel = parcelNumbers.length > 0 ? totalAcres / parcelNumbers.length : 0;

  for (const apn of parcelNumbers) {
    // Check if parcel already exists
    const existing = await db
      .collection('parcels')
      .where('tenantId', '==', tenantId)
      .where('projectId', '==', projectId)
      .where('apn', '==', apn)
      .limit(1)
      .get();

    if (!existing.empty) {
      // Update existing parcel
      await existing.docs[0].ref.update({
        status: 'leased',
        ownerName: lessorName,
        ownerAddress: lessorAddress,
        acres: acresPerParcel || existing.docs[0].data().acres,
        sourceDocumentId: documentId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`Updated existing parcel: ${apn}`);
    } else {
      // Create new parcel
      const parcelId = db.collection('parcels').doc().id;
      await db.doc(`parcels/${parcelId}`).set({
        projectId,
        tenantId,
        apn,
        county,
        state,
        acres: acresPerParcel,
        zoning: 'TBD',
        landUse: 'Agricultural',
        ownerName: lessorName,
        ownerAddress: lessorAddress,
        status: 'leased',
        assessedValue: 0,
        marketValue: 0,
        sourceDocumentId: documentId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`Created new parcel: ${apn}`);
    }
  }
}

// ============================================
// Workflow Functions
// ============================================

/**
 * Start a new workflow
 */
export const startWorkflow = onCall(async (request) => {
  const { workflowType, input } = request.data;
  const userId = request.auth?.uid;

  if (!userId) {
    throw new Error('Unauthorized');
  }

  const orchestrator = new WorkflowOrchestrator();
  const workflowId = await orchestrator.startWorkflow(workflowType, {
    ...input,
    tenantId: userId,
  });

  return { success: true, data: { workflowId } };
});

/**
 * Get workflow status
 */
export const getWorkflowStatus = onCall(async (request) => {
  const { workflowId } = request.data;
  const userId = request.auth?.uid;

  if (!userId) {
    throw new Error('Unauthorized');
  }

  const orchestrator = new WorkflowOrchestrator();
  const status = await orchestrator.getWorkflowStatus(workflowId);

  return { success: true, data: status };
});

// ============================================
// AI Agent Functions
// ============================================

/**
 * Run an AI agent task
 */
export const runAgentTask = onCall(async (request) => {
  const { agentType, taskInput } = request.data;
  const userId = request.auth?.uid;

  if (!userId) {
    throw new Error('Unauthorized');
  }

  const runner = new AgentRunner();
  const result = await runner.runTask(agentType, {
    ...taskInput,
    tenantId: userId,
  });

  return { success: true, data: { result } };
});

// ============================================
// Project Functions
// ============================================

export const getProjects = onCall(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new Error('Unauthorized');

  const snapshot = await db
    .collection('projects')
    .where('tenantId', '==', userId)
    .orderBy('createdAt', 'desc')
    .get();

  return {
    success: true,
    data: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  };
});

export const getDocuments = onCall(async (request) => {
  const { projectId } = request.data;
  const userId = request.auth?.uid;
  if (!userId) throw new Error('Unauthorized');

  const snapshot = await db
    .collection('documents')
    .where('tenantId', '==', userId)
    .where('projectId', '==', projectId)
    .orderBy('createdAt', 'desc')
    .get();

  return {
    success: true,
    data: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  };
});
