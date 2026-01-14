# Phase 3: Agentic AI Layer

## Overview

Build an intelligent agent orchestration system using LangGraph for workflow control and CrewAI for specialized agent teams.

## Architecture

```
packages/agents/
├── __init__.py
├── orchestrator/              # LangGraph orchestrator
│   ├── __init__.py
│   ├── state.py              # State definitions
│   ├── graph.py              # Main graph
│   └── nodes.py              # Node functions
├── crews/                     # CrewAI teams
│   ├── __init__.py
│   ├── land_crew/
│   │   ├── __init__.py
│   │   ├── crew.py
│   │   ├── agents.py
│   │   └── tasks.py
│   ├── interconnection_crew/
│   └── permitting_crew/
├── tools/                     # Shared tools
│   ├── __init__.py
│   ├── land_tools.py
│   ├── document_tools.py
│   └── database_tools.py
└── checkpointer/              # State persistence
    ├── __init__.py
    └── postgres.py
```

---

## LangGraph Orchestrator

### orchestrator/state.py

```python
from typing import TypedDict, Literal, Annotated
from langgraph.graph.message import add_messages
from pydantic import BaseModel

class HITLRequest(BaseModel):
    """Human-in-the-loop review request."""
    request_id: str
    request_type: Literal["approval", "review", "decision"]
    description: str
    context: dict
    options: list[str] | None = None
    urgency: Literal["low", "medium", "high", "critical"] = "medium"
    assigned_to: str | None = None
    deadline: str | None = None

class HITLResponse(BaseModel):
    """Human-in-the-loop response."""
    request_id: str
    decision: str
    notes: str | None = None
    approved_by: str
    timestamp: str

class OrchestratorState(TypedDict):
    """Main orchestrator state."""

    # Project context
    project_id: str
    tenant_id: str

    # Current task
    task_type: str
    task_id: str
    task_input: dict

    # Routing
    current_phase: Literal[
        "intake",
        "classification",
        "processing",
        "hitl_gate",
        "crew_dispatch",
        "validation",
        "complete"
    ]

    # Messages for agent communication
    messages: Annotated[list, add_messages]

    # Results from processing
    classification_result: dict | None
    processing_result: dict | None
    crew_result: dict | None

    # HITL state
    hitl_required: bool
    hitl_request: HITLRequest | None
    hitl_response: HITLResponse | None

    # Control flow
    retry_count: int
    errors: list[str]

    # Output
    final_output: dict | None
```

### orchestrator/graph.py

```python
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.types import interrupt
from .state import OrchestratorState
from .nodes import (
    classify_task,
    route_to_processor,
    process_document,
    check_hitl_required,
    create_hitl_request,
    dispatch_to_crew,
    validate_output,
    finalize
)

def create_orchestrator_graph(checkpointer: AsyncPostgresSaver):
    """
    Create the main orchestrator graph.

    Flow:
    1. Intake -> Classification -> Routing
    2. Route to Document Processing OR Crew Dispatch
    3. Check HITL requirements
    4. If HITL required: interrupt and wait for human
    5. Validate and finalize
    """

    builder = StateGraph(OrchestratorState)

    # Add nodes
    builder.add_node("classify", classify_task)
    builder.add_node("route", route_to_processor)
    builder.add_node("process_document", process_document)
    builder.add_node("dispatch_crew", dispatch_to_crew)
    builder.add_node("hitl_gate", hitl_gate_node)
    builder.add_node("validate", validate_output)
    builder.add_node("finalize", finalize)

    # Define edges
    builder.add_edge(START, "classify")
    builder.add_edge("classify", "route")

    # Conditional routing based on task type
    builder.add_conditional_edges(
        "route",
        route_decision,
        {
            "document": "process_document",
            "crew": "dispatch_crew"
        }
    )

    # Both paths converge at HITL gate
    builder.add_edge("process_document", "hitl_gate")
    builder.add_edge("dispatch_crew", "hitl_gate")

    # HITL gate conditional
    builder.add_conditional_edges(
        "hitl_gate",
        hitl_decision,
        {
            "needs_review": "hitl_gate",  # Will interrupt here
            "approved": "validate"
        }
    )

    builder.add_edge("validate", "finalize")
    builder.add_edge("finalize", END)

    return builder.compile(checkpointer=checkpointer)

def route_decision(state: OrchestratorState) -> str:
    """Decide whether to process document or dispatch crew."""
    task_type = state.get("task_type", "")
    if task_type in ["document_processing", "extraction"]:
        return "document"
    return "crew"

def hitl_decision(state: OrchestratorState) -> str:
    """Decide if HITL review is needed."""
    if state.get("hitl_required") and not state.get("hitl_response"):
        return "needs_review"
    return "approved"

async def hitl_gate_node(state: OrchestratorState) -> dict:
    """
    HITL gate node - interrupts workflow for human approval.

    CRITICAL: This node uses LangGraph's interrupt() to pause
    execution until a human provides a response.
    """
    if not state.get("hitl_required"):
        return {"current_phase": "validation"}

    if state.get("hitl_response"):
        # Human has responded, continue
        return {"current_phase": "validation"}

    # Create HITL request if not exists
    hitl_request = state.get("hitl_request")
    if not hitl_request:
        hitl_request = create_hitl_request(state)

    # INTERRUPT - workflow pauses here until human responds
    # This is the critical HITL mechanism
    response = interrupt({
        "type": "hitl_review",
        "request": hitl_request.model_dump(),
        "message": f"Human review required: {hitl_request.description}"
    })

    # When resumed, response contains human decision
    return {
        "hitl_response": HITLResponse(**response),
        "current_phase": "validation"
    }
```

