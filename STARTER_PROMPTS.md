# Claude Code Starter Prompts for Neurogrid

## How to Use These Prompts

Claude Code automatically reads `CLAUDE.md` from your project root. Each phase has a focused prompt below. Copy the relevant prompt and paste it into Claude Code.

---

## Phase 1 Starter Prompt

```
Read /docs/PHASE_1_FOUNDATION.md and complete Week 1 tasks:

1. Initialize Turborepo monorepo with pnpm
2. Create Next.js 14 app in apps/web with:
   - App Router, TypeScript strict, Tailwind CSS
   - shadcn/ui initialized with default components
3. Create FastAPI app in apps/api with:
   - Async SQLAlchemy 2.0
   - Pydantic v2 schemas
   - Alembic for migrations
4. Create docker-compose.yml with PostgreSQL (pgvector), Redis, MinIO
5. Create database init script enabling pgvector, postgis, uuid-ossp

Start with the Turborepo setup first. After each step, show me what you created.
```

---

## Phase 1 Week 2 Prompt

```
Continue with /docs/PHASE_1_FOUNDATION.md Week 2:

1. Create SQLAlchemy models in apps/api/app/models/:
   - base.py with Base, TimestampMixin, TenantMixin
   - project.py with Project model (all fields from docs)
   - Add land/, interconnection/, permitting/ models

2. Set up Alembic migrations
3. Create initial migration
4. Add Row-Level Security policies for tenant isolation

Show me each model as you create it.
```

---

## Phase 2 Starter Prompt

```
Read /docs/PHASE_2_DOCUMENT_AI.md and implement the Document AI pipeline:

1. Create packages/document-ai/ with:
   - pipeline.py (main orchestrator)
   - classifiers/document_classifier.py
   - parsers/ocr.py (Azure Document Intelligence)
   - extractors/lease_extractor.py

2. Implement LeaseExtraction schema with all fields from docs
3. Integrate LlamaParse for document parsing
4. Add Claude structured output extraction
5. Implement confidence scoring

Start with the document classifier. This is critical for routing.
```

---

## Phase 3 Starter Prompt

```
Read /docs/PHASE_3_AGENTS.md and build the Agentic AI layer:

1. Create packages/agents/orchestrator/ with:
   - state.py (OrchestratorState TypedDict)
   - graph.py (LangGraph StateGraph)
   - nodes.py (classify, route, hitl_gate)

2. Implement HITL interrupt using langgraph.types.interrupt()
3. Add PostgreSQL checkpointing for durability

Start with the state definition, then build the graph step by step.
CRITICAL: HITL gates must pause workflow until human approval signal.
```

---

## Phase 3 Crew Prompt

```
Continue /docs/PHASE_3_AGENTS.md - build the CrewAI crews:

1. Create packages/agents/crews/land_crew/ with:
   - crew.py (LandAcquisitionCrew class)
   - agents.py (4 agents: site_researcher, lease_analyst, dd_agent, stakeholder_agent)
   - tasks.py (analyze_parcel, extract_lease, coordinate_dd, manage_stakeholder)

2. Implement tools in packages/agents/tools/:
   - land_tools.py (search_parcels, get_parcel_details, check_constraints)
   - document_tools.py (parse_lease, extract_terms)

Show me the Site Researcher agent first with its tools.
```

---

## Phase 4 Starter Prompt

```
Read /docs/PHASES_4_5_6.md Phase 4 section. Implement Temporal workflows:

1. Set up Temporal server in docker-compose
2. Create packages/workflows/ with:
   - project_lifecycle.py (parent workflow)
   - land_acquisition.py (child workflow)
   - activities/ for document and approval activities

3. Implement HITL with Temporal signals:
   - gate_decision signal handler
   - wait_condition for approvals

4. Create worker.py to run workflow workers

CRITICAL: Workflows must support multi-year execution with signal-based HITL.
```

---

## Phase 5 Starter Prompt

```
Read /docs/PHASES_4_5_6.md Phase 5 section. Build visualization:

1. Create apps/web/components/maps/ParcelMap.tsx with:
   - MapLibre GL JS integration
   - Parcel layer with status-based colors
   - Click handler for parcel selection
   - Turf.js for client-side analysis

2. Create apps/web/components/charts/PermitGantt.tsx with:
   - DHTMLX Gantt integration
   - Task dependencies
   - Drag-to-update with API sync

Start with ParcelMap. Show me the component with proper TypeScript types.
```

---

## Phase 6 Starter Prompt

```
Read /docs/PHASES_4_5_6.md Phase 6 section. Production readiness:

1. Implement real-time collaboration:
   - Set up Hocuspocus server
   - Create useCollaboration hook with Yjs

2. Build MCP server in packages/mcp-server/:
   - server.py with FastMCP
   - Tools: get_project_status, search_documents, request_approval
   - OAuth 2.1 authentication

3. Create Kubernetes manifests in infrastructure/kubernetes/

Start with the MCP server - this enables AI extensibility.
```

---

## Tips for Claude Code

1. **Reference docs**: Always say "Read /docs/PHASE_X.md" to load context
2. **Incremental**: Ask for one component at a time
3. **Verify**: After each step, ask Claude to verify it works
4. **HITL reminder**: If building workflows, remind about HITL requirements
5. **Test**: Ask Claude to write tests as it builds

## Critical Reminders

Always include these when building workflows:
- "Legal documents must ALWAYS require attorney review"
- "Confidence < 90% must trigger HITL review"
- "Never auto-approve - always queue for human decision"
