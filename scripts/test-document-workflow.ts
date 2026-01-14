/**
 * Document Processing Workflow Test Script
 *
 * This script tests the end-to-end document processing workflow
 * using sample test data.
 *
 * Usage: npx ts-node scripts/test-document-workflow.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test fixtures
const sampleLease = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../test-fixtures/sample-lease.json'), 'utf-8')
);

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration: number;
}

const testResults: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await testFn();
    testResults.push({
      name,
      passed: true,
      message: 'Success',
      duration: Date.now() - start,
    });
    console.log(`  \x1b[32m[PASS]\x1b[0m ${name}`);
  } catch (error) {
    testResults.push({
      name,
      passed: false,
      message: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    });
    console.log(`  \x1b[31m[FAIL]\x1b[0m ${name}: ${error}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

// Simulated Document Processor (mirrors the actual processor logic)
class MockDocumentProcessor {
  async classifyDocument(text: string): Promise<{ category: string; confidence: number }> {
    // Simple classification logic for testing
    if (text.toLowerCase().includes('lease agreement')) {
      return { category: 'lease', confidence: 0.95 };
    } else if (text.toLowerCase().includes('power purchase agreement')) {
      return { category: 'ppa', confidence: 0.97 };
    } else if (text.toLowerCase().includes('environmental site assessment')) {
      return { category: 'environmental', confidence: 0.94 };
    }
    return { category: 'unknown', confidence: 0.3 };
  }

  async extractLeaseData(text: string): Promise<Record<string, unknown>> {
    // Extract key information using pattern matching (simplified)
    const extractNumber = (pattern: RegExp): number | null => {
      const match = text.match(pattern);
      return match ? parseFloat(match[1]) : null;
    };

    const extractString = (pattern: RegExp): string | null => {
      const match = text.match(pattern);
      return match ? match[1].trim() : null;
    };

    return {
      lessor: {
        name: extractString(/Lessor:\s*([^,]+)/i) || extractString(/Landowner['":\s]+([^,\n]+)/i),
      },
      lessee: {
        name: extractString(/Lessee:\s*([^,]+)/i) || extractString(/Developer['":\s]+([^,\n]+)/i),
      },
      totalAcres: extractNumber(/(\d+)\s*acres/i),
      county: extractString(/County[:\s]+(\w+)/i),
      state: extractString(/,\s*(\w{2})\s+\d{5}/),
      initialTermYears: extractNumber(/(\d+)\s*years/i),
      rent: {
        baseRentPerAcre: extractNumber(/\$(\d+)\s*per\s*acre/i),
        signingBonus: extractNumber(/signing\s*bonus[:\s]+\$?(\d+(?:,\d{3})*)/i),
      },
    };
  }

  calculateConfidence(extractedData: Record<string, unknown>): number {
    const criticalFields = ['lessor', 'totalAcres', 'initialTermYears', 'rent'];
    let foundCount = 0;

    criticalFields.forEach((field) => {
      const value = extractedData[field];
      if (value !== null && value !== undefined) {
        if (typeof value === 'object') {
          const innerValues = Object.values(value as Record<string, unknown>);
          if (innerValues.some((v) => v !== null && v !== undefined)) {
            foundCount++;
          }
        } else {
          foundCount++;
        }
      }
    });

    return foundCount / criticalFields.length;
  }

  determineHITLRequired(
    category: string,
    confidence: number,
    extractedData: Record<string, unknown>
  ): { required: boolean; reasons: string[] } {
    const reasons: string[] = [];
    const legalDocs = ['lease', 'option', 'easement', 'ppa'];

    if (legalDocs.includes(category)) {
      reasons.push('Legal document requires attorney review');
    }

    if (confidence < 0.9) {
      reasons.push(`Extraction confidence (${Math.round(confidence * 100)}%) below 90% threshold`);
    }

    const rent = extractedData.rent as Record<string, number> | undefined;
    if (rent?.signingBonus && rent.signingBonus > 10000) {
      reasons.push('Financial commitment > $10,000 requires approval');
    }

    return {
      required: reasons.length > 0,
      reasons,
    };
  }
}

// Simulated Workflow Orchestrator (mirrors the actual orchestrator logic)
class MockWorkflowOrchestrator {
  private state: Record<string, unknown> = {};

  async initializeWorkflow(workflowId: string, documentId: string): Promise<void> {
    this.state = {
      workflowId,
      status: 'pending',
      currentNode: 'start',
      data: { documentId },
      history: [],
    };
  }

  async transitionTo(node: string, data: Record<string, unknown> = {}): Promise<void> {
    const history = this.state.history as Array<Record<string, unknown>>;
    history.push({
      node: this.state.currentNode,
      timestamp: new Date().toISOString(),
      data: { ...data },
    });

    this.state.currentNode = node;
    this.state.data = { ...(this.state.data as Record<string, unknown>), ...data };
    this.state.status = 'running';
  }

  async pauseAtHITL(reasons: string[]): Promise<void> {
    this.state.status = 'paused';
    (this.state.data as Record<string, unknown>).hitlReasons = reasons;
    (this.state.data as Record<string, unknown>).requiresHITL = true;
  }

  async resumeFromHITL(approved: boolean, notes: string): Promise<void> {
    if (!approved) {
      this.state.status = 'failed';
      (this.state.data as Record<string, unknown>).hitlResponse = { approved, notes };
      return;
    }

    this.state.status = 'running';
    (this.state.data as Record<string, unknown>).hitlResponse = {
      approved,
      notes,
      timestamp: new Date().toISOString(),
    };
  }

  async complete(): Promise<void> {
    this.state.status = 'completed';
    this.state.currentNode = 'complete';
  }

  getState(): Record<string, unknown> {
    return { ...this.state };
  }
}

async function runDocumentWorkflowTests(): Promise<void> {
  console.log('\n========================================');
  console.log('  Document Processing Workflow Tests');
  console.log('========================================\n');

  const processor = new MockDocumentProcessor();
  const orchestrator = new MockWorkflowOrchestrator();

  // Test 1: Document Classification
  await runTest('Classify lease document', async () => {
    const result = await processor.classifyDocument(sampleLease.documentText);
    assert(result.category === 'lease', `Expected 'lease', got '${result.category}'`);
    assert(result.confidence >= 0.9, `Expected confidence >= 0.9, got ${result.confidence}`);
  });

  // Test 2: Lease Data Extraction
  await runTest('Extract lease data', async () => {
    const data = await processor.extractLeaseData(sampleLease.documentText);
    const lessor = data.lessor as Record<string, string> | undefined;
    assert(lessor?.name !== null, 'Lessor name should be extracted');
    assert(data.totalAcres === 500, `Expected 500 acres, got ${data.totalAcres}`);
  });

  // Test 3: Confidence Calculation
  await runTest('Calculate extraction confidence', async () => {
    const data = await processor.extractLeaseData(sampleLease.documentText);
    const confidence = processor.calculateConfidence(data);
    assert(confidence > 0.5, `Expected confidence > 0.5, got ${confidence}`);
  });

  // Test 4: HITL Determination
  await runTest('Determine HITL requirements', async () => {
    const classification = await processor.classifyDocument(sampleLease.documentText);
    const data = await processor.extractLeaseData(sampleLease.documentText);
    const confidence = processor.calculateConfidence(data);
    const hitl = processor.determineHITLRequired(classification.category, confidence, data);
    assert(hitl.required === true, 'HITL should be required for legal documents');
    assert(hitl.reasons.length > 0, 'Should have HITL reasons');
  });

  // Test 5: Workflow State Transitions
  await runTest('Workflow state initialization', async () => {
    await orchestrator.initializeWorkflow('wf-test-001', 'doc-test-001');
    const state = orchestrator.getState();
    assert(state.status === 'pending', 'Initial status should be pending');
    assert(state.currentNode === 'start', 'Initial node should be start');
  });

  // Test 6: Workflow Node Transitions
  await runTest('Workflow node transitions', async () => {
    await orchestrator.transitionTo('classify', { category: 'lease', confidence: 0.95 });
    let state = orchestrator.getState();
    assert(state.currentNode === 'classify', 'Should be at classify node');

    await orchestrator.transitionTo('extract', { extractedData: {} });
    state = orchestrator.getState();
    assert(state.currentNode === 'extract', 'Should be at extract node');
  });

  // Test 7: HITL Pause
  await runTest('Workflow HITL pause', async () => {
    await orchestrator.pauseAtHITL(['Legal document requires review']);
    const state = orchestrator.getState();
    assert(state.status === 'paused', 'Status should be paused');
  });

  // Test 8: HITL Resume with Approval
  await runTest('Workflow HITL resume (approved)', async () => {
    await orchestrator.resumeFromHITL(true, 'Approved by attorney');
    const state = orchestrator.getState();
    assert(state.status === 'running', 'Status should be running after approval');
  });

  // Test 9: Workflow Completion
  await runTest('Workflow completion', async () => {
    await orchestrator.complete();
    const state = orchestrator.getState();
    assert(state.status === 'completed', 'Status should be completed');
    assert(state.currentNode === 'complete', 'Should be at complete node');
  });

  // Test 10: End-to-End Workflow
  await runTest('End-to-end document processing', async () => {
    const newOrchestrator = new MockWorkflowOrchestrator();
    await newOrchestrator.initializeWorkflow('wf-e2e-001', 'doc-e2e-001');

    // Classify
    const classification = await processor.classifyDocument(sampleLease.documentText);
    await newOrchestrator.transitionTo('classify', classification);

    // Extract
    const extractedData = await processor.extractLeaseData(sampleLease.documentText);
    const confidence = processor.calculateConfidence(extractedData);
    await newOrchestrator.transitionTo('extract', { extractedData, confidence });

    // Validate
    await newOrchestrator.transitionTo('validate', { validationPassed: true });

    // HITL Gate
    const hitl = processor.determineHITLRequired(classification.category, confidence, extractedData);
    if (hitl.required) {
      await newOrchestrator.pauseAtHITL(hitl.reasons);
      const pausedState = newOrchestrator.getState();
      assert(pausedState.status === 'paused', 'Should pause at HITL');

      // Simulate HITL approval
      await newOrchestrator.resumeFromHITL(true, 'Approved');
    }

    // Complete
    await newOrchestrator.complete();
    const finalState = newOrchestrator.getState();
    assert(finalState.status === 'completed', 'Workflow should complete');
  });

  // Print Summary
  console.log('\n----------------------------------------');
  const passed = testResults.filter((r) => r.passed).length;
  const failed = testResults.filter((r) => !r.passed).length;
  console.log(`\nTotal: ${testResults.length} tests`);
  console.log(`  \x1b[32mPassed: ${passed}\x1b[0m`);
  console.log(`  \x1b[31mFailed: ${failed}\x1b[0m`);
  console.log(`  Total duration: ${testResults.reduce((sum, r) => sum + r.duration, 0)}ms`);
  console.log('----------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runDocumentWorkflowTests().catch(console.error);
