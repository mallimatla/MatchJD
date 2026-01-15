/**
 * LangGraph-style Workflow Orchestrator
 *
 * This implements a state machine workflow system inspired by LangGraph.
 * Since LangGraph is Python-based, this is a TypeScript adaptation that
 * provides similar functionality:
 *
 * - State-based workflow execution
 * - Conditional routing between nodes
 * - HITL (Human-in-the-Loop) interrupts
 * - Checkpointing for durability
 *
 * HOW IT WORKS:
 * 1. Workflows are defined as a graph of nodes (processing steps)
 * 2. Each node receives state, processes it, and returns updated state
 * 3. Edges connect nodes and can be conditional
 * 4. When HITL is needed, workflow pauses and saves state to Firestore
 * 5. When human responds, workflow resumes from checkpoint
 */

import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';

// Lazy initialization to avoid calling firestore() before initializeApp()
const getDb = () => admin.firestore();

// ============================================
// Types
// ============================================

export interface WorkflowState {
  workflowId: string;
  tenantId: string;
  workflowType: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  currentNode: string;
  data: Record<string, any>;
  history: Array<{
    node: string;
    timestamp: Date;
    data: Record<string, any>;
  }>;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface WorkflowNode {
  name: string;
  execute: (state: WorkflowState) => Promise<Partial<WorkflowState>>;
}

interface WorkflowEdge {
  from: string;
  to: string | ((state: WorkflowState) => string);
}

interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  entryPoint: string;
}

// ============================================
// Workflow Orchestrator
// ============================================

