# Neurogrid - Architecture Documentation

## Executive Summary

Neurogrid is an AI-powered solar development platform that automates document processing, site analysis, and project lifecycle management while maintaining human oversight through a Human-in-the-Loop (HITL) workflow system.

---

# Part 1: High-Level Design (HLD)

## 1.1 System Overview

```
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
|   Next.js 14     |<--->|  Firebase Cloud  |<--->|   Anthropic      |
|   Frontend       |     |  Functions       |     |   Claude API     |
|   (Vercel)       |     |  (Node.js 20)    |     |   (AI Engine)    |
|                  |     |                  |     |                  |
+--------+---------+     +--------+---------+     +------------------+
         |                        |
         |                        |
+--------v------------------------v---------+
|                                           |
|           Firebase Platform               |
|  +-------------+  +-------------+         |
|  | Firestore   |  | Storage     |         |
|  | (Database)  |  | (Documents) |         |
|  +-------------+  +-------------+         |
|  +-------------+                          |
|  | Auth        |                          |
|  | (Identity)  |                          |
|  +-------------+                          |
+-------------------------------------------+
```

## 1.2 Core Capabilities

| Capability | Description |
|------------|-------------|
| **Document Intelligence** | AI-powered extraction and classification of legal documents (leases, PPAs, easements) |
| **Workflow Orchestration** | LangGraph-style state machines with pause/resume for human decisions |
| **AI Agents** | CrewAI-style specialized agents for site research, lease analysis, due diligence |
| **HITL Integration** | Human-in-the-loop gates ensuring human oversight on critical decisions |
| **Real-time Collaboration** | Firestore real-time sync for instant UI updates |
| **Multi-tenant Security** | Row-level security with tenant isolation |

## 1.3 Technology Selection Rationale

### Why Next.js 14?
| Reason | Benefit |
|--------|---------|
| **App Router** | Modern file-based routing with nested layouts |
| **Server Components** | Reduced client bundle, better SEO |
| **TypeScript Native** | Full type safety out of the box |
| **Vercel Integration** | Zero-config deployment with edge functions |
| **React 18 Features** | Concurrent rendering, Suspense |

### Why Firebase?
| Reason | Benefit |
|--------|---------|
| **Real-time Database** | Firestore listeners for instant UI updates |
| **Serverless Functions** | No server management, auto-scaling |
| **Built-in Auth** | Email/password + OAuth providers |
| **Storage** | Secure file storage with signed URLs |
| **Security Rules** | Database-level access control |
| **Cost Efficiency** | Pay-per-use, generous free tier |

### Why Claude (Anthropic)?
| Reason | Benefit |
|--------|---------|
| **Document Understanding** | Superior at parsing legal language |
| **Structured Output** | Reliable JSON extraction |
| **Long Context** | 200K token window for full documents |
| **Reasoning** | Explains extraction confidence |
| **Safety** | Built-in content filtering |

### Why LangGraph-style Workflows?
| Reason | Benefit |
|--------|---------|
| **State Persistence** | Workflows survive function restarts |
| **Checkpointing** | Resume from any point after HITL pause |
| **Conditional Routing** | Dynamic next-step determination |
| **Audit Trail** | Complete history of all state transitions |
| **HITL Integration** | Native pause/resume for human decisions |

### Why CrewAI-style Agents?
| Reason | Benefit |
|--------|---------|
| **Role Specialization** | Each agent has focused expertise |
| **Tool Composition** | Agents combine tools for complex tasks |
| **Reasoning Traces** | Transparent decision-making |
| **Extensibility** | Easy to add new agents/tools |

## 1.4 System Context Diagram

```
                              +------------------+
                              |    Landowners    |
                              | (Document Source)|
                              +--------+---------+
                                       |
                                       | Legal Documents
                                       v
+------------------+          +------------------+          +------------------+
|                  |   HTTP   |                  |  Claude  |                  |
|  Solar Developer |<-------->|    Neurogrid     |<-------->|  AI Processing   |
|  (End User)      |  WebApp  |    Platform      |   API    |  Engine          |
|                  |          |                  |          |                  |
+------------------+          +--------+---------+          +------------------+
                                       |
                                       | Persist
                                       v
                              +------------------+
                              |    Firebase      |
                              | (Data Platform)  |
                              +------------------+
```

---

# Part 2: Low-Level Design (LLD)

## 2.1 Frontend Architecture

### Component Hierarchy

```
App (layout.tsx)
├── AuthProvider
│   ├── Dashboard Page
│   │   ├── StatsCards (Projects, Documents, Parcels, Reviews)
│   │   ├── ProjectsList
│   │   │   └── ProjectCard (for each project)
│   │   ├── ReviewQueue
│   │   │   └── ReviewCard (for each HITL request)
│   │   └── NotificationsPanel
│   │
│   ├── Project Detail Page
│   │   ├── ProjectLifecycle (status timeline)
│   │   ├── Tabs
│   │   │   ├── Overview
│   │   │   ├── Documents
│   │   │   │   └── DocumentUpload
│   │   │   ├── Parcels
│   │   │   │   └── ParcelsList
│   │   │   ├── Workflows
│   │   │   │   └── WorkflowStatus
│   │   │   ├── Analysis
│   │   │   │   └── SiteAnalysis
│   │   │   ├── Due Diligence
│   │   │   │   └── DueDiligenceDashboard
│   │   │   └── Financials
│   │   │       └── FinancialSummary
│   │   └── Upload Tab
│   │
│   └── New Project Page
│       └── ProjectForm
│
└── Login Page
    └── AuthForm
```