### orchestrator/nodes.py

```python
from .state import OrchestratorState, HITLRequest
from ..crews.land_crew import LandAcquisitionCrew
from packages.document_ai import DocumentPipeline
import uuid

async def classify_task(state: OrchestratorState) -> dict:
    """Classify incoming task to determine processing path."""
    task_input = state["task_input"]

    # Determine task type based on input
    if "document_id" in task_input or "file_path" in task_input:
        task_type = "document_processing"
    elif "parcel_id" in task_input:
        task_type = "land_analysis"
    elif "interconnection_id" in task_input:
        task_type = "interconnection"
    else:
        task_type = "general"

    return {
        "task_type": task_type,
        "current_phase": "classification",
        "classification_result": {"task_type": task_type}
    }

async def process_document(state: OrchestratorState) -> dict:
    """Process document through Document AI pipeline."""
    pipeline = DocumentPipeline(...)  # Initialize with config

    result = await pipeline.process(
        file_bytes=state["task_input"]["file_bytes"],
        filename=state["task_input"]["filename"],
        document_id=state["task_id"]
    )

    return {
        "processing_result": result.__dict__,
        "hitl_required": result.requires_review,
        "hitl_request": HITLRequest(
            request_id=str(uuid.uuid4()),
            request_type="review",
            description=f"Review document extraction: {result.review_reasons}",
            context={"extraction": result.extraction},
            urgency="high" if result.confidence < 0.7 else "medium"
        ) if result.requires_review else None,
        "current_phase": "processing"
    }

async def dispatch_to_crew(state: OrchestratorState) -> dict:
    """Dispatch task to appropriate CrewAI crew."""
    task_type = state["task_type"]

    if task_type == "land_analysis":
        crew = LandAcquisitionCrew()
        result = await crew.analyze_parcel(
            parcel_id=state["task_input"]["parcel_id"],
            project_id=state["project_id"]
        )
    else:
        result = {"error": f"No crew for task type: {task_type}"}

    # Determine if HITL needed based on crew output
    hitl_required = result.get("requires_review", False)

    return {
        "crew_result": result,
        "hitl_required": hitl_required,
        "current_phase": "crew_dispatch"
    }

def create_hitl_request(state: OrchestratorState) -> HITLRequest:
    """Create HITL request based on state."""
    task_type = state["task_type"]

    if task_type == "document_processing":
        return HITLRequest(
            request_id=str(uuid.uuid4()),
            request_type="review",
            description="Review document extraction results",
            context={
                "processing_result": state.get("processing_result"),
                "document_id": state["task_id"]
            },
            urgency="high"
        )
    else:
        return HITLRequest(
            request_id=str(uuid.uuid4()),
            request_type="approval",
            description=f"Approve {task_type} results",
            context={"crew_result": state.get("crew_result")},
            urgency="medium"
        )

async def validate_output(state: OrchestratorState) -> dict:
    """Validate final output before completion."""
    errors = []

    # Check HITL was properly handled
    if state.get("hitl_required") and not state.get("hitl_response"):
        errors.append("HITL required but no response received")

    # Check we have results
    if not state.get("processing_result") and not state.get("crew_result"):
        errors.append("No processing or crew result")

    return {
        "errors": errors,
        "current_phase": "validation"
    }

async def finalize(state: OrchestratorState) -> dict:
    """Finalize and prepare output."""
    return {
        "final_output": {
            "task_id": state["task_id"],
            "task_type": state["task_type"],
            "result": state.get("processing_result") or state.get("crew_result"),
            "hitl_decision": state.get("hitl_response"),
            "errors": state.get("errors", [])
        },
        "current_phase": "complete"
    }
```

