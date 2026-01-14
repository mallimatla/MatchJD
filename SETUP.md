# Complete Setup Guide - Neurogrid

## Table of Contents
1. [Required API Keys](#required-api-keys)
2. [How LangGraph Works](#how-langgraph-works)
3. [How CrewAI Works](#how-crewai-works)
4. [Architecture Flow](#architecture-flow)
5. [Step-by-Step Setup](#step-by-step-setup)
6. [Deployment](#deployment)

---

## Required API Keys

### 1. Anthropic Claude API (Required)
**Purpose**: Document extraction, classification, AI reasoning
**Get it from**: https://console.anthropic.com/
**Cost**: ~$3/million input tokens, ~$15/million output tokens (Claude Sonnet)

```env
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

### 2. Firebase Project (Required)
**Purpose**: Database, authentication, file storage, serverless functions
**Get it from**: https://console.firebase.google.com/
**Cost**: Free tier generous, then pay-as-you-go

```env
# Client-side (public - safe to expose)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaxxxxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:xxxxx

# Server-side (private - keep secret)
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nxxxxx\n-----END PRIVATE KEY-----\n"
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

### 3. LangSmith (Optional but Recommended)
**Purpose**: Trace and debug LangGraph workflows
**Get it from**: https://smith.langchain.com/
**Cost**: Free tier available

```env
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=lsv2_xxxxx
LANGCHAIN_PROJECT=neurogrid
```

### 4. Azure Document Intelligence (Optional)
**Purpose**: OCR for scanned documents
**Get it from**: https://portal.azure.com/
**Cost**: Free tier: 500 pages/month

```env
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=xxxxx
```

---

## How LangGraph Works

### What is LangGraph?
LangGraph is a framework for building **stateful, multi-step AI workflows**. Think of it as a flowchart for AI operations where:
- Each **node** is an AI operation (classification, extraction, decision)
- Each **edge** connects nodes and can be conditional
- **State** persists across the entire workflow
- **Checkpoints** allow pausing/resuming (critical for human-in-the-loop)

### Visual Representation

```
┌─────────────────────────────────────────────────────────────────┐
│                     LangGraph Workflow                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐                │
│  │  START   │────▶│ Classify │────▶│  Route   │                │
│  └──────────┘     │ Document │     │ Decision │                │
│                   └──────────┘     └────┬─────┘                │
│                                         │                       │
│                    ┌────────────────────┼────────────────┐     │
│                    ▼                    ▼                ▼     │
│              ┌──────────┐        ┌──────────┐     ┌──────────┐ │
│              │  Lease   │        │  Permit  │     │  Study   │ │
│              │ Extractor│        │ Extractor│     │ Extractor│ │
│              └────┬─────┘        └────┬─────┘     └────┬─────┘ │
│                   │                   │                │       │
│                   └───────────────────┼────────────────┘       │
│                                       ▼                        │
│                               ┌──────────────┐                 │
│                               │  HITL Gate   │◀── Human        │
│                               │ (Interrupt)  │    Review       │
│                               └──────┬───────┘                 │
│                                      │                         │
│                                      ▼                         │
│                               ┌──────────┐                     │
│                               │   END    │                     │
│                               └──────────┘                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Concepts

1. **State**: A TypedDict that holds all workflow data
```typescript
interface WorkflowState {
  documentId: string;
  documentType: string | null;
  extractedData: any | null;
  confidence: number;
  requiresReview: boolean;
  humanDecision: string | null;
}
```

2. **Nodes**: Functions that process and update state
```typescript
async function classifyDocument(state: WorkflowState) {
  const result = await claude.classify(state.documentText);
  return { documentType: result.type, confidence: result.confidence };
}
```

3. **Conditional Edges**: Route based on state
```typescript
function routeByType(state: WorkflowState) {
  if (state.documentType === 'lease') return 'leaseExtractor';
  if (state.documentType === 'permit') return 'permitExtractor';
  return 'unknownHandler';
}
```

4. **Interrupts (HITL)**: Pause for human input
```typescript
async function hitlGate(state: WorkflowState) {
  if (state.confidence < 0.9 || state.requiresReview) {
    // This pauses the workflow until human responds
    const decision = interrupt({ reason: 'Low confidence extraction' });
    return { humanDecision: decision };
  }
  return {};
}
```

---

## How CrewAI Works

### What is CrewAI?
CrewAI is a framework for creating **teams of AI agents** that collaborate on complex tasks. Each agent has:
- A **role** (what they do)
- A **goal** (what they're trying to achieve)
- A **backstory** (context that shapes their behavior)
- **Tools** (functions they can call)

### Visual Representation

```
┌─────────────────────────────────────────────────────────────────┐
│                   Land Acquisition Crew                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐          ┌─────────────────┐              │
│  │ Site Researcher │          │  Lease Analyst  │              │
│  │─────────────────│          │─────────────────│              │
│  │ Role: Find and  │          │ Role: Analyze   │              │
│  │ evaluate sites  │          │ lease terms     │              │
│  │                 │          │                 │              │
│  │ Tools:          │          │ Tools:          │              │
│  │ • searchParcels │          │ • extractTerms  │              │
│  │ • checkZoning   │          │ • compareRates  │              │
│  │ • getDetails    │          │ • flagRisks     │              │
│  └────────┬────────┘          └────────┬────────┘              │
│           │                            │                        │
│           └──────────┬─────────────────┘                        │
│                      ▼                                          │
│           ┌─────────────────┐                                   │
│           │ Crew Coordinator│                                   │
│           │ (Orchestrates)  │                                   │
│           └────────┬────────┘                                   │
│                    │                                            │
│                    ▼                                            │
│           ┌─────────────────┐          ┌─────────────────┐     │
│           │  DD Coordinator │          │   Stakeholder   │     │
│           │─────────────────│          │    Manager      │     │
│           │ Role: Coordinate│          │─────────────────│     │
│           │ due diligence   │          │ Role: Manage    │     │
│           │                 │          │ communications  │     │
│           │ Tools:          │          │                 │     │
│           │ • orderStudy    │          │ Tools:          │     │
│           │ • trackStatus   │          │ • draftEmail    │     │
│           │ • synthesize    │          │ • scheduleCall  │     │
│           └─────────────────┘          └─────────────────┘     │
│                                                                 │
│  Note: Stakeholder Manager NEVER sends communications          │
│  automatically - all external comms require HITL approval      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Concepts

1. **Agent Definition**:
```typescript
const siteResearcher = new Agent({
  role: 'Site Researcher',
  goal: 'Identify optimal solar development sites',
  backstory: `You are an experienced site acquisition specialist
    with deep knowledge of solar project requirements...`,
  tools: [searchParcels, checkZoning, getParcelDetails],
});
```

2. **Task Definition**:
```typescript
const analyzeParcelTask = new Task({
  description: `Analyze parcel {parcel_id} for solar suitability.
    Check: zoning, environmental constraints, grid proximity.`,
  agent: siteResearcher,
  expectedOutput: 'Suitability score 0-100 with reasoning',
});
```

3. **Crew Execution**:
```typescript
const landCrew = new Crew({
  agents: [siteResearcher, leaseAnalyst, ddCoordinator],
  tasks: [analyzeParcelTask, extractLeaseTask, coordinateDDTask],
  process: 'sequential', // or 'hierarchical'
});

const result = await landCrew.kickoff({ parcel_id: 'APN-123' });
```

---

## Architecture Flow

### Complete End-to-End Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE (Vercel)                         │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  Dashboard  │  │   Upload    │  │   Review    │  │    Maps     │   │
│  │             │  │  Documents  │  │   Queue     │  │             │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │
│         │                │                │                │           │
└─────────┼────────────────┼────────────────┼────────────────┼───────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      FIREBASE (Backend)                                 │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Cloud Functions                               │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐        │   │
│  │  │ processDoc    │  │ runWorkflow   │  │ executeAgent  │        │   │
│  │  │ (HTTP Trigger)│  │ (Firestore)   │  │ (HTTP Trigger)│        │   │
│  │  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘        │   │
│  │          │                  │                  │                 │   │
│  │          ▼                  ▼                  ▼                 │   │
│  │  ┌─────────────────────────────────────────────────────────┐    │   │
│  │  │              AI Processing Layer                         │    │   │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │    │   │
│  │  │  │  Document   │  │  LangGraph  │  │   CrewAI    │      │    │   │
│  │  │  │     AI      │  │  Workflows  │  │   Agents    │      │    │   │
│  │  │  │  (Claude)   │  │             │  │             │      │    │   │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘      │    │   │
│  │  └─────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │   Firestore     │  │ Firebase Storage │  │  Firebase Auth  │         │
│  │   (Database)    │  │    (Files)       │  │ (Users/Tenants) │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Document Processing Flow

```
User uploads document
        │
        ▼
┌───────────────────┐
│ Firebase Storage  │  ← File stored
└────────┬──────────┘
         │
         ▼ (triggers Cloud Function)
┌───────────────────┐
│ 1. Parse Document │  ← Extract text (OCR if needed)
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ 2. Classify Type  │  ← Claude determines: lease/permit/study
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ 3. Extract Data   │  ← Claude extracts structured data
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ 4. Calculate      │  ← Check extraction confidence
│    Confidence     │
└────────┬──────────┘
         │
         ▼
    ┌────────────┐
    │ Conf > 90% │
    │  & not     │
    │   legal?   │
    └─────┬──────┘
          │
    ┌─────┴─────┐
    │           │
   Yes          No
    │           │
    ▼           ▼
┌────────┐  ┌────────────────┐
│ Auto   │  │ Add to Review  │
│ Approve│  │ Queue (HITL)   │
└───┬────┘  └───────┬────────┘
    │               │
    │               ▼
    │       ┌──────────────┐
    │       │ Human Reviews│
    │       │ & Approves   │
    │       └──────┬───────┘
    │              │
    └──────────────┘
           │
           ▼
┌───────────────────┐
│ Store in Firestore│  ← Extracted data saved
└───────────────────┘
```

---

## Step-by-Step Setup

### Step 1: Clone and Install Dependencies

```bash
# Clone the repository
git clone <your-repo-url>
cd neurogrid

# Install dependencies
npm install
```

### Step 2: Create Firebase Project

1. Go to https://console.firebase.google.com/
2. Click "Create a project"
3. Name it "neurogrid" (or your preferred name)
4. Enable Google Analytics (optional)
5. Wait for project creation

### Step 3: Enable Firebase Services

In your Firebase Console:

1. **Authentication**:
   - Go to Authentication → Sign-in method
   - Enable "Email/Password"
   - Enable "Google" (optional)

2. **Firestore**:
   - Go to Firestore Database
   - Click "Create database"
   - Start in "production mode"
   - Choose your region (us-central1 recommended)

3. **Storage**:
   - Go to Storage
   - Click "Get started"
   - Start in production mode
   - Choose same region as Firestore

4. **Functions**:
   - Requires Blaze (pay-as-you-go) plan
   - Go to Functions → Upgrade to Blaze plan

### Step 4: Get Firebase Credentials

1. **Web App Config**:
   - Go to Project Settings → General
   - Scroll to "Your apps" → Click web icon (</>)
   - Register app as "neurogrid-web"
   - Copy the config object

2. **Service Account**:
   - Go to Project Settings → Service accounts
   - Click "Generate new private key"
   - Save the JSON file securely

### Step 5: Get Anthropic API Key

1. Go to https://console.anthropic.com/
2. Create account / Sign in
3. Go to API Keys
4. Create new key
5. Copy and save securely

### Step 6: Create Environment Files

Create `.env.local` for Next.js:
```env
# Firebase Client (public)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# API URL (for local dev)
NEXT_PUBLIC_API_URL=http://localhost:5001/your-project/us-central1
```

Create `functions/.env` for Cloud Functions:
```env
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

### Step 7: Deploy Firebase Functions

```bash
cd functions
npm install
npm run deploy
```

### Step 8: Run Locally

```bash
# Terminal 1: Firebase Emulators
npm run firebase:emulators

# Terminal 2: Next.js Dev Server
npm run dev
```

### Step 9: Deploy to Vercel

1. Push code to GitHub
2. Go to https://vercel.com/
3. Import your repository
4. Add environment variables (all NEXT_PUBLIC_* vars)
5. Deploy

---

## Deployment

### Vercel Deployment

1. Connect GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy (automatic on push to main)

### Firebase Deployment

```bash
# Deploy everything
npm run firebase:deploy

# Or deploy individually
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
```

### Production Checklist

- [ ] All API keys set in Vercel environment variables
- [ ] All API keys set in Firebase Functions config
- [ ] Firestore security rules deployed
- [ ] Storage security rules deployed
- [ ] Firebase Functions deployed
- [ ] Domain configured in Firebase Auth
- [ ] CORS configured for production domain

---

## Cost Estimates

### Free Tier Limits

| Service | Free Limit | Overage Cost |
|---------|-----------|--------------|
| Firebase Auth | 50K MAU | $0.0055/MAU |
| Firestore | 1GB storage, 50K reads/day | $0.18/100K reads |
| Storage | 5GB | $0.026/GB |
| Functions | 2M invocations | $0.40/million |
| Claude API | None | ~$3-15/M tokens |

### Estimated Monthly Costs

| Usage Level | Firebase | Claude | Total |
|-------------|----------|--------|-------|
| Development | $0 | ~$10 | ~$10 |
| Small (100 docs/month) | ~$5 | ~$20 | ~$25 |
| Medium (1000 docs/month) | ~$25 | ~$100 | ~$125 |
| Large (10K docs/month) | ~$100 | ~$500 | ~$600 |