### State Management Pattern

```typescript
// Real-time Firestore Hooks (src/hooks/useFirestore.ts)

// Generic collection listener with tenant isolation
function useCollection<T>(collectionName: string, options: Options) {
  const [data, setData] = useState<T[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, collectionName),
      where('tenantId', '==', currentUser.uid),
      ...options.constraints
    );

    // Real-time listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setData(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })));
    });

    return () => unsubscribe();
  }, [collectionName, currentUser]);

  return { data, loading, error };
}

// Specialized hooks
useProjects()           // List all projects
useDocuments(projectId) // Project documents
useParcels(projectId)   // Project parcels
useReviewQueue()        // Pending HITL requests
```

## 2.2 Backend Architecture

### Cloud Functions Structure

```
functions/src/
├── index.ts                    # Main entry - exports all functions
├── document-ai/
│   └── processor.ts            # Document processing pipeline
├── workflows/
│   └── orchestrator.ts         # LangGraph-style workflow engine
└── agents/
    └── runner.ts               # CrewAI-style agent execution
```

### Function Categories

```typescript
// 1. DOCUMENT PROCESSING FUNCTIONS
export const onDocumentUploaded = onDocumentUpdated(
  'documents/{documentId}',
  async (event) => {
    // Triggered when document.status → 'processing'
    // Runs full extraction pipeline
  }
);

// 2. HITL FUNCTIONS
export const resolveReview = onCall(async (request) => {
  // Approve/reject HITL request
  // Triggers downstream actions
});

// 3. WORKFLOW FUNCTIONS
export const startWorkflow = onCall(async (request) => {
  // Initialize new workflow instance
  // Begin async execution
});

// 4. AGENT FUNCTIONS
export const runAgentTask = onCall(async (request) => {
  // Execute specialized AI agent
  // Return analysis results
});
```

## 2.3 Document Processing Pipeline

### Stage 1: Text Extraction

```typescript
async extractText(storageUrl: string, mimeType: string): Promise<string> {
  const buffer = await downloadFile(storageUrl);

  switch (mimeType) {
    case 'application/pdf':
      const pdfData = await pdfParse(buffer);
      return pdfData.text;

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      const { value } = await mammoth.extractRawText({ buffer });
      return value;

    case 'application/msword':
      return extractDocText(buffer);

    default:
      return buffer.toString('utf-8');
  }
}
```

### Stage 2: Classification

```typescript
async classifyDocument(text: string): Promise<ClassificationResult> {
  const prompt = `Classify this document into one of these categories:
    - lease: Land lease agreement for solar development
    - ppa: Power Purchase Agreement
    - easement: Access or transmission easement
    - option: Option to lease or purchase
    - title_report: Title commitment or insurance
    - survey: Land survey (ALTA, boundary)
    - interconnection_agreement: Utility interconnection
    - environmental_report: Environmental assessment
    - unknown: Cannot determine

    Document text:
    ${text.substring(0, 50000)}

    Return JSON: { "category": "...", "confidence": 0.0-1.0 }`;

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    messages: [{ role: 'user', content: prompt }]
  });

  return parseJSON(response.content);
}
```

### Stage 3: Structured Extraction

```typescript
// Lease-specific extraction
async extractLeaseData(text: string): Promise<LeaseExtraction> {
  const prompt = `Extract structured data from this lease:

    Return JSON with:
    {
      "lessor": { "name": "", "entityType": "", "address": "" },
      "lessee": { "name": "", "entityType": "", "address": "" },
      "property": {
        "county": "", "state": "", "totalAcres": 0,
        "parcelNumbers": []
      },
      "term": {
        "initialYears": 0,
        "commencementDate": "",
        "expirationDate": "",
        "extensionOptions": [{ "years": 0, "noticeDays": 0 }]
      },
      "rent": {
        "basePerAcre": 0,
        "annualEscalation": 0,
        "signingBonus": 0
      },
      "purchaseOption": { "exists": false, "terms": "" }
    }

    Document: ${text}`;

  return parseJSON(await callClaude(prompt));
}
```

### Stage 4: Confidence Calculation