---

## CrewAI Land Acquisition Crew

### crews/land_crew/agents.py

```python
from crewai import Agent
from langchain_anthropic import ChatAnthropic
from ..tools.land_tools import (
    search_parcels,
    get_parcel_details,
    check_zoning,
    check_environmental_constraints,
    calculate_buildable_area
)
from ..tools.document_tools import (
    parse_document,
    extract_lease_terms
)

def create_site_researcher(llm: ChatAnthropic) -> Agent:
    """
    Site Researcher Agent

    Specializes in identifying and evaluating potential sites
    for solar development.
    """
    return Agent(
        role="Site Researcher",
        goal="Identify and evaluate potential solar development sites based on technical and regulatory criteria",
        backstory="""You are an experienced site acquisition specialist with deep
        knowledge of solar project siting requirements. You understand zoning laws,
        environmental constraints, grid proximity requirements, and land characteristics
        that make sites suitable for utility-scale solar development.""",
        tools=[
            search_parcels,
            get_parcel_details,
            check_zoning,
            check_environmental_constraints,
            calculate_buildable_area
        ],
        llm=llm,
        verbose=True,
        memory=True
    )

def create_lease_analyst(llm: ChatAnthropic) -> Agent:
    """
    Lease Analyst Agent

    Specializes in analyzing and structuring land lease agreements.
    """
    return Agent(
        role="Lease Analyst",
        goal="Analyze lease terms, identify risks, and recommend optimal deal structures",
        backstory="""You are a real estate professional specializing in solar land
        leases. You understand market rates, standard terms, risk factors, and
        negotiation strategies for solar development agreements.""",
        tools=[
            parse_document,
            extract_lease_terms
        ],
        llm=llm,
        verbose=True,
        memory=True
    )

def create_due_diligence_agent(llm: ChatAnthropic) -> Agent:
    """
    Due Diligence Agent

    Coordinates comprehensive due diligence investigations.
    """
    return Agent(
        role="Due Diligence Coordinator",
        goal="Coordinate and synthesize due diligence findings across all workstreams",
        backstory="""You are a meticulous project manager who ensures no stone
        is left unturned during site due diligence. You coordinate environmental
        studies, title reviews, survey work, and regulatory research.""",
        tools=[
            get_parcel_details,
            check_environmental_constraints
        ],
        llm=llm,
        verbose=True,
        memory=True
    )

def create_stakeholder_agent(llm: ChatAnthropic) -> Agent:
    """
    Stakeholder Management Agent

    Manages communications with landowners and other stakeholders.

    CRITICAL: This agent NEVER sends communications automatically.
    All external communications require HITL approval.
    """
    return Agent(
        role="Stakeholder Manager",
        goal="Manage landowner relationships and coordinate stakeholder communications",
        backstory="""You are a skilled relationship manager with experience in
        landowner negotiations. You understand the sensitivities of rural communities
        and know how to build trust with property owners.""",
        tools=[],  # No automated communication tools - HITL required
        llm=llm,
        verbose=True,
        memory=True
    )
```

### crews/land_crew/tasks.py

