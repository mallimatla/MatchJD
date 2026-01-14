/**
 * Agent System Test Script
 *
 * This script tests the CrewAI-style agent system using
 * sample test data.
 *
 * Usage: npx ts-node scripts/test-agent-system.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Load test fixtures
const sampleParcels = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../test-fixtures/sample-parcels.json'), 'utf-8')
);

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const testResults: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  try {
    await testFn();
    testResults.push({ name, passed: true, message: 'Success' });
    console.log(`  \x1b[32m[PASS]\x1b[0m ${name}`);
  } catch (error) {
    testResults.push({
      name,
      passed: false,
      message: error instanceof Error ? error.message : String(error),
    });
    console.log(`  \x1b[31m[FAIL]\x1b[0m ${name}: ${error}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

// Agent Definitions (mirrors the actual agent system)
interface Agent {
  name: string;
  role: string;
  goal: string;
  tools: string[];
}

const agents: Record<string, Agent> = {
  siteResearcher: {
    name: 'Site Researcher',
    role: 'Site Acquisition Specialist',
    goal: 'Identify and evaluate potential solar development sites',
    tools: ['search_parcels', 'get_parcel_details', 'check_zoning', 'check_environmental', 'calculate_buildable_area'],
  },
  leaseAnalyst: {
    name: 'Lease Analyst',
    role: 'Real Estate Analyst',
    goal: 'Analyze lease terms and identify risks',
    tools: ['extract_lease_terms', 'compare_market_rates', 'identify_risks', 'calculate_npv'],
  },
  ddCoordinator: {
    name: 'DD Coordinator',
    role: 'Due Diligence Manager',
    goal: 'Coordinate and track due diligence workstreams',
    tools: ['track_dd_status', 'assign_workstream', 'generate_checklist', 'synthesize_findings'],
  },
  stakeholderManager: {
    name: 'Stakeholder Manager',
    role: 'Relationship Manager',
    goal: 'Manage stakeholder communications',
    tools: ['draft_communication'], // CRITICAL: No send capability
  },
};

// Mock Tool Implementations
const tools = {
  search_parcels: async (params: { county: string; state: string; minAcres: number; maxAcres: number }) => {
    return sampleParcels.parcels.filter(
      (p: { county: string; state: string; totalAcres: number }) =>
        p.county === params.county &&
        p.state === params.state &&
        p.totalAcres >= params.minAcres &&
        p.totalAcres <= params.maxAcres
    );
  },

  get_parcel_details: async (parcelId: string) => {
    return sampleParcels.parcels.find((p: { id: string }) => p.id === parcelId) || null;
  },

  check_zoning: async (parcelId: string) => {
    const parcel = sampleParcels.parcels.find((p: { id: string }) => p.id === parcelId);
    return parcel?.zoning || null;
  },

  check_environmental: async (parcelId: string) => {
    const parcel = sampleParcels.parcels.find((p: { id: string }) => p.id === parcelId);
    return parcel?.environmental || null;
  },

  calculate_buildable_area: async (params: { parcelId: string; totalAcres: number }) => {
    const parcel = sampleParcels.parcels.find((p: { id: string }) => p.id === params.parcelId);
    const setbackReduction = 0.1;
    const wetlandReduction = parcel?.environmental?.wetlands?.acres || 0;
    const buildableAcres = params.totalAcres * (1 - setbackReduction) - wetlandReduction;

    return {
      parcelId: params.parcelId,
      totalAcres: params.totalAcres,
      buildableAcres,
      estimatedDcCapacityMw: buildableAcres * 0.17,
    };
  },

  compare_market_rates: async (params: { county: string; state: string; rentPerAcre: number }) => {
    const rates = sampleParcels.marketRates.solarLeaseRates;
    const proposed = params.rentPerAcre;

    return {
      marketRates: rates,
      proposedRate: proposed,
      percentileRank:
        proposed < rates.low ? 'below market' : proposed > rates.high ? 'above market' : 'at market',
      recommendation: proposed < rates.median * 0.8 ? 'negotiate higher' : 'acceptable',
    };
  },

  identify_risks: async (leaseTerms: {
    extensionOptions?: unknown[];
    rent?: { annualEscalationPercent?: number };
    purchaseOption?: { exists?: boolean };
  }) => {
    const risks: string[] = [];

    if (!leaseTerms.extensionOptions || leaseTerms.extensionOptions.length === 0) {
      risks.push('No extension options');
    }
    if (leaseTerms.rent?.annualEscalationPercent && leaseTerms.rent.annualEscalationPercent > 3) {
      risks.push('High escalation rate');
    }
    if (!leaseTerms.purchaseOption?.exists) {
      risks.push('No purchase option');
    }

    return {
      riskCount: risks.length,
      risks,
      overallRisk: risks.length > 2 ? 'high' : risks.length > 0 ? 'medium' : 'low',
    };
  },

  draft_communication: async (params: { recipient: string; subject: string; purpose: string }) => {
    return {
      draft: {
        to: params.recipient,
        subject: params.subject,
        body: `[DRAFT - REQUIRES REVIEW]\n\nPurpose: ${params.purpose}\n\nThis communication has been drafted for your review.`,
      },
      requiresApproval: true,
      warning: 'This communication has NOT been sent. Human approval required.',
    };
  },

  track_dd_status: async (projectId: string) => {
    return {
      projectId,
      workstreams: {
        title: { status: 'complete', issues: 0 },
        environmental: { status: 'in_progress', issues: 0 },
        survey: { status: 'pending', issues: 0 },
        zoning: { status: 'complete', issues: 1 },
      },
      overallProgress: 60,
    };
  },

  synthesize_findings: async (ddStatus: {
    workstreams: Record<string, { status: string; issues: number }>;
  }) => {
    const workstreams = Object.values(ddStatus.workstreams);
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
    };
  },
};

async function runAgentSystemTests(): Promise<void> {
  console.log('\n========================================');
  console.log('  Agent System Tests');
  console.log('========================================\n');

  // Test Agent Definitions
  console.log('--- Agent Definition Tests ---\n');

  await runTest('Site Researcher has correct tools', async () => {
    const agent = agents.siteResearcher;
    assert(agent.tools.includes('search_parcels'), 'Should have search_parcels');
    assert(agent.tools.includes('check_zoning'), 'Should have check_zoning');
    assert(agent.tools.includes('check_environmental'), 'Should have check_environmental');
  });

  await runTest('Lease Analyst has correct tools', async () => {
    const agent = agents.leaseAnalyst;
    assert(agent.tools.includes('compare_market_rates'), 'Should have compare_market_rates');
    assert(agent.tools.includes('identify_risks'), 'Should have identify_risks');
  });

  await runTest('Stakeholder Manager has NO send capability (HITL-safe)', async () => {
    const agent = agents.stakeholderManager;
    assert(!agent.tools.includes('send_email'), 'Should NOT have send_email');
    assert(!agent.tools.includes('send_communication'), 'Should NOT have send_communication');
    assert(!agent.tools.includes('send'), 'Should NOT have send');
    assert(agent.tools.includes('draft_communication'), 'Should have draft_communication');
  });

  // Test Site Research Tools
  console.log('\n--- Site Research Tool Tests ---\n');

  await runTest('Search parcels by criteria', async () => {
    const results = await tools.search_parcels({
      county: 'Travis',
      state: 'TX',
      minAcres: 100,
      maxAcres: 600,
    });
    assert(results.length > 0, 'Should find parcels');
    assert(results.every((p: { county: string }) => p.county === 'Travis'), 'All should be in Travis county');
  });

  await runTest('Get parcel details', async () => {
    const parcel = await tools.get_parcel_details('parcel-001');
    assert(parcel !== null, 'Should find parcel');
    assert(parcel.totalAcres === 500, 'Should have correct acreage');
  });

  await runTest('Check zoning', async () => {
    const zoning = await tools.check_zoning('parcel-001');
    assert(zoning !== null, 'Should have zoning info');
    assert(zoning.permitsSolar === true, 'Should permit solar');
  });

  await runTest('Check environmental constraints', async () => {
    const env = await tools.check_environmental('parcel-003');
    assert(env !== null, 'Should have environmental info');
    assert(env.wetlands.present === true, 'Should identify wetlands');
    assert(env.endangeredSpecies.present === true, 'Should identify endangered species');
  });

  await runTest('Calculate buildable area', async () => {
    const result = await tools.calculate_buildable_area({
      parcelId: 'parcel-001',
      totalAcres: 500,
    });
    assert(result.buildableAcres < result.totalAcres, 'Buildable should be less than total');
    assert(result.estimatedDcCapacityMw > 0, 'Should estimate capacity');
  });

  // Test Lease Analysis Tools
  console.log('\n--- Lease Analysis Tool Tests ---\n');

  await runTest('Compare market rates', async () => {
    const result = await tools.compare_market_rates({
      county: 'Travis',
      state: 'TX',
      rentPerAcre: 500,
    });
    assert(result.percentileRank === 'at market', 'Should be at market');
    assert(result.recommendation === 'acceptable', 'Should be acceptable');
  });

  await runTest('Compare below market rates', async () => {
    const result = await tools.compare_market_rates({
      county: 'Travis',
      state: 'TX',
      rentPerAcre: 200,
    });
    assert(result.percentileRank === 'below market', 'Should be below market');
    assert(result.recommendation === 'negotiate higher', 'Should recommend negotiating');
  });

  await runTest('Identify lease risks - no risks', async () => {
    const result = await tools.identify_risks({
      extensionOptions: [{ termYears: 5 }],
      rent: { annualEscalationPercent: 2 },
      purchaseOption: { exists: true },
    });
    assert(result.riskCount === 0, 'Should have no risks');
    assert(result.overallRisk === 'low', 'Overall risk should be low');
  });

  await runTest('Identify lease risks - multiple risks', async () => {
    const result = await tools.identify_risks({
      extensionOptions: [],
      rent: { annualEscalationPercent: 5 },
      purchaseOption: { exists: false },
    });
    assert(result.riskCount === 3, 'Should have 3 risks');
    assert(result.overallRisk === 'high', 'Overall risk should be high');
  });

  // Test Stakeholder Tools (HITL-safe)
  console.log('\n--- Stakeholder Communication Tests (HITL) ---\n');

  await runTest('Draft communication - requires approval', async () => {
    const result = await tools.draft_communication({
      recipient: 'Landowner John Smith',
      subject: 'Solar Lease Interest',
      purpose: 'Initial outreach',
    });
    assert(result.requiresApproval === true, 'Should require approval');
    assert(result.warning.includes('NOT been sent'), 'Should warn not sent');
    assert(result.draft.body.includes('DRAFT - REQUIRES REVIEW'), 'Draft should be marked');
  });

  // Test DD Coordination Tools
  console.log('\n--- Due Diligence Coordination Tests ---\n');

  await runTest('Track DD status', async () => {
    const status = await tools.track_dd_status('project-001');
    assert(status.workstreams.title.status === 'complete', 'Title should be complete');
    assert(status.overallProgress === 60, 'Progress should be 60%');
  });

  await runTest('Synthesize findings - proceed with conditions', async () => {
    const ddStatus = await tools.track_dd_status('project-001');
    const synthesis = await tools.synthesize_findings(ddStatus);
    assert(synthesis.recommendation === 'proceed_with_conditions', 'Should proceed with conditions');
    assert(synthesis.openIssues === 1, 'Should have 1 open issue');
  });

  await runTest('Synthesize findings - all complete no issues', async () => {
    const synthesis = await tools.synthesize_findings({
      workstreams: {
        title: { status: 'complete', issues: 0 },
        environmental: { status: 'complete', issues: 0 },
        survey: { status: 'complete', issues: 0 },
        zoning: { status: 'complete', issues: 0 },
      },
    });
    assert(synthesis.recommendation === 'proceed', 'Should proceed');
    assert(synthesis.completionRate === 100, 'Should be 100% complete');
  });

  // Print Summary
  console.log('\n----------------------------------------');
  const passed = testResults.filter((r) => r.passed).length;
  const failed = testResults.filter((r) => !r.passed).length;
  console.log(`\nTotal: ${testResults.length} tests`);
  console.log(`  \x1b[32mPassed: ${passed}\x1b[0m`);
  console.log(`  \x1b[31mFailed: ${failed}\x1b[0m`);
  console.log('----------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAgentSystemTests().catch(console.error);