```typescript
calculateConfidence(
  classificationConfidence: number,
  extractedData: any,
  category: string
): number {
  // Critical fields by category
  const criticalFields = {
    lease: ['lessor.name', 'lessee.name', 'property.totalAcres', 'term.initialYears', 'rent.basePerAcre'],
    ppa: ['seller', 'buyer', 'capacity', 'price', 'term'],
    easement: ['grantor', 'grantee', 'purpose', 'width']
  };

  const fields = criticalFields[category] || [];
  const foundFields = fields.filter(f => getNestedValue(extractedData, f));
  const completeness = foundFields.length / fields.length;

  // Weighted formula: 40% classification + 60% completeness
  return (classificationConfidence * 0.4) + (completeness * 0.6);
}
```

### Stage 5: Review Determination

```typescript
determineReviewRequirements(
  category: string,
  confidence: number,
  extractedData: any
): ReviewRequirement {
  const reasons: string[] = [];
  let required = false;
  let urgency: 'low' | 'medium' | 'high' | 'critical' = 'medium';

  // Rule 1: Legal documents ALWAYS require review
  if (['lease', 'ppa', 'option', 'easement'].includes(category)) {
    required = true;
    reasons.push(`Legal document (${category}) requires human verification`);
  }

  // Rule 2: Low confidence
  if (confidence < 0.9) {
    required = true;
    reasons.push(`Extraction confidence ${(confidence * 100).toFixed(0)}% below threshold`);
  }

  // Rule 3: Very low confidence = urgent
  if (confidence < 0.7) {
    urgency = 'high';
    reasons.push('Low confidence requires priority review');
  }

  // Rule 4: High financial commitment
  if (extractedData.rent?.signingBonus > 10000) {
    required = true;
    urgency = 'high';
    reasons.push('High financial commitment requires approval');
  }

  return { required, urgency, reasons };
}
```

## 2.4 LangGraph-Style Workflow Engine

### Workflow State Schema

```typescript
interface WorkflowState {
  workflowId: string;
  tenantId: string;
  workflowType: 'document_processing' | 'land_acquisition' | 'project_lifecycle';
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  currentNode: string;
  data: Record<string, any>;  // Accumulated state
  history: Array<{
    node: string;
    timestamp: Date;
    data: any;
  }>;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Workflow Definition Structure

```typescript
interface WorkflowDefinition {
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

interface WorkflowNode {
  name: string;
  execute: (state: WorkflowState) => Promise<Partial<WorkflowState>>;
}

interface WorkflowEdge {
  from: string;
  to: string | ((state: WorkflowState) => string);  // Conditional routing
}
```

### Document Processing Workflow

```typescript
const documentProcessingWorkflow: WorkflowDefinition = {
  name: 'document_processing',
  nodes: [
    {
      name: 'classify',
      execute: async (state) => {
        const classification = await classifyDocument(state.data.text);
        return {
          data: { ...state.data, category: classification.category }
        };
      }
    },
    {
      name: 'extract',
      execute: async (state) => {
        const extracted = await extractByCategory(
          state.data.text,
          state.data.category
        );
        return {
          data: { ...state.data, extractedData: extracted }
        };
      }
    },
    {
      name: 'validate',
      execute: async (state) => {
        const confidence = calculateConfidence(state.data);
        const review = determineReviewRequirements(state.data);
        return {
          data: { ...state.data, confidence, reviewRequired: review.required }
        };
      }
    },
    {
      name: 'hitl_gate',
      execute: async (state) => {
        if (state.data.reviewRequired) {
          await createHITLRequest(state);
          return { status: 'paused' };  // Workflow pauses here
        }
        return {};  // Continue to completion
      }
    },
    {
      name: 'complete',
      execute: async (state) => {
        await updateDocument(state.data.documentId, {
          status: 'approved',
          extractedData: state.data.extractedData
        });
        return { status: 'completed' };
      }
    }
  ],
  edges: [
    { from: 'classify', to: 'extract' },
    { from: 'extract', to: 'validate' },
    { from: 'validate', to: 'hitl_gate' },
    { from: 'hitl_gate', to: 'complete' }
  ]
};
```

### Land Acquisition Workflow

```typescript
const landAcquisitionWorkflow: WorkflowDefinition = {
  name: 'land_acquisition',
  nodes: [
    {
      name: 'site_analysis',
      execute: async (state) => {
        // AI agent evaluates parcel suitability
        const analysis = await runAgent('site_researcher', {
          parcels: state.data.parcels,
          requirements: state.data.requirements
        });
        return {
          data: {
            ...state.data,
            suitabilityScore: analysis.score,
            analysisResults: analysis
          }
        };
      }
    },
    {
      name: 'due_diligence',
      execute: async (state) => {
        // Initialize DD workstreams
        const ddStatus = await initializeDDWorkstreams(state.data.projectId);
        return { data: { ...state.data, ddStatus } };
      }
    },
    {
      name: 'lease_negotiation',
      execute: async (state) => {
        // Lease terms analysis
        const leaseAnalysis = await runAgent('lease_analyst', {
          leaseDocument: state.data.leaseDocument
        });
        return { data: { ...state.data, leaseAnalysis } };
      }
    },
    {
      name: 'legal_review',
      execute: async (state) => {
        // MANDATORY HITL - Attorney must approve
        await createHITLRequest({
          type: 'legal_approval',
          urgency: 'critical',
          context: {
            leaseTerms: state.data.leaseAnalysis,
            parcelInfo: state.data.parcels
          }
        });
        return { status: 'paused' };
      }
    },
    {
      name: 'execute_lease',
      execute: async (state) => {
        if (!state.data.legalApproved) {
          return { status: 'failed', error: 'Legal approval denied' };
        }
        return { status: 'completed' };
      }
    }
  ],
  edges: [
    { from: 'site_analysis', to: 'due_diligence' },
    { from: 'due_diligence', to: 'lease_negotiation' },
    { from: 'lease_negotiation', to: 'legal_review' },
    { from: 'legal_review', to: 'execute_lease' }
  ]
};
```

### Execution Engine

```typescript
class WorkflowOrchestrator {
  async executeWorkflow(workflowId: string) {
    while (true) {
      // 1. Load current state from Firestore
      const state = await this.loadState(workflowId);

      // 2. Check if paused or completed
      if (state.status === 'paused' || state.status === 'completed') {
        break;
      }

      // 3. Get current node
      const node = this.getNode(state.workflowType, state.currentNode);

      // 4. Execute node
      const updates = await node.execute(state);

      // 5. Merge updates into state
      const newState = {
        ...state,
        ...updates,
        data: { ...state.data, ...updates.data },
        history: [...state.history, {
          node: state.currentNode,
          timestamp: new Date(),
          data: updates.data
        }]
      };

      // 6. Save checkpoint
      await this.saveState(workflowId, newState);

      // 7. Check if paused
      if (newState.status === 'paused') {
        break;
      }

      // 8. Determine next node
      const nextNode = this.getNextNode(state.workflowType, state.currentNode, newState);

      if (!nextNode || nextNode === 'end') {
        await this.saveState(workflowId, { ...newState, status: 'completed' });
        break;
      }

      // 9. Update current node
      await this.saveState(workflowId, { ...newState, currentNode: nextNode });
    }
  }

