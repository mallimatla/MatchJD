# Neurogrid - AI-Powered Solar Development Platform

## Project Overview

Neurogrid is a comprehensive AI-powered platform for managing solar energy project development. It combines document AI, agentic workflows, and advanced visualization to streamline the entire project lifecycle from land acquisition through to permitting and construction.

## Architecture

```
neurogrid/
├── apps/
│   ├── web/                    # Next.js 14 frontend
│   └── api/                    # FastAPI backend
├── packages/
│   ├── document-ai/            # Document processing pipeline
│   ├── agents/                 # CrewAI agents and LangGraph orchestrator
│   ├── workflows/              # Temporal long-running workflows
│   └── mcp-server/             # Model Context Protocol server
├── infrastructure/
│   ├── kubernetes/             # K8s manifests
│   └── terraform/              # IaC
└── docs/                       # Phase documentation
```

## Tech Stack

### Frontend
- **Next.js 14** with App Router
- **TypeScript** (strict mode)
- **Tailwind CSS** + **shadcn/ui**
- **MapLibre GL JS** for mapping
- **DHTMLX Gantt** for timeline visualization
- **Yjs + Hocuspocus** for real-time collaboration

### Backend
- **FastAPI** with async support
- **SQLAlchemy 2.0** with async sessions
- **PostgreSQL** with pgvector, PostGIS extensions
- **Redis** for caching and pub/sub
- **MinIO** for object storage

### AI/ML
- **Claude** for structured extraction and reasoning
- **LangGraph** for agentic orchestration
- **CrewAI** for specialized agent crews
- **LlamaParse** for document parsing
- **Azure Document Intelligence** for OCR

### Workflows
- **Temporal** for durable, long-running workflows
- Human-in-the-Loop (HITL) gates for critical decisions

## Development Phases

1. **Phase 1**: Foundation - Monorepo, DB models, infrastructure
2. **Phase 2**: Document AI - Classification, parsing, extraction
3. **Phase 3**: Agents - Orchestrator, specialized crews, tools
4. **Phase 4**: Workflows - Temporal, long-running processes, HITL
5. **Phase 5**: Visualization - Maps, charts, dashboards
6. **Phase 6**: Production - Real-time, MCP, Kubernetes

## Getting Started

See [STARTER_PROMPTS.md](./STARTER_PROMPTS.md) for Claude Code prompts to build each phase.

## Critical Requirements

### Human-in-the-Loop (HITL)

These actions **MUST** require human approval:
- Legal document review (leases, contracts, easements)
- Any AI extraction with confidence < 90%
- Financial commitments > $10,000
- External communications to stakeholders
- Permit submissions

### Security

- Row-Level Security (RLS) for tenant isolation
- OAuth 2.1 for API authentication
- Encrypted secrets management
- Audit logging for all HITL decisions

## Commands

```bash
# Development
pnpm dev              # Start all apps
pnpm build            # Build all packages
pnpm test             # Run tests
pnpm db:migrate       # Run migrations
pnpm db:seed          # Seed database

# Docker
docker-compose up -d  # Start infrastructure
docker-compose down   # Stop infrastructure
```

## Documentation

- [Phase 1: Foundation](/docs/PHASE_1_FOUNDATION.md)
- [Phase 2: Document AI](/docs/PHASE_2_DOCUMENT_AI.md)
- [Phase 3: Agents](/docs/PHASE_3_AGENTS.md)
- [Phases 4-6: Workflows, Viz, Production](/docs/PHASES_4_5_6.md)
