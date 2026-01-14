/**
 * CrewAI-style Agent Runner
 *
 * This implements a multi-agent system inspired by CrewAI.
 * Since CrewAI is Python-based, this is a TypeScript adaptation:
 *
 * HOW IT WORKS:
 * 1. Agents are defined with roles, goals, and tools
 * 2. Each agent specializes in specific tasks
 * 3. Agents can collaborate by sharing context
 * 4. Tools are functions that agents can call
 *
 * AGENT TYPES:
 * - Site Researcher: Evaluates parcels for solar suitability
 * - Lease Analyst: Analyzes and compares lease terms
 * - DD Coordinator: Manages due diligence process
 * - Stakeholder Manager: Prepares communications (NEVER auto-sends)
 */

import Anthropic from '@anthropic-ai/sdk';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// ============================================
// Types
// ============================================

interface AgentDefinition {
  name: string;
  role: string;
  goal: string;
  backstory: string;
  tools: AgentTool[];
}

interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string }>;
  execute: (params: Record<string, any>) => Promise<any>;
}

interface TaskResult {
  success: boolean;
  output: Record<string, any>;
  reasoning: string;
  toolsUsed: string[];
  requiresReview: boolean;
  reviewReasons: string[];
}

// ============================================
// Agent Runner
// ============================================