  async resumeWorkflow(workflowId: string, hitlResponse: any) {
    // Load paused state
    const state = await this.loadState(workflowId);

    // Inject HITL response
    const newState = {
      ...state,
      status: 'running',
      data: {
        ...state.data,
        hitlResponse,
        legalApproved: hitlResponse.approved  // For legal_review gate
      }
    };

    await this.saveState(workflowId, newState);

    // Continue execution
    await this.executeWorkflow(workflowId);
  }
}
```

## 2.5 CrewAI-Style Agent System

### Agent Definition Structure

```typescript
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
  parameters: Record<string, {
    type: string;
    description: string;
    required?: boolean;
  }>;
  execute: (params: any) => Promise<any>;
}
```

### Site Researcher Agent

```typescript
const siteResearcherAgent: AgentDefinition = {
  name: 'site_researcher',
  role: 'Site Acquisition Specialist',
  goal: 'Identify and evaluate potential solar development sites based on technical requirements',
  backstory: `You are an experienced solar site acquisition specialist with 15 years
    of experience evaluating land for utility-scale solar projects. You understand
    zoning requirements, environmental constraints, and grid interconnection factors.`,
  tools: [
    {
      name: 'search_parcels',
      description: 'Search for parcels matching criteria',
      parameters: {
        county: { type: 'string', description: 'County name' },
        state: { type: 'string', description: 'State code' },
        minAcres: { type: 'number', description: 'Minimum acres' },
        maxAcres: { type: 'number', description: 'Maximum acres' }
      },
      execute: async ({ county, state, minAcres, maxAcres }) => {
        return await firestore
          .collection('parcels')
          .where('county', '==', county)
          .where('state', '==', state)
          .where('acres', '>=', minAcres)
          .where('acres', '<=', maxAcres)
          .get();
      }
    },
    {
      name: 'check_zoning',
      description: 'Verify zoning allows solar development',
      parameters: {
        parcelId: { type: 'string', description: 'Parcel ID' }
      },
      execute: async ({ parcelId }) => {
        const parcel = await getParcel(parcelId);
        return {
          zoning: parcel.zoning,
          solarAllowed: SOLAR_ZONES.includes(parcel.zoning),
          conditionalUse: CUP_ZONES.includes(parcel.zoning)
        };
      }
    },
    {
      name: 'calculate_buildable_area',
      description: 'Calculate usable area after setbacks and constraints',
      parameters: {
        parcelId: { type: 'string', description: 'Parcel ID' },
        setbackFeet: { type: 'number', description: 'Required setback' }
      },
      execute: async ({ parcelId, setbackFeet }) => {
        const parcel = await getParcel(parcelId);
        // Simplified calculation
        const setbackAcres = (setbackFeet * parcel.perimeterFeet) / 43560;
        return {
          totalAcres: parcel.acres,
          buildableAcres: parcel.acres - setbackAcres,
          estimatedMW: (parcel.acres - setbackAcres) * 5  // 5 acres/MW
        };
      }
    }
  ]
};
```

### Agent Execution Flow

```typescript
class AgentRunner {
  async runTask(agentType: string, taskInput: any): Promise<TaskResult> {
    // 1. Get agent definition
    const agent = this.getAgent(agentType);

    // 2. Build prompt
    const prompt = this.buildPrompt(agent, taskInput);

    // 3. Call Claude
    const response = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      system: `You are ${agent.role}. ${agent.backstory}
        Your goal: ${agent.goal}

        Available tools:
        ${JSON.stringify(agent.tools.map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters
        })))}

        Respond with JSON:
        {
          "reasoning": "Your step-by-step reasoning",
          "toolCalls": [{"tool": "name", "params": {...}}],
          "analysis": {...},
          "recommendations": [...],
          "requiresReview": boolean
        }`,
      messages: [{ role: 'user', content: JSON.stringify(taskInput) }]
    });

    // 4. Parse response
    const plan = JSON.parse(response.content[0].text);

    // 5. Execute tool calls
    const toolResults = [];
    for (const call of plan.toolCalls) {
      const tool = agent.tools.find(t => t.name === call.tool);
      const result = await tool.execute(call.params);
      toolResults.push({ tool: call.tool, result });
    }

    // 6. Return aggregated result
    return {
      success: true,
      reasoning: plan.reasoning,
      toolResults,
      analysis: plan.analysis,
      recommendations: plan.recommendations,
      requiresReview: plan.requiresReview
    };
  }
}
```

## 2.6 Database Schema

### Firestore Collections

```typescript
// Collection: projects
interface Project {
  id: string;
  tenantId: string;              // For multi-tenant isolation
  name: string;
  type: 'utility_solar' | 'distributed' | 'storage';
  status: 'prospecting' | 'site_control' | 'development' | 'construction_ready' | 'construction' | 'operational';
  state: string;                 // US State
  county: string;
  capacityMwAc: number;
  capexUsd: number;
  targetCod: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Collection: documents
interface Document {
  id: string;
  projectId: string;
  tenantId: string;
  filename: string;
  mimeType: string;
  storageUrl: string;
  category: DocumentCategory;    // lease, ppa, easement, etc.
  status: 'uploading' | 'processing' | 'review_required' | 'approved' | 'rejected';
  extractedData: any;            // Structured extraction results
  confidence: number;            // 0.0 - 1.0
  requiresReview: boolean;
  reviewReasons: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Collection: parcels
interface Parcel {
  id: string;
  projectId: string;
  tenantId: string;
  apn: string;                   // Assessor Parcel Number
  county: string;
  state: string;
  acres: number;
  zoning: string;
  landUse: string;
  ownerName: string;
  ownerAddress: string;
  status: 'available' | 'under_option' | 'leased' | 'owned';
  assessedValue: number;
  marketValue: number;
  geometry?: GeoJSON.MultiPolygon;
  createdAt: Date;
  updatedAt: Date;
}

// Collection: hitlRequests
interface HITLRequest {
  id: string;
  tenantId: string;
  requestType: 'document_review' | 'legal_approval' | 'financial_approval';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'approved' | 'rejected';
  documentId?: string;
  projectId?: string;
  workflowId?: string;           // Link to paused workflow
  description: string;
  context: {
    category?: string;
    extractedData?: any;
    confidence?: number;
    reviewReasons?: string[];
  };
  deadline?: Date;
  resolvedBy?: string;
  resolvedAt?: Date;
  notes?: string;
  createdAt: Date;
}

// Collection: workflows
interface WorkflowInstance {
  id: string;
  tenantId: string;
  workflowType: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  currentNode: string;
  data: Record<string, any>;
  history: Array<{
    node: string;
    timestamp: Date;
    data: any;
  }>;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper: Check if user owns the document
    function isOwner(tenantId) {
      return request.auth != null && request.auth.uid == tenantId;
    }

