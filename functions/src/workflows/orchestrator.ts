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

interface WorkflowState {
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

    const state: WorkflowState = {
      workflowId,
      tenantId: input.tenantId,
      workflowType,
      status: 'pending',
      currentNode: 'start',
      data: input,
      history: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save initial state
    await this.saveState(state);

    // Start execution
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

      console.log(`Executing node: ${currentNode}`);

      // Execute node
      const updates = await node.execute(state);

      // Update state
      state = {
        ...state,
        ...updates,
        currentNode,
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
   * Create HITL interrupt - pauses workflow until human responds
   */
  private async createHITLInterrupt(
    state: WorkflowState,
    reason: string,
    options?: {
      urgency?: 'low' | 'medium' | 'high' | 'critical';
      context?: Record<string, any>;
    }
  ): Promise<void> {
    // Create HITL request
    await getDb().collection('hitlRequests').add({
      tenantId: state.tenantId,
      workflowId: state.workflowId,
      requestType: 'approval',
      urgency: options?.urgency || 'medium',
      status: 'pending',
      description: reason,
      context: {
        workflowType: state.workflowType,
        currentNode: state.currentNode,
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
   */
  private registerLandAcquisitionWorkflow(): void {
    const nodes: WorkflowNode[] = [
      {
        name: 'site_analysis',
        execute: async (state) => {
          // Use Claude to analyze site suitability
          const response = await this.anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2048,
            messages: [
              {
                role: 'user',
                content: `Analyze this parcel for solar development suitability:

Parcel: ${JSON.stringify(state.data.parcel)}
Project Requirements: ${JSON.stringify(state.data.requirements)}

Evaluate:
1. Physical suitability (size, topography)
2. Zoning compatibility
3. Environmental constraints
4. Grid proximity
5. Access considerations

Return JSON with suitabilityScore (0-100) and analysis.`,
              },
            ],
          });

          let analysis = {};
          const content = response.content[0];
          if (content.type === 'text') {
            try {
              analysis = JSON.parse(content.text.replace(/```json?\n?|```$/g, ''));
            } catch {
              analysis = { rawAnalysis: content.text };
            }
          }

          return {
            data: {
              ...state.data,
              phase: 'site_analysis',
              siteAnalysis: analysis,
            },
          };
        },
      },
      {
        name: 'due_diligence',
        execute: async (state) => {
          return {
            data: {
              ...state.data,
              phase: 'due_diligence',
              ddStatus: 'in_progress',
            },
          };
        },
      },
      {
        name: 'lease_negotiation',
        execute: async (state) => {
          return {
            data: {
              ...state.data,
              phase: 'lease_negotiation',
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
              'Lease requires attorney review before execution',
              {
                urgency: 'high',
                context: {
                  leaseTerms: state.data.leaseTerms,
                  parcel: state.data.parcel,
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
            },
          };
        },
      },
      {
        name: 'execute_lease',
        execute: async (state) => {
          if (!state.data.legalApproved) {
            return {
              data: {
                ...state.data,
                phase: 'rejected',
                status: 'lease_rejected',
              },
            };
          }
          return {
            data: {
              ...state.data,
              phase: 'executed',
              executedAt: new Date(),
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
   */
  private registerProjectLifecycleWorkflow(): void {
    const nodes: WorkflowNode[] = [
      {
        name: 'prospecting',
        execute: async (state) => {
          return {
            data: {
              ...state.data,
              phase: 'prospecting',
              phaseStartedAt: new Date(),
            },
          };
        },
      },
      {
        name: 'site_control',
        execute: async (state) => {
          // Would trigger land acquisition sub-workflow
          return {
            data: {
              ...state.data,
              phase: 'site_control',
            },
          };
        },
      },
      {
        name: 'development',
        execute: async (state) => {
          return {
            data: {
              ...state.data,
              phase: 'development',
            },
          };
        },
      },
      {
        name: 'construction_ready',
        execute: async (state) => {
          // Final approval gate
          if (!state.data.hitlResponse) {
            await this.createHITLInterrupt(
              state,
              'Project ready for construction - final approval required',
              {
                urgency: 'critical',
                context: {
                  projectId: state.data.projectId,
                  projectSummary: state.data.summary,
                },
              }
            );
            return { status: 'paused' };
          }

          return {
            data: {
              ...state.data,
              phase: 'approved',
              approvedAt: new Date(),
            },
          };
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