export class AgentRunner {
  private anthropic: Anthropic;
  private agents: Map<string, AgentDefinition> = new Map();

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Register agents
    this.registerAgents();
  }

  /**
   * Run a task with a specific agent
   */
  async runTask(
    agentType: string,
    taskInput: Record<string, any>
  ): Promise<TaskResult> {
    const agent = this.agents.get(agentType);
    if (!agent) {
      throw new Error(`Unknown agent type: ${agentType}`);
    }

    console.log(`Running ${agent.name} agent...`);

    // Build tool descriptions for Claude
    const toolDescriptions = agent.tools
      .map(
        (t) =>
          `- ${t.name}: ${t.description}\n  Parameters: ${JSON.stringify(t.parameters)}`
      )
      .join('\n');

    // Create agent prompt
    const prompt = `You are ${agent.name}, a specialized AI agent.

ROLE: ${agent.role}
GOAL: ${agent.goal}
BACKSTORY: ${agent.backstory}

AVAILABLE TOOLS:
${toolDescriptions}

TASK INPUT:
${JSON.stringify(taskInput, null, 2)}

INSTRUCTIONS:
1. Analyze the task and determine which tools to use
2. For each tool needed, specify: {"tool": "tool_name", "params": {...}}
3. Provide your analysis and recommendations
4. If external communications are needed, prepare them but note they require human approval

Respond with JSON:
{
  "reasoning": "Your step-by-step thinking",
  "toolCalls": [{"tool": "name", "params": {...}}],
  "analysis": {...your analysis results...},
  "recommendations": [...],
  "requiresReview": boolean,
  "reviewReasons": [...if any...]
}`;

    // Call Claude
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    // Parse response
    let agentOutput: any = {};
    const content = response.content[0];
    if (content.type === 'text') {
      try {
        let jsonText = content.text.trim();
        if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/```json?\n?|```$/g, '');
        }
        agentOutput = JSON.parse(jsonText);
      } catch {
        agentOutput = { rawOutput: content.text };
      }
    }

    // Execute tool calls
    const toolResults: Record<string, any> = {};
    const toolsUsed: string[] = [];

    if (agentOutput.toolCalls) {
      for (const call of agentOutput.toolCalls) {
        const tool = agent.tools.find((t) => t.name === call.tool);
        if (tool) {
          try {
            toolResults[call.tool] = await tool.execute(call.params);
            toolsUsed.push(call.tool);
          } catch (error) {
            toolResults[call.tool] = { error: String(error) };
          }
        }
      }
    }

    // Compile final result
    return {
      success: true,
      output: {
        ...agentOutput.analysis,
        recommendations: agentOutput.recommendations,
        toolResults,
      },
      reasoning: agentOutput.reasoning || '',
      toolsUsed,
      requiresReview: agentOutput.requiresReview || false,
      reviewReasons: agentOutput.reviewReasons || [],
    };
  }

  /**
   * Register all agent definitions
   */
  private registerAgents(): void {
    // Site Researcher Agent
    this.agents.set('site_researcher', {
      name: 'Site Researcher',
      role: 'Site Acquisition Specialist',
      goal: 'Identify and evaluate potential solar development sites based on technical and regulatory criteria',
      backstory: `You are an experienced site acquisition specialist with deep
        knowledge of solar project siting requirements. You understand zoning laws,
        environmental constraints, grid proximity requirements, and land characteristics
        that make sites suitable for utility-scale solar development.`,
      tools: [
        this.createSearchParcelsTool(),
        this.createGetParcelDetailsTool(),
        this.createCheckZoningTool(),
        this.createCheckEnvironmentalTool(),
        this.createCalculateBuildableAreaTool(),
      ],
    });

    // Lease Analyst Agent
    this.agents.set('lease_analyst', {
      name: 'Lease Analyst',
      role: 'Real Estate Analyst',
      goal: 'Analyze lease terms, identify risks, and recommend optimal deal structures',
      backstory: `You are a real estate professional specializing in solar land
        leases. You understand market rates, standard terms, risk factors, and
        negotiation strategies for solar development agreements.`,
      tools: [
        this.createExtractLeaseTermsTool(),
        this.createCompareMarketRatesTool(),
        this.createIdentifyRisksTool(),
      ],
    });

    // Due Diligence Coordinator Agent
    this.agents.set('dd_coordinator', {
      name: 'Due Diligence Coordinator',
      role: 'Project Manager',
      goal: 'Coordinate and synthesize due diligence findings across all workstreams',
      backstory: `You are a meticulous project manager who ensures no stone
        is left unturned during site due diligence. You coordinate environmental
        studies, title reviews, survey work, and regulatory research.`,
      tools: [
        this.createTrackDDStatusTool(),
        this.createSynthesizeFindingsTool(),
      ],
    });

    // Stakeholder Manager Agent (NO AUTO-COMMUNICATIONS)
    this.agents.set('stakeholder_manager', {
      name: 'Stakeholder Manager',
      role: 'Relationship Manager',
      goal: 'Manage landowner relationships and coordinate stakeholder communications',
      backstory: `You are a skilled relationship manager with experience in
        landowner negotiations. You understand the sensitivities of rural communities
        and know how to build trust with property owners.

        CRITICAL: You NEVER send communications automatically.
        All external communications must be prepared for human review and approval.`,
      tools: [
        this.createDraftCommunicationTool(),
        // Note: No send tool - all communications require HITL
      ],
    });
  }

  // ============================================
  // Tool Definitions
  // ============================================

  private createSearchParcelsTool(): AgentTool {
    return {
      name: 'search_parcels',
      description: 'Search for parcels matching criteria in the database',
      parameters: {
        county: { type: 'string', description: 'County name' },
        state: { type: 'string', description: 'State abbreviation' },
        minAcres: { type: 'number', description: 'Minimum acreage' },
        maxAcres: { type: 'number', description: 'Maximum acreage' },
      },
      execute: async (params) => {
        // In production, query actual parcel database
        const snapshot = await db
          .collection('parcels')
          .where('county', '==', params.county)
          .where('state', '==', params.state)
          .where('acres', '>=', params.minAcres || 0)
          .where('acres', '<=', params.maxAcres || 10000)
          .limit(50)
          .get();

        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      },
    };
  }

  private createGetParcelDetailsTool(): AgentTool {
    return {
      name: 'get_parcel_details',
      description: 'Get detailed information about a specific parcel',
      parameters: {
        parcelId: { type: 'string', description: 'Parcel ID or APN' },
      },
      execute: async (params) => {
        const doc = await db.doc(`parcels/${params.parcelId}`).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
      },
    };
  }

  private createCheckZoningTool(): AgentTool {
    return {
      name: 'check_zoning',
      description: 'Check zoning designation and permitted uses',
      parameters: {
        parcelId: { type: 'string', description: 'Parcel ID' },
      },
      execute: async (params) => {
        // In production, query zoning database or API
        return {
          parcelId: params.parcelId,
          zoning: 'Agricultural',
          permitsSolar: true,
          requiresCUP: true,
          setbacks: { front: 50, side: 25, rear: 25 },
          heightLimit: 15,
        };
      },
    };
  }

  private createCheckEnvironmentalTool(): AgentTool {
    return {
      name: 'check_environmental',
      description: 'Check environmental constraints',
      parameters: {
        parcelId: { type: 'string', description: 'Parcel ID' },
      },
      execute: async (params) => {
        // In production, query environmental databases
        return {
          parcelId: params.parcelId,
          wetlands: { present: false, acresAffected: 0 },
          floodZone: { zone: 'X', inFloodway: false },
          endangeredSpecies: { present: false, species: [] },
          historicSites: { present: false },
          primeAg: { isPrimeFarmland: true },
        };
      },
    };
  }

  private createCalculateBuildableAreaTool(): AgentTool {
    return {
      name: 'calculate_buildable_area',
      description: 'Calculate buildable area after setbacks and constraints',
      parameters: {
        parcelId: { type: 'string', description: 'Parcel ID' },
        totalAcres: { type: 'number', description: 'Total parcel acres' },
      },
      execute: async (params) => {
        // Simplified calculation
        const totalAcres = params.totalAcres || 100;
        const setbackReduction = 0.1; // 10% for setbacks
        const constraintReduction = 0.05; // 5% for misc constraints
        const buildableAcres = totalAcres * (1 - setbackReduction - constraintReduction);
        const dcCapacityMw = buildableAcres * 0.2; // ~5 acres per MW DC

        return {
          parcelId: params.parcelId,
          totalAcres,
          buildableAcres,
          reductionFactors: { setbacks: setbackReduction, constraints: constraintReduction },
          estimatedDcCapacityMw: dcCapacityMw,
          estimatedAcCapacityMw: dcCapacityMw * 0.77, // DC/AC ratio
        };
      },
    };
  }

  private createExtractLeaseTermsTool(): AgentTool {
    return {
      name: 'extract_lease_terms',
      description: 'Extract structured lease terms from document',
      parameters: {
        documentId: { type: 'string', description: 'Document ID' },
      },
      execute: async (params) => {
        const doc = await db.doc(`documents/${params.documentId}`).get();
        if (!doc.exists) return null;

        const data = doc.data();
        return data?.extractedData || null;
      },
    };
  }

  private createCompareMarketRatesTool(): AgentTool {
    return {
      name: 'compare_market_rates',
      description: 'Compare lease terms against market rates',
      parameters: {
        state: { type: 'string', description: 'State' },
        county: { type: 'string', description: 'County' },
        rentPerAcre: { type: 'number', description: 'Proposed rent per acre' },
      },
      execute: async (params) => {
        // In production, query market rate database
        const marketRate = { low: 300, median: 500, high: 800 };
        const proposed = params.rentPerAcre || 0;

        return {
          county: params.county,
          state: params.state,
          marketRates: marketRate,
          proposedRate: proposed,
          percentileRank:
            proposed < marketRate.low
              ? 'below market'
              : proposed > marketRate.high
              ? 'above market'
              : 'at market',
          recommendation:
            proposed < marketRate.median * 0.8
              ? 'negotiate higher'
              : 'acceptable',
        };
      },
    };
  }

  private createIdentifyRisksTool(): AgentTool {
    return {
      name: 'identify_risks',
      description: 'Identify risks in lease terms',
      parameters: {
        leaseTerms: { type: 'object', description: 'Extracted lease terms' },
      },
      execute: async (params) => {
        const risks: string[] = [];
        const terms = params.leaseTerms || {};

        // Check for common risk factors
        if (!terms.extensionOptions || terms.extensionOptions.length === 0) {
          risks.push('No extension options - limits project flexibility');
        }
        if (terms.rent?.annualEscalationPercent && terms.rent.annualEscalationPercent > 3) {
          risks.push('High escalation rate may impact project economics');
        }
        if (!terms.purchaseOption?.exists) {
          risks.push('No purchase option - consider negotiating');
        }
        if (terms.terminationProvisions?.some((p: string) => p.includes('30 days'))) {
          risks.push('Short termination notice period is risky');
        }

        return {
          riskCount: risks.length,
          risks,
          overallRisk: risks.length > 2 ? 'high' : risks.length > 0 ? 'medium' : 'low',
        };
      },
    };
  }

  private createTrackDDStatusTool(): AgentTool {
    return {
      name: 'track_dd_status',
      description: 'Track due diligence workstream status',
      parameters: {
        projectId: { type: 'string', description: 'Project ID' },
      },
      execute: async (params) => {
        // In production, query DD tracking database
        return {
          projectId: params.projectId,
          workstreams: {
            title: { status: 'complete', issues: 0 },
            environmental: { status: 'in_progress', issues: 0 },
            survey: { status: 'pending', issues: 0 },
            zoning: { status: 'complete', issues: 1 },
            interconnection: { status: 'in_progress', issues: 0 },
          },
          overallProgress: 60,
          blockers: ['Awaiting Phase I ESA report'],
        };
      },
    };
  }

  private createSynthesizeFindingsTool(): AgentTool {
    return {
      name: 'synthesize_findings',
      description: 'Synthesize DD findings into go/no-go recommendation',
      parameters: {
        ddStatus: { type: 'object', description: 'DD status object' },
      },
      execute: async (params) => {
        const status = params.ddStatus || {};
        const workstreams = Object.values(status.workstreams || {}) as any[];

        const completeCount = workstreams.filter((w) => w.status === 'complete').length;
        const issueCount = workstreams.reduce((sum, w) => sum + (w.issues || 0), 0);

        return {
          recommendation:
            completeCount === workstreams.length && issueCount === 0
              ? 'proceed'
              : issueCount > 2
              ? 'hold'
              : 'proceed_with_conditions',
          completionRate: (completeCount / workstreams.length) * 100,
          openIssues: issueCount,
          summary: `${completeCount}/${workstreams.length} workstreams complete, ${issueCount} open issues`,
        };
      },
    };
  }

  private createDraftCommunicationTool(): AgentTool {
    return {
      name: 'draft_communication',
      description:
        'Draft a communication for stakeholder (REQUIRES HUMAN REVIEW - never sent automatically)',
      parameters: {
        recipient: { type: 'string', description: 'Recipient name/role' },
        subject: { type: 'string', description: 'Subject' },
        purpose: { type: 'string', description: 'Purpose of communication' },
        context: { type: 'object', description: 'Relevant context' },
      },
      execute: async (params) => {
        // This tool only drafts - NEVER sends
        return {
          draft: {
            to: params.recipient,
            subject: params.subject,
            body: `[DRAFT - REQUIRES REVIEW]

Purpose: ${params.purpose}

Context: ${JSON.stringify(params.context, null, 2)}

[This is a draft communication that requires human review and approval before sending]`,
          },
          requiresApproval: true,
          warning: 'This communication has NOT been sent. Human approval required.',
        };
      },
    };
  }
}