    // Projects: User can only access their own
    match /projects/{projectId} {
      allow read: if isOwner(resource.data.tenantId);
      allow create: if isOwner(request.resource.data.tenantId);
      allow update, delete: if isOwner(resource.data.tenantId);
    }

    // Documents: Same pattern
    match /documents/{documentId} {
      allow read: if isOwner(resource.data.tenantId);
      allow create: if isOwner(request.resource.data.tenantId);
      allow update: if isOwner(resource.data.tenantId);
    }

    // HITL Requests: Users can read/update their own
    match /hitlRequests/{requestId} {
      allow read: if isOwner(resource.data.tenantId);
      allow update: if isOwner(resource.data.tenantId);
      // Create only via Cloud Functions
      allow create: if false;
    }

    // Workflows: Read-only for users
    match /workflows/{workflowId} {
      allow read: if isOwner(resource.data.tenantId);
      // All modifications via Cloud Functions
      allow write: if false;
    }
  }
}
```

## 2.7 Integration Points

### Frontend to Backend

```typescript
// Document Upload Flow
// Frontend: DocumentUpload.tsx
const uploadDocument = async (file: File, projectId: string) => {
  // 1. Get signed upload URL
  const { uploadUrl, documentId } = await functions.httpsCallable('getUploadUrl')({
    projectId,
    filename: file.name,
    contentType: file.type
  });

  // 2. Upload directly to Storage
  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type }
  });

  // 3. Update document status (triggers processing)
  await updateDoc(doc(db, 'documents', documentId), {
    status: 'processing'
  });
};