```python
from crewai import Task
from .agents import (
    create_site_researcher,
    create_lease_analyst,
    create_due_diligence_agent,
    create_stakeholder_agent
)

def create_analyze_parcel_task(agent, parcel_id: str, context: dict) -> Task:
    """Task: Analyze a specific parcel for solar development suitability."""
    return Task(
        description=f"""Analyze parcel {parcel_id} for solar development suitability.

        Required analysis:
        1. Physical characteristics (acreage, topography, shape)
        2. Current zoning and permitted uses
        3. Environmental constraints (wetlands, flood zones, endangered species)
        4. Grid proximity and interconnection potential
        5. Access and road frontage
        6. Neighboring land uses and potential conflicts

        Context: {context}

        Provide a comprehensive suitability score (0-100) with detailed reasoning.
        Flag any critical issues that would disqualify the site.
        """,
        agent=agent,
        expected_output="""JSON report with:
        - suitability_score: 0-100
        - physical_analysis: {...}
        - zoning_analysis: {...}
        - environmental_flags: [...]
        - grid_analysis: {...}
        - critical_issues: [...]
        - recommendation: "proceed" | "further_study" | "disqualify"
        """
    )

def create_extract_lease_task(agent, document_id: str) -> Task:
    """Task: Extract and analyze lease terms from document."""
    return Task(
        description=f"""Extract and analyze lease terms from document {document_id}.

        Required extraction:
        1. All party information (lessor, lessee)
        2. Property description and acreage
        3. Term and extension options
        4. Rent structure and escalations
        5. Use rights and restrictions
        6. Termination provisions
        7. Special conditions

        CRITICAL: Flag any unusual or concerning terms for legal review.
        ALL lease analyses require attorney review before action.
        """,
        agent=agent,
        expected_output="""JSON with extracted terms and analysis:
        - extracted_terms: {...}
        - market_comparison: {...}
        - risk_factors: [...]
        - requires_legal_review: true (always)
        - legal_review_items: [...]
        """
    )

def create_coordinate_dd_task(agent, parcel_id: str, dd_scope: dict) -> Task:
    """Task: Coordinate due diligence activities."""
    return Task(
        description=f"""Coordinate due diligence for parcel {parcel_id}.

        Scope: {dd_scope}

        Required coordination:
        1. Title review status and findings
        2. Environmental assessment status
        3. Survey requirements and status
        4. Regulatory research findings
        5. Utility coordination status

        Synthesize findings into go/no-go recommendation.
        """,
        agent=agent,
        expected_output="""DD status report with:
        - workstream_status: {...}
        - key_findings: [...]
        - open_issues: [...]
        - recommendation: "proceed" | "hold" | "terminate"
        - next_steps: [...]
        """
    )

def create_stakeholder_communication_task(agent, communication_type: str, context: dict) -> Task:
    """
    Task: Prepare stakeholder communication.

    CRITICAL: This task prepares communications for HITL review.
    Communications are NEVER sent automatically.
    """
    return Task(
        description=f"""Prepare {communication_type} communication for stakeholder review.

        Context: {context}

        Requirements:
        1. Draft appropriate communication
        2. Identify recipient(s)
        3. Flag any sensitive topics
        4. Recommend timing

        IMPORTANT: This communication will be queued for human review.
        Do NOT send any communications directly.
        """,
        agent=agent,
        expected_output="""Communication package for review:
        - draft_content: "..."
        - recipients: [...]
        - sensitive_topics: [...]
        - recommended_timing: "..."
        - requires_approval: true (always)
        """
    )
```

### crews/land_crew/crew.py

```python
from crewai import Crew, Process
from langchain_anthropic import ChatAnthropic
from .agents import (
    create_site_researcher,
    create_lease_analyst,
    create_due_diligence_agent,
    create_stakeholder_agent
)
from .tasks import (
    create_analyze_parcel_task,
    create_extract_lease_task,
    create_coordinate_dd_task
)

class LandAcquisitionCrew:
    """
    Land Acquisition Crew

    Specialized crew for land acquisition workflows including
    site research, lease analysis, and due diligence coordination.
    """

    def __init__(self):
        self.llm = ChatAnthropic(
            model="claude-sonnet-4-20250514",
            temperature=0.1
        )

        # Initialize agents
        self.site_researcher = create_site_researcher(self.llm)
        self.lease_analyst = create_lease_analyst(self.llm)
        self.dd_agent = create_due_diligence_agent(self.llm)
        self.stakeholder_agent = create_stakeholder_agent(self.llm)

    async def analyze_parcel(self, parcel_id: str, project_id: str) -> dict:
        """
        Analyze a parcel for solar development suitability.
        """
        context = {
            "project_id": project_id,
            "analysis_type": "full"
        }

        task = create_analyze_parcel_task(
            self.site_researcher,
            parcel_id,
            context
        )

        crew = Crew(
            agents=[self.site_researcher],
            tasks=[task],
            process=Process.sequential,
            verbose=True
        )

        result = crew.kickoff()

        return {
            "parcel_id": parcel_id,
            "analysis": result,
            "requires_review": True,  # Always require review for site decisions
            "crew": "land_acquisition"
        }

    async def analyze_lease(self, document_id: str) -> dict:
        """
        Analyze a lease document.

        CRITICAL: Always requires legal review.
        """
        task = create_extract_lease_task(self.lease_analyst, document_id)

        crew = Crew(
            agents=[self.lease_analyst],
            tasks=[task],
            process=Process.sequential,
            verbose=True
        )

        result = crew.kickoff()

        return {
            "document_id": document_id,
            "extraction": result,
            "requires_review": True,  # ALWAYS for legal docs
            "review_type": "legal",
            "crew": "land_acquisition"
        }

    async def coordinate_due_diligence(
        self,
        parcel_id: str,
        scope: dict
    ) -> dict:
        """
        Coordinate due diligence activities for a parcel.
        """
        task = create_coordinate_dd_task(self.dd_agent, parcel_id, scope)

        crew = Crew(
            agents=[self.dd_agent, self.site_researcher],
            tasks=[task],
            process=Process.sequential,
            verbose=True
        )

        result = crew.kickoff()

        return {
            "parcel_id": parcel_id,
            "dd_status": result,
            "requires_review": True,
            "crew": "land_acquisition"
        }
```