export class WorkflowOrchestrator {
  private anthropic: Anthropic;
  private workflows: Map<string, WorkflowDefinition> = new Map();

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Register workflow definitions
    this.registerDocumentProcessingWorkflow();
    this.registerLandAcquisitionWorkflow();
    this.registerProjectLifecycleWorkflow();
  }

  /**
   * Start a new workflow
   */
  async startWorkflow(
    workflowType: string,
    input: Record<string, any>
  ): Promise<string> {
    const workflowId = uuidv4();

    // Fetch project data if projectId is provided
    let projectData: Record<string, any> = {};
    let parcelsData: Record<string, any>[] = [];

    if (input.projectId) {
      const projectDoc = await getDb().doc(`projects/${input.projectId}`).get();
      if (projectDoc.exists) {
        projectData = { id: projectDoc.id, ...projectDoc.data() };
      }

      // Fetch parcels for the project
      const parcelsSnap = await getDb()
        .collection('parcels')
        .where('projectId', '==', input.projectId)
        .get();
      parcelsData = parcelsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    const state: WorkflowState = {
      workflowId,
      tenantId: input.tenantId,
      workflowType,
      status: 'pending',
      currentNode: 'start',
      data: {
        ...input,
        project: projectData,
        parcels: parcelsData,
      },
      history: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save initial state
    await this.saveState(state);

    // Start execution (don't await - let it run asynchronously)
    this.executeWorkflow(workflowId).catch((error) => {
      console.error(`Workflow ${workflowId} failed:`, error);
      this.updateState(workflowId, {
        status: 'failed',
        error: error.message,
      });
    });

    return workflowId;
  }

  /**
   * Resume a paused workflow (after HITL response)
   */
  async resumeWorkflow(
    workflowId: string,
    hitlResponse: Record<string, any>
  ): Promise<void> {
    const state = await this.loadState(workflowId);
    if (!state || state.status !== 'paused') {
      throw new Error('Workflow not found or not paused');
    }

    // Update state with HITL response
    await this.updateState(workflowId, {
      status: 'running',
      data: {
        ...state.data,
        hitlResponse,
      },
    });

    // Continue execution
    this.executeWorkflow(workflowId).catch((error) => {
      console.error(`Workflow ${workflowId} failed:`, error);
      this.updateState(workflowId, {
        status: 'failed',
        error: error.message,
      });
    });
  }

  /**
   * Get workflow status
   */
  async getWorkflowStatus(
    workflowId: string
  ): Promise<{ status: string; state: Record<string, any> } | null> {
    const state = await this.loadState(workflowId);
    if (!state) return null;

    return {
      status: state.status,
      state: {
        currentNode: state.currentNode,
        data: state.data,
        history: state.history,
        error: state.error,
      },
    };
  }

  /**
   * Get all workflows for a project
   */
  async getWorkflowsForProject(projectId: string, tenantId: string): Promise<WorkflowState[]> {
    const snapshot = await getDb()
      .collection('workflows')
      .where('tenantId', '==', tenantId)
      .where('data.projectId', '==', projectId)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    return snapshot.docs.map(doc => doc.data() as WorkflowState);
  }

  /**
   * Execute workflow from current state
   */
  private async executeWorkflow(workflowId: string): Promise<void> {
    let state = await this.loadState(workflowId);
    if (!state) throw new Error('Workflow not found');

    const workflow = this.workflows.get(state.workflowType);
    if (!workflow) throw new Error(`Unknown workflow type: ${state.workflowType}`);

    await this.updateState(workflowId, { status: 'running' });

    // Get entry point or current node
    let currentNode = state.currentNode === 'start'
      ? workflow.entryPoint
      : state.currentNode;

    while (currentNode !== 'end') {
      // Reload state (might have been updated)
      state = await this.loadState(workflowId);
      if (!state || state.status === 'paused') {
        console.log(`Workflow ${workflowId} paused at ${currentNode}`);
        return;
      }

      // Find and execute node
      const node = workflow.nodes.find((n) => n.name === currentNode);
      if (!node) throw new Error(`Node not found: ${currentNode}`);

      console.log(`Executing node: ${currentNode} for workflow ${workflowId}`);

      // Execute node
      const updates = await node.execute(state);

      // Update state
      state = {
        ...state,
        ...updates,
        currentNode,
        data: {
          ...state.data,
          ...updates.data,
        },
        history: [
          ...state.history,
          {
            node: currentNode,
            timestamp: new Date(),
            data: updates.data || {},
          },
        ],
        updatedAt: new Date(),
      };
      await this.saveState(state);

      // Check if workflow was paused by node
      if (state.status === 'paused') {
        return;
      }

      // Find next node
      const edge = workflow.edges.find((e) => e.from === currentNode);
      if (!edge) {
        currentNode = 'end';
      } else if (typeof edge.to === 'function') {
        currentNode = edge.to(state);
      } else {
        currentNode = edge.to;
      }

      await this.updateState(workflowId, { currentNode });
    }

    // Workflow completed
    await this.updateState(workflowId, { status: 'completed' });
    console.log(`Workflow ${workflowId} completed`);
  }

  /**
   * Save workflow state to Firestore
   */
  private async saveState(state: WorkflowState): Promise<void> {
    await getDb().doc(`workflows/${state.workflowId}`).set(state);
  }

  /**
   * Load workflow state from Firestore
   */
  private async loadState(workflowId: string): Promise<WorkflowState | null> {
    const doc = await getDb().doc(`workflows/${workflowId}`).get();
    return doc.exists ? (doc.data() as WorkflowState) : null;
  }

  /**
   * Update workflow state
   */
  private async updateState(
    workflowId: string,
    updates: Partial<WorkflowState>
  ): Promise<void> {
    await getDb().doc(`workflows/${workflowId}`).update({
      ...updates,
      updatedAt: new Date(),
    });
  }

  /**
   * Update project status in Firestore
   */
  private async updateProjectStatus(
    projectId: string,
    status: string,
    additionalData?: Record<string, any>
  ): Promise<void> {
    await getDb().doc(`projects/${projectId}`).update({
      status,
      ...additionalData,
      updatedAt: new Date(),
    });
  }

  /**
   * Create HITL interrupt - pauses workflow until human responds
   */
  private async createHITLInterrupt(
    state: WorkflowState,
    reason: string,
    options?: {
      urgency?: 'low' | 'medium' | 'high' | 'critical';
      context?: Record<string, any>;
      projectId?: string;
    }
  ): Promise<void> {
    // Create HITL request
    await getDb().collection('hitlRequests').add({
      tenantId: state.tenantId,
      workflowId: state.workflowId,
      projectId: options?.projectId || state.data.projectId,
      requestType: 'workflow_approval',
      urgency: options?.urgency || 'medium',
      status: 'pending',
      description: reason,
      context: {
        workflowType: state.workflowType,
        currentNode: state.currentNode,
        projectName: state.data.project?.name,
        ...options?.context,
      },
      createdAt: new Date(),
    });

    // Pause workflow
    await this.updateState(state.workflowId, { status: 'paused' });
  }

  // ============================================
  // Workflow Definitions
  // ============================================

  /**
   * Document Processing Workflow
   *
   * Flow: Classify → Extract → Validate → HITL (if needed) → Complete
   */
  private registerDocumentProcessingWorkflow(): void {
    const nodes: WorkflowNode[] = [
      {
        name: 'classify',
        execute: async (state) => {
          // Classification is handled by DocumentProcessor
          // This node just sets up the classification step
          return {
            data: {
              ...state.data,
              phase: 'classification',
            },
          };
        },
      },
      {
        name: 'extract',
        execute: async (state) => {
          return {
            data: {
              ...state.data,
              phase: 'extraction',
            },
          };
        },
      },
      {
        name: 'validate',
        execute: async (state) => {
          const confidence = state.data.confidence || 0;
          const isLegal = ['lease', 'ppa', 'easement', 'option'].includes(
            state.data.category
          );

          return {
            data: {
              ...state.data,
              phase: 'validation',
              requiresHITL: confidence < 0.9 || isLegal,
            },
          };
        },
      },
      {
        name: 'hitl_gate',
        execute: async (state) => {
          if (state.data.requiresHITL && !state.data.hitlResponse) {
            await this.createHITLInterrupt(state, 'Document requires human review', {
              urgency: state.data.confidence < 0.7 ? 'high' : 'medium',
              context: {
                documentId: state.data.documentId,
                category: state.data.category,
                confidence: state.data.confidence,
              },
            });
            return { status: 'paused' };
          }
          return {
            data: {
              ...state.data,
              approved: state.data.hitlResponse?.approved ?? true,
            },
          };
        },
      },
      {
        name: 'complete',
        execute: async (state) => {
          return {
            data: {
              ...state.data,
              phase: 'complete',
              completedAt: new Date(),
            },
          };
        },
      },
    ];

    const edges: WorkflowEdge[] = [
      { from: 'classify', to: 'extract' },
      { from: 'extract', to: 'validate' },
      { from: 'validate', to: 'hitl_gate' },
      { from: 'hitl_gate', to: 'complete' },
      { from: 'complete', to: 'end' },
    ];

    this.workflows.set('document_processing', {
      nodes,
      edges,
      entryPoint: 'classify',
    });
  }

  /**
   * Land Acquisition Workflow
   *
   * Flow: Site Analysis → Due Diligence → Lease Negotiation → Legal Review → Execute
   *
   * This workflow manages the complete land acquisition process for solar projects.
   * It includes AI-powered site analysis, due diligence tracking, and HITL gates
   * for legal review before lease execution.
   */
  private registerLandAcquisitionWorkflow(): void {
    const nodes: WorkflowNode[] = [
      {
        name: 'site_analysis',
        execute: async (state) => {
          const project = state.data.project;
          const parcels = state.data.parcels || [];

          // Skip if no parcels
          if (parcels.length === 0) {
            return {
              data: {
                ...state.data,
                phase: 'site_analysis',
                siteAnalysis: {
                  status: 'skipped',
                  reason: 'No parcels defined for this project',
                },
              },
            };
          }

          // Use Claude to analyze site suitability for each parcel
          const analysisPromises = parcels.map(async (parcel: any) => {
            try {
              const response = await this.anthropic.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 2048,
                messages: [
                  {
                    role: 'user',
                    content: `Analyze this parcel for solar development suitability:

Parcel Details:
- APN: ${parcel.apn}
- County: ${parcel.county}, ${parcel.state}
- Acreage: ${parcel.acres} acres
- Zoning: ${parcel.zoning}
- Land Use: ${parcel.landUse}
- Owner: ${parcel.ownerName}

Project Requirements:
- Target Capacity: ${project?.capacityMwAc || 'Not specified'} MW AC
- Project Type: ${project?.type || 'utility_solar'}
- Target COD: ${project?.targetCod || 'Not specified'}

Evaluate and score each category (0-100):
1. Physical Suitability - Is the parcel size adequate? Estimated MW capacity?
2. Zoning Compatibility - Is solar development permitted or conditional use required?
3. Environmental Constraints - Potential wetlands, flood zones, endangered species concerns?
4. Grid Proximity - Based on location, estimate grid connection feasibility
5. Access Considerations - Road access, transmission line proximity

Return JSON:
{
  "parcelId": "${parcel.id}",
  "apn": "${parcel.apn}",
  "overallScore": <0-100>,
  "scores": {
    "physical": <0-100>,
    "zoning": <0-100>,
    "environmental": <0-100>,
    "grid": <0-100>,
    "access": <0-100>
  },
  "estimatedCapacityMw": <number>,
  "issues": ["list of potential issues"],
  "recommendations": ["list of recommendations"],
  "recommendation": "proceed" | "proceed_with_caution" | "not_recommended"
}`,
                  },
                ],
              });

              const content = response.content[0];
              if (content.type === 'text') {
                try {
                  return JSON.parse(content.text.replace(/```json?\n?|```$/g, ''));
                } catch {
                  return {
                    parcelId: parcel.id,
                    apn: parcel.apn,
                    rawAnalysis: content.text,
                    error: 'Failed to parse analysis',
                  };
                }
              }
            } catch (error: any) {
              return {
                parcelId: parcel.id,
                apn: parcel.apn,
                error: error.message,
              };
            }
          });

          const analysisResults = await Promise.all(analysisPromises);

          // Calculate overall project suitability
          const validResults = analysisResults.filter((r: any) => r.overallScore !== undefined);
          const avgScore = validResults.length > 0
            ? validResults.reduce((sum: number, r: any) => sum + r.overallScore, 0) / validResults.length
            : 0;

          return {
            data: {
              ...state.data,
              phase: 'site_analysis',
              siteAnalysis: {
                status: 'completed',
                completedAt: new Date(),
                parcelsAnalyzed: parcels.length,
                results: analysisResults,
                overallScore: Math.round(avgScore),
                recommendation: avgScore >= 70 ? 'proceed' : avgScore >= 50 ? 'proceed_with_caution' : 'not_recommended',
              },
            },
          };
        },
      },
      {
        name: 'due_diligence',
        execute: async (state) => {
          const projectId = state.data.projectId;

          // Create DD workstreams if they don't exist
          const ddWorkstreams = [
            { id: 'title_review', name: 'Title Review', status: 'not_started', category: 'legal' },
            { id: 'environmental', name: 'Environmental Review', status: 'not_started', category: 'environmental' },
            { id: 'survey', name: 'Land Survey', status: 'not_started', category: 'technical' },
            { id: 'permitting', name: 'Permitting Assessment', status: 'not_started', category: 'permits' },
            { id: 'interconnection', name: 'Interconnection Study', status: 'not_started', category: 'grid' },
            { id: 'financial', name: 'Financial Analysis', status: 'not_started', category: 'financial' },
          ];

          // Store DD workstreams in the project
          if (projectId) {
            await getDb().doc(`projects/${projectId}`).update({
              ddWorkstreams,
              ddStatus: 'in_progress',
              ddStartedAt: new Date(),
            });
          }

          return {
            data: {
              ...state.data,
              phase: 'due_diligence',
              ddStatus: 'in_progress',
              ddWorkstreams,
            },
          };
        },
      },
      {
        name: 'lease_negotiation',
        execute: async (state) => {
          const project = state.data.project;
          const parcels = state.data.parcels || [];

          // Generate recommended lease terms based on analysis
          let recommendedTerms: any = {
            status: 'ready_for_negotiation',
          };

          if (parcels.length > 0) {
            const totalAcres = parcels.reduce((sum: number, p: any) => sum + (p.acres || 0), 0);
            const estimatedCapacity = totalAcres * 5; // ~5 acres per MW rule of thumb

            try {
              const response = await this.anthropic.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1024,
                messages: [
                  {
                    role: 'user',
                    content: `Based on the following project details, suggest initial lease negotiation terms:

Project: ${project?.name || 'Solar Project'}
Location: ${project?.county || 'Unknown'}, ${project?.state || 'Unknown'}
Total Acreage: ${totalAcres} acres
Estimated Capacity: ${estimatedCapacity} MW
Number of Parcels: ${parcels.length}

Suggest reasonable lease terms in JSON format:
{
  "suggestedRentPerAcre": <number in USD>,
  "suggestedTermYears": <number>,
  "suggestedEscalation": <percentage>,
  "recommendedSigningBonus": <number in USD>,
  "keyNegotiationPoints": ["list of important items to negotiate"],
  "marketComparison": "brief market analysis"
}`,
                  },
                ],
              });

              const content = response.content[0];
              if (content.type === 'text') {
                try {
                  recommendedTerms = {
                    ...recommendedTerms,
                    ...JSON.parse(content.text.replace(/```json?\n?|```$/g, '')),
                  };
                } catch {
                  recommendedTerms.rawSuggestion = content.text;
                }
              }
            } catch (error: any) {
              recommendedTerms.error = error.message;
            }
          }

          return {
            data: {
              ...state.data,
              phase: 'lease_negotiation',
              leaseTerms: recommendedTerms,
            },
          };
        },
      },
      {
        name: 'legal_review',
        execute: async (state) => {
          // ALWAYS require legal review for lease documents
          if (!state.data.hitlResponse) {
            await this.createHITLInterrupt(
              state,
              'Lease terms require legal review before execution',
              {
                urgency: 'high',
                projectId: state.data.projectId,
                context: {
                  projectName: state.data.project?.name,
                  leaseTerms: state.data.leaseTerms,
                  siteAnalysis: state.data.siteAnalysis,
                  parcels: state.data.parcels?.map((p: any) => ({
                    apn: p.apn,
                    acres: p.acres,
                    county: p.county,
                    state: p.state,
                  })),
                },
              }
            );
            return { status: 'paused' };
          }

          return {
            data: {
              ...state.data,
              phase: 'legal_review',
              legalApproved: state.data.hitlResponse.approved,
              legalNotes: state.data.hitlResponse.notes,
              legalReviewedAt: new Date(),
            },
          };
        },
      },
      {
        name: 'execute_lease',
        execute: async (state) => {
          const projectId = state.data.projectId;

          if (!state.data.legalApproved) {
            // Update project status to reflect rejection
            if (projectId) {
              await this.updateProjectStatus(projectId, 'prospecting', {
                leaseStatus: 'rejected',
                leaseRejectionReason: state.data.legalNotes,
              });
            }

            return {
              data: {
                ...state.data,
                phase: 'rejected',
                status: 'lease_rejected',
                rejectedAt: new Date(),
              },
            };
          }

          // Update project status to site_control (lease executed)
          if (projectId) {
            await this.updateProjectStatus(projectId, 'site_control', {
              leaseStatus: 'executed',
              leaseExecutedAt: new Date(),
            });

            // Update parcel statuses to 'leased'
            const parcels = state.data.parcels || [];
            for (const parcel of parcels) {
              if (parcel.id) {
                await getDb().doc(`parcels/${parcel.id}`).update({
                  status: 'leased',
                  leasedAt: new Date(),
                });
              }
            }
          }

          return {
            data: {
              ...state.data,
              phase: 'executed',
              executedAt: new Date(),
              leaseStatus: 'executed',
            },
          };
        },
      },
    ];

    const edges: WorkflowEdge[] = [
      { from: 'site_analysis', to: 'due_diligence' },
      { from: 'due_diligence', to: 'lease_negotiation' },
      { from: 'lease_negotiation', to: 'legal_review' },
      { from: 'legal_review', to: 'execute_lease' },
      { from: 'execute_lease', to: 'end' },
    ];

    this.workflows.set('land_acquisition', {
      nodes,
      edges,
      entryPoint: 'site_analysis',
    });
  }

  /**
   * Project Lifecycle Workflow
   *
   * Parent workflow that orchestrates the entire project development
   * through key milestones: Prospecting → Site Control → Development → Construction
   */
  private registerProjectLifecycleWorkflow(): void {
    const nodes: WorkflowNode[] = [
      {
        name: 'prospecting',
        execute: async (state) => {
          const projectId = state.data.projectId;

          // Update project status
          if (projectId) {
            await this.updateProjectStatus(projectId, 'prospecting', {
              lifecyclePhase: 'prospecting',
              prospectingStartedAt: new Date(),
            });
          }

          return {
            data: {
              ...state.data,
              phase: 'prospecting',
              phaseStartedAt: new Date(),
              checklist: {
                siteIdentified: true,
                initialAssessmentComplete: false,
                landownerContactInitiated: false,
              },
            },
          };
        },
      },
      {
        name: 'site_control',
        execute: async (state) => {
          const projectId = state.data.projectId;

          // Update project status
          if (projectId) {
            await this.updateProjectStatus(projectId, 'site_control', {
              lifecyclePhase: 'site_control',
              siteControlStartedAt: new Date(),
            });
          }

          return {
            data: {
              ...state.data,
              phase: 'site_control',
              checklist: {
                ...state.data.checklist,
                leaseNegotiated: false,
                leaseExecuted: false,
                titleCleared: false,
              },
            },
          };
        },
      },
      {
        name: 'development',
        execute: async (state) => {
          const projectId = state.data.projectId;

          // Update project status
          if (projectId) {
            await this.updateProjectStatus(projectId, 'development', {
              lifecyclePhase: 'development',
              developmentStartedAt: new Date(),
            });
          }

          return {
            data: {
              ...state.data,
              phase: 'development',
              checklist: {
                ...state.data.checklist,
                interconnectionFiled: false,
                permitsSubmitted: false,
                engineeringStarted: false,
                ppaExecuted: false,
              },
            },
          };
        },
      },
      {
        name: 'construction_ready',
        execute: async (state) => {
          // Final approval gate before construction
          if (!state.data.hitlResponse) {
            // Build summary for approval
            const project = state.data.project;
            const summary = {
              projectName: project?.name,
              capacity: project?.capacityMwAc,
              capex: project?.capexUsd,
              targetCod: project?.targetCod,
              phase: 'Ready for Construction',
              milestones: state.data.checklist,
            };

            await this.createHITLInterrupt(
              state,
              'Project ready for construction - final approval required',
              {
                urgency: 'critical',
                projectId: state.data.projectId,
                context: {
                  summary,
                  financials: {
                    estimatedCapex: project?.capexUsd,
                    capacity: project?.capacityMwAc,
                  },
                  requiresApproval: [
                    'Management sign-off',
                    'Financial close confirmation',
                    'NTP authorization',
                  ],
                },
              }
            );
            return { status: 'paused' };
          }

          const projectId = state.data.projectId;

          if (state.data.hitlResponse.approved) {
            // Update to construction_ready status
            if (projectId) {
              await this.updateProjectStatus(projectId, 'construction_ready', {
                lifecyclePhase: 'construction_ready',
                constructionReadyAt: new Date(),
                ntpApproved: true,
                ntpApprovedBy: state.data.hitlResponse.resolvedBy,
              });
            }

            return {
              data: {
                ...state.data,
                phase: 'approved',
                approvedAt: new Date(),
                ntpApproved: true,
              },
            };
          } else {
            // NTP not approved - stay in development
            if (projectId) {
              await this.updateProjectStatus(projectId, 'development', {
                ntpRejectionReason: state.data.hitlResponse.notes,
                ntpRejectedAt: new Date(),
              });
            }

            return {
              data: {
                ...state.data,
                phase: 'ntp_rejected',
                ntpApproved: false,
                rejectionReason: state.data.hitlResponse.notes,
              },
            };
          }
        },
      },
    ];

    const edges: WorkflowEdge[] = [
      { from: 'prospecting', to: 'site_control' },
      { from: 'site_control', to: 'development' },
      { from: 'development', to: 'construction_ready' },
      { from: 'construction_ready', to: 'end' },
    ];

    this.workflows.set('project_lifecycle', {
      nodes,
      edges,
      entryPoint: 'prospecting',
    });
  }
}