// HITL Resolution
// Frontend: ReviewQueue.tsx
const resolveReview = async (requestId: string, approved: boolean, notes: string) => {
  await functions.httpsCallable('resolveReview')({
    requestId,
    approved,
    notes
  });
  // Firestore listener auto-updates UI
};

// Workflow Start
// Frontend: WorkflowStatus.tsx
const startWorkflow = async (workflowType: string, projectId: string) => {
  const { workflowId } = await functions.httpsCallable('startWorkflow')({
    workflowType,
    input: { projectId }
  });
  return workflowId;
};

// Agent Task
// Frontend: SiteAnalysis.tsx
const runAnalysis = async (projectId: string, parcels: Parcel[]) => {
  const result = await functions.httpsCallable('runAgentTask')({
    agentType: 'site_researcher',
    taskInput: { projectId, parcels }
  });
  return result.data;
};
```

### Backend Event Flow

```typescript
// Firestore Trigger: Document Processing
export const onDocumentUploaded = onDocumentUpdated(
  'documents/{documentId}',
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    // Only trigger when status changes to 'processing'
    if (before?.status !== 'processing' && after?.status === 'processing') {
      const processor = new DocumentProcessor();
      await processor.process(event.params.documentId);
    }
  }
);

// Firestore Trigger: HITL Resolution
export const onHITLRequestUpdated = onDocumentUpdated(
  'hitlRequests/{requestId}',
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    // Only trigger on status change to approved/rejected
    if (before?.status === 'pending' &&
        (after?.status === 'approved' || after?.status === 'rejected')) {

      // 1. Update related document
      if (after.documentId) {
        await updateDoc(doc(db, 'documents', after.documentId), {
          status: after.status
        });
      }

      // 2. Create parcels from approved lease
      if (after.status === 'approved' && after.context?.category === 'lease') {
        await createParcelsFromLease(after);
      }

      // 3. Resume paused workflow
      if (after.workflowId) {
        const orchestrator = new WorkflowOrchestrator();
        await orchestrator.resumeWorkflow(after.workflowId, {
          approved: after.status === 'approved',
          notes: after.notes
        });
      }
    }
  }
);
```

---

# Part 3: Data Flow Diagrams

## 3.1 Document Processing Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     DOCUMENT UPLOAD                          │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            v
┌─────────────────────────────────────────────────────────────┐
│  1. getUploadUrl()                                          │
│     - Generate signed URL                                   │
│     - Create document record (status: uploading)            │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            v
┌─────────────────────────────────────────────────────────────┐
│  2. Direct Upload to Firebase Storage                       │
│     - Client uploads file via signed URL                    │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            v
┌─────────────────────────────────────────────────────────────┐
│  3. Update document.status = 'processing'                   │
│     - Triggers Firestore onDocumentUpdated                  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            v
┌─────────────────────────────────────────────────────────────┐
│  4. DocumentProcessor.process()                             │
│     ├─ extractText()         → Raw text from PDF/DOCX       │
│     ├─ classifyDocument()    → Category + confidence        │
│     ├─ extractData()         → Structured JSON              │
│     ├─ calculateConfidence() → Weighted score               │
│     └─ determineReview()     → Review requirements          │
└───────────────────────────┬─────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
              v                           v
┌─────────────────────────┐   ┌─────────────────────────┐
│  REVIEW NOT REQUIRED    │   │  REVIEW REQUIRED        │
│  status = 'approved'    │   │  status = 'review_req'  │
│  Save extractedData     │   │  Create HITLRequest     │
└─────────────────────────┘   └───────────┬─────────────┘
                                          │
                                          v
                              ┌─────────────────────────┐
                              │  User Reviews in UI     │
                              │  Approve / Reject       │
                              └───────────┬─────────────┘
                                          │
                                          v
                              ┌─────────────────────────┐
                              │  onHITLRequestUpdated   │
                              │  - Update document      │
                              │  - Create parcels       │
                              │  - Resume workflow      │
                              └─────────────────────────┘
```

## 3.2 Workflow Execution Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    START WORKFLOW                            │
│               startWorkflow(type, input)                     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            v
┌─────────────────────────────────────────────────────────────┐
│  Create Workflow Record                                      │
│  {                                                          │
│    status: 'pending',                                       │
│    currentNode: firstNode,                                  │
│    data: input,                                             │
│    history: []                                              │
│  }                                                          │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            v
┌─────────────────────────────────────────────────────────────┐
│                   EXECUTION LOOP                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  while (status != 'completed' && status != 'paused')  │ │
│  │    1. Load state                                       │ │
│  │    2. Execute current node                             │ │
│  │    3. Update state with outputs                        │ │
│  │    4. Save checkpoint                                  │ │
│  │    5. Determine next node                              │ │
│  │    6. Update currentNode                               │ │
│  └────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
              v                           v