---

## Tools

### tools/land_tools.py

```python
from crewai.tools import tool
from typing import Optional

@tool("Search Parcels")
def search_parcels(
    county: str,
    state: str,
    min_acres: float = 50,
    max_acres: float = 5000,
    zoning: Optional[str] = None
) -> str:
    """
    Search for parcels matching criteria.

    Args:
        county: County name
        state: State abbreviation (e.g., "TX")
        min_acres: Minimum parcel size
        max_acres: Maximum parcel size
        zoning: Optional zoning filter

    Returns:
        JSON list of matching parcels with basic info
    """
    # Implementation connects to parcel database/API
    ...

@tool("Get Parcel Details")
def get_parcel_details(parcel_id: str) -> str:
    """
    Get detailed information about a specific parcel.

    Args:
        parcel_id: Unique parcel identifier (APN)

    Returns:
        JSON with parcel details including geometry, ownership, zoning
    """
    ...

@tool("Check Zoning")
def check_zoning(parcel_id: str) -> str:
    """
    Check zoning designation and permitted uses for a parcel.

    Args:
        parcel_id: Unique parcel identifier

    Returns:
        JSON with zoning code, permitted uses, solar eligibility
    """
    ...

@tool("Check Environmental Constraints")
def check_environmental_constraints(parcel_id: str) -> str:
    """
    Check environmental constraints affecting a parcel.

    Args:
        parcel_id: Unique parcel identifier

    Returns:
        JSON with wetlands, flood zones, endangered species, etc.
    """
    ...

@tool("Calculate Buildable Area")
def calculate_buildable_area(
    parcel_id: str,
    setbacks: dict = None
) -> str:
    """
    Calculate buildable area accounting for setbacks and constraints.

    Args:
        parcel_id: Unique parcel identifier
        setbacks: Optional custom setback requirements

    Returns:
        JSON with buildable acres, DC capacity potential, constraints map
    """
    ...
```

### tools/document_tools.py

```python
from crewai.tools import tool

@tool("Parse Document")
def parse_document(document_id: str) -> str:
    """
    Parse a document and extract text content.

    Args:
        document_id: Document ID in the system

    Returns:
        Extracted text content from the document
    """
    ...

@tool("Extract Lease Terms")
def extract_lease_terms(document_id: str) -> str:
    """
    Extract structured lease terms from a document.

    Args:
        document_id: Document ID for lease document

    Returns:
        JSON with extracted lease terms

    Note: Results always require legal review.
    """
    ...
```

---

## PostgreSQL Checkpointer

### checkpointer/postgres.py

```python
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

async def create_checkpointer(database_url: str) -> AsyncPostgresSaver:
    """
    Create PostgreSQL checkpointer for workflow durability.

    This enables:
    - Workflow state persistence across restarts
    - HITL interrupts that survive system restarts
    - Audit trail of all state transitions
    """
    checkpointer = AsyncPostgresSaver.from_conn_string(database_url)
    await checkpointer.setup()
    return checkpointer
```

---

## Deliverables Checklist

### Orchestrator
- [ ] OrchestratorState TypedDict definition
- [ ] LangGraph StateGraph implementation
- [ ] Node functions (classify, route, process, dispatch)
- [ ] HITL gate with interrupt()
- [ ] PostgreSQL checkpointer integration
- [ ] Conditional routing logic

### Land Acquisition Crew
- [ ] Site Researcher agent with tools
- [ ] Lease Analyst agent
- [ ] Due Diligence Coordinator agent
- [ ] Stakeholder Manager agent (no auto-comms)
- [ ] Analyze parcel task
- [ ] Extract lease task
- [ ] Coordinate DD task

### Tools
- [ ] search_parcels tool
- [ ] get_parcel_details tool
- [ ] check_zoning tool
- [ ] check_environmental_constraints tool
- [ ] calculate_buildable_area tool
- [ ] parse_document tool
- [ ] extract_lease_terms tool

### Critical Requirements
- [ ] HITL gates pause workflow until human approval
- [ ] Legal documents ALWAYS require attorney review
- [ ] No automated external communications
- [ ] All decisions logged for audit
- [ ] Confidence < 90% triggers HITL