┌─────────────────────────┐   ┌─────────────────────────┐
│  HITL GATE REACHED      │   │  WORKFLOW COMPLETED     │
│  status = 'paused'      │   │  status = 'completed'   │
│  Create HITLRequest     │   │                         │
└───────────┬─────────────┘   └─────────────────────────┘
            │
            v
┌─────────────────────────┐
│  Wait for Human         │
│  Decision               │
└───────────┬─────────────┘
            │
            v
┌─────────────────────────┐
│  resumeWorkflow()       │
│  - Inject HITL response │
│  - Continue loop        │
└─────────────────────────┘
```

## 3.3 Agent Task Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    RUN AGENT TASK                            │
│             runAgentTask(agentType, input)                   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            v
┌─────────────────────────────────────────────────────────────┐
│  Build Agent Prompt                                          │
│  - Role: "Site Acquisition Specialist"                       │
│  - Goal: "Evaluate solar site potential"                     │
│  - Backstory: Experience and expertise                       │
│  - Tools: List of available tools with schemas               │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            v
┌─────────────────────────────────────────────────────────────┐
│  Call Claude API                                             │
│  - System prompt with role/tools                             │
│  - User message with task input                              │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            v
┌─────────────────────────────────────────────────────────────┐
│  Claude Response (JSON)                                      │
│  {                                                          │
│    "reasoning": "Step-by-step analysis...",                 │
│    "toolCalls": [                                           │
│      { "tool": "search_parcels", "params": {...} },         │
│      { "tool": "check_zoning", "params": {...} }            │
│    ],                                                       │
│    "analysis": { "suitability": 85, ... },                  │
│    "recommendations": ["Proceed with...", ...]              │
│  }                                                          │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            v
┌─────────────────────────────────────────────────────────────┐
│  Execute Tool Calls                                          │
│  for each toolCall:                                         │
│    result = tool.execute(params)                            │
│    toolResults.push({ tool, result })                       │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            v
┌─────────────────────────────────────────────────────────────┐
│  Return Task Result                                          │
│  {                                                          │
│    success: true,                                           │
│    reasoning: "...",                                        │
│    toolResults: [...],                                      │
│    analysis: {...},                                         │
│    recommendations: [...]                                    │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

---

# Part 4: Deployment Architecture

## 4.1 Infrastructure Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        INTERNET                              │
└───────────────────────────┬─────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            v               v               v
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   Vercel      │   │   Firebase    │   │   Anthropic   │
│   CDN/Edge    │   │   Hosting     │   │   API         │
│               │   │               │   │               │
│ Next.js SSR   │   │ Static Assets │   │ Claude Models │
│ API Routes    │   │               │   │               │
└───────┬───────┘   └───────────────┘   └───────┬───────┘
        │                                       │
        │   ┌───────────────────────────┐       │
        └──>│    Firebase Platform      │<──────┘
            │                           │
            │  ┌─────────────────────┐  │
            │  │  Cloud Functions    │  │
            │  │  (Node.js 20)       │  │
            │  │  - Document AI      │  │
            │  │  - Workflow Engine  │  │
            │  │  - Agent Runner     │  │
            │  └─────────────────────┘  │
            │                           │
            │  ┌─────────────────────┐  │
            │  │  Firestore          │  │
            │  │  (NoSQL Database)   │  │
            │  └─────────────────────┘  │
            │                           │
            │  ┌─────────────────────┐  │
            │  │  Cloud Storage      │  │
            │  │  (Document Files)   │  │
            │  └─────────────────────┘  │
            │                           │
            │  ┌─────────────────────┐  │
            │  │  Firebase Auth      │  │
            │  │  (Identity)         │  │
            │  └─────────────────────┘  │
            │                           │
            └───────────────────────────┘
```

## 4.2 Environment Configuration

```bash
# Frontend Environment (.env.local)
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# Backend Environment (functions/.env)
ANTHROPIC_API_KEY=sk-ant-api03-...
FIREBASE_PROJECT_ID=project-id
```

## 4.3 Deployment Commands

```bash
# Frontend Deployment (Vercel)
npm run build
vercel deploy --prod

# Backend Deployment (Firebase)
cd functions
npm run build
firebase deploy --only functions

# Full Deployment
firebase deploy  # Functions + Rules + Storage
```

---

# Part 5: Security Architecture

## 5.1 Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    USER AUTHENTICATION                       │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            v
┌─────────────────────────────────────────────────────────────┐
│  1. User Signs In                                           │
│     - Email/Password                                        │
│     - Google OAuth                                          │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            v
┌─────────────────────────────────────────────────────────────┐
│  2. Firebase Auth Issues JWT                                │
│     - Contains uid (used as tenantId)                       │
│     - Auto-refreshed by Firebase SDK                        │
└───────────────────────────┬─────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
              v                           v
┌─────────────────────────┐   ┌─────────────────────────┐
│  Firestore Requests     │   │  Cloud Function Calls   │
│  - Auth context auto    │   │  - request.auth.uid     │
│    included by SDK      │   │    available in handler │
│  - Rules check tenantId │   │  - Validate tenantId    │
└─────────────────────────┘   └─────────────────────────┘
```

## 5.2 Authorization Model

```typescript
// Tenant Isolation Pattern
// Every query filters by tenantId = current user's uid

// Firestore Security Rules
match /documents/{docId} {
  allow read: if request.auth.uid == resource.data.tenantId;
  allow create: if request.auth.uid == request.resource.data.tenantId;
  allow update: if request.auth.uid == resource.data.tenantId;
}

// Cloud Function Validation
export const getDocuments = onCall(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new Error('Unauthenticated');

  // All queries include tenant filter
  const docs = await db.collection('documents')
    .where('tenantId', '==', userId)
    .get();

  return docs;
});
```

## 5.3 Data Protection

| Layer | Protection |
|-------|------------|
| **Transport** | HTTPS/TLS for all connections |
| **Storage** | Firebase Storage with signed URLs |
| **Database** | Firestore security rules |
| **Functions** | Auth context validation |
| **API Keys** | Server-side only, never exposed to client |

---

# Part 6: Monitoring & Observability

## 6.1 Logging

```typescript
// Cloud Functions Logging
import { logger } from 'firebase-functions/v2';

// Document Processing
logger.info('Starting document processing', { documentId });
logger.info('Classification complete', { category, confidence });
logger.warn('Low confidence extraction', { documentId, confidence });
logger.error('Processing failed', { documentId, error });

// Workflow Execution
logger.info('Workflow started', { workflowId, type });
logger.info('Node executed', { workflowId, node, duration });
logger.info('Workflow paused for HITL', { workflowId, reason });
logger.info('Workflow completed', { workflowId, totalDuration });
```

## 6.2 Metrics

| Metric | Description |
|--------|-------------|
| `document_processing_duration` | Time to process document |
| `document_confidence_score` | Extraction confidence |
| `hitl_resolution_time` | Time from request to resolution |
| `workflow_completion_rate` | % of workflows completed |
| `agent_task_duration` | Agent execution time |
| `claude_api_latency` | AI API response time |

---

# Appendix A: Technology Comparison

## A.1 Why LangGraph over LangChain?

| Aspect | LangChain | LangGraph |
|--------|-----------|-----------|
| **Architecture** | Chain-based, sequential | Graph-based, flexible routing |
| **State Management** | Limited, in-memory | Built-in persistence, checkpointing |
| **HITL Support** | Requires custom implementation | Native interrupt/resume |
| **Complexity** | Simpler for linear flows | Better for conditional branching |
| **Recovery** | Manual | Automatic from checkpoints |

**Decision**: LangGraph-style implementation for its native state persistence and HITL interrupt capabilities.

## A.2 Why CrewAI-style over LangChain Agents?

| Aspect | LangChain Agents | CrewAI |
|--------|------------------|--------|
| **Agent Design** | Generic tool-using agents | Role-based specialization |
| **Collaboration** | Single agent per task | Multi-agent coordination |
| **Reasoning** | ReAct pattern | Goal-oriented with backstory |
| **Tool Selection** | Automatic based on description | Explicit tool definition |

**Decision**: CrewAI-style agents for clearer role specialization and more predictable tool usage.

## A.3 Why Firestore over PostgreSQL?

| Aspect | PostgreSQL | Firestore |
|--------|------------|-----------|
| **Real-time** | Requires additional setup (WebSockets) | Built-in real-time listeners |
| **Scaling** | Manual scaling configuration | Automatic horizontal scaling |
| **Schema** | Strict schema required | Flexible document model |
| **Hosting** | Requires server management | Fully managed |
| **Cost Model** | Per-instance | Pay-per-operation |
| **Offline** | No built-in support | Offline persistence |

**Decision**: Firestore for its real-time capabilities, serverless nature, and Firebase ecosystem integration.

---

# Appendix B: API Reference

## B.1 Cloud Functions API

### getUploadUrl
```typescript
// Request
{ projectId: string, filename: string, contentType: string }

// Response
{ uploadUrl: string, documentId: string }
```

### processDocument
```typescript
// Request
{ documentId: string }

// Response
{ success: boolean, documentId: string, category?: string }
```

### resolveReview
```typescript
// Request
{ requestId: string, approved: boolean, notes?: string }

// Response
{ success: boolean }
```

### startWorkflow
```typescript
// Request
{ workflowType: string, input: Record<string, any> }

// Response
{ success: boolean, data: { workflowId: string } }
```

### runAgentTask
```typescript
// Request
{ agentType: string, taskInput: Record<string, any> }

// Response
{
  success: boolean,
  data: {
    reasoning: string,
    toolResults: Array<{ tool: string, result: any }>,
    analysis: any,
    recommendations: string[]
  }
}
```

---

*Document Version: 1.0*
*Last Updated: January 2025*
*Author: Neurogrid Architecture Team*
