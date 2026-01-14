# Phases 4, 5, 6: Workflows, Visualization, Production

## Phase 4: Temporal Workflows

### Overview

Implement durable, long-running workflows using Temporal for processes that span months or years of project development.

### Architecture

```
packages/workflows/
├── __init__.py
├── worker.py                    # Temporal worker
├── client.py                    # Temporal client utilities
├── activities/
│   ├── __init__.py
│   ├── document_activities.py
│   ├── approval_activities.py
│   └── notification_activities.py
├── workflows/
│   ├── __init__.py
│   ├── project_lifecycle.py     # Parent workflow
│   ├── land_acquisition.py      # Child workflow
│   ├── interconnection.py       # Child workflow
│   └── permitting.py            # Child workflow
└── signals/
    ├── __init__.py
    └── hitl_signals.py
```

### Docker Compose Addition

Add to docker-compose.yml:

```yaml
  temporal:
    image: temporalio/auto-setup:latest
    container_name: neurogrid-temporal
    ports:
      - "7233:7233"
    environment:
      - DB=postgresql
      - DB_PORT=5432
      - POSTGRES_USER=neurogrid
      - POSTGRES_PWD=neurogrid_dev
      - POSTGRES_SEEDS=postgres
    depends_on:
      - postgres

  temporal-ui:
    image: temporalio/ui:latest
    container_name: neurogrid-temporal-ui
    ports:
      - "8080:8080"
    environment:
      - TEMPORAL_ADDRESS=temporal:7233
    depends_on:
      - temporal
```

### Project Lifecycle Workflow

```python
# workflows/project_lifecycle.py
from datetime import timedelta
from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from .land_acquisition import LandAcquisitionWorkflow
    from .interconnection import InterconnectionWorkflow
    from .permitting import PermittingWorkflow

@workflow.defn
class ProjectLifecycleWorkflow:
    """
    Parent workflow orchestrating the entire project lifecycle.

    This workflow can run for YEARS, coordinating child workflows
    for land acquisition, interconnection, and permitting.
    """

    def __init__(self):
        self.status = "initialized"
        self.land_complete = False
        self.interconnection_complete = False
        self.permitting_complete = False
        self.pending_approvals = []

    @workflow.signal
    async def gate_decision(self, decision: dict):
        """
        Signal handler for HITL gate decisions.

        Called when a human approves/rejects a pending decision.
        """
        approval_id = decision["approval_id"]
        approved = decision["approved"]
        notes = decision.get("notes", "")
        approved_by = decision["approved_by"]

        # Find and resolve the pending approval
        for approval in self.pending_approvals:
            if approval["id"] == approval_id:
                approval["resolved"] = True
                approval["approved"] = approved
                approval["notes"] = notes
                approval["approved_by"] = approved_by
                break

    @workflow.run
    async def run(self, project_id: str, config: dict) -> dict:
        """
        Execute the full project lifecycle.
        """
        self.status = "land_acquisition"

        # Phase 1: Land Acquisition
        land_result = await workflow.execute_child_workflow(
            LandAcquisitionWorkflow.run,
            args=[project_id, config.get("land_config", {})],
            id=f"{project_id}-land",
            retry_policy=RetryPolicy(maximum_attempts=3)
        )

        # HITL Gate: Land acquisition approval
        await self._hitl_gate(
            gate_id=f"{project_id}-land-approval",
            gate_type="land_acquisition_complete",
            context={"land_result": land_result}
        )

        self.land_complete = True
        self.status = "interconnection"

        # Phase 2: Interconnection (can run in parallel with permitting)
        interconnection_handle = await workflow.start_child_workflow(
            InterconnectionWorkflow.run,
            args=[project_id, config.get("interconnection_config", {})],
            id=f"{project_id}-interconnection"
        )

        # Phase 3: Permitting
        self.status = "permitting"
        permitting_handle = await workflow.start_child_workflow(
            PermittingWorkflow.run,
            args=[project_id, config.get("permitting_config", {})],
            id=f"{project_id}-permitting"
        )

        # Wait for both to complete
        interconnection_result = await interconnection_handle
        permitting_result = await permitting_handle

        # Final HITL Gate: Project go/no-go
        await self._hitl_gate(
            gate_id=f"{project_id}-final-approval",
            gate_type="construction_ready",
            context={
                "land": land_result,
                "interconnection": interconnection_result,
                "permitting": permitting_result
            }
        )

        self.status = "complete"
        return {
            "project_id": project_id,
            "land": land_result,
            "interconnection": interconnection_result,
            "permitting": permitting_result,
            "status": "approved_for_construction"
        }

    async def _hitl_gate(
        self,
        gate_id: str,
        gate_type: str,
        context: dict
    ):
        """
        HITL gate implementation using Temporal signals.

        Creates a pending approval and waits for human signal.
        """
        approval = {
            "id": gate_id,
            "type": gate_type,
            "context": context,
            "resolved": False,
            "approved": None
        }
        self.pending_approvals.append(approval)

        # Notify that approval is needed (via activity)
        await workflow.execute_activity(
            "notify_approval_required",
            args=[gate_id, gate_type, context],
            start_to_close_timeout=timedelta(minutes=5)
        )

        # Wait for signal - THIS IS THE HITL PAUSE
        # Workflow suspends here until gate_decision signal received
        await workflow.wait_condition(
            lambda: any(
                a["id"] == gate_id and a["resolved"]
                for a in self.pending_approvals
            )
        )

        # Check if approved
        for approval in self.pending_approvals:
            if approval["id"] == gate_id:
                if not approval["approved"]:
                    raise workflow.ApplicationError(
                        f"Gate {gate_id} rejected: {approval.get('notes', 'No reason provided')}"
                    )
                break
```

### Land Acquisition Workflow

```python
# workflows/land_acquisition.py
from datetime import timedelta
from temporalio import workflow

@workflow.defn
class LandAcquisitionWorkflow:
    """
    Child workflow for land acquisition phase.
    """

    def __init__(self):
        self.parcels_secured = []
        self.pending_approval = None

    @workflow.signal
    async def lease_approval(self, decision: dict):
        """Signal for lease approval decisions."""
        self.pending_approval = decision

    @workflow.run
    async def run(self, project_id: str, config: dict) -> dict:
        """Execute land acquisition workflow."""

        # Step 1: Site identification
        sites = await workflow.execute_activity(
            "identify_sites",
            args=[project_id, config],
            start_to_close_timeout=timedelta(hours=1)
        )

        for site in sites:
            # Step 2: Due diligence
            dd_result = await workflow.execute_activity(
                "perform_due_diligence",
                args=[site["parcel_id"]],
                start_to_close_timeout=timedelta(days=7)
            )

            if dd_result["recommendation"] != "proceed":
                continue

            # Step 3: Lease negotiation
            lease_draft = await workflow.execute_activity(
                "negotiate_lease",
                args=[site["parcel_id"], project_id],
                start_to_close_timeout=timedelta(days=30)
            )

            # HITL: Legal review required for ALL leases
            await workflow.execute_activity(
                "request_legal_review",
                args=[lease_draft["document_id"]],
                start_to_close_timeout=timedelta(minutes=5)
            )

            # Wait for legal approval signal
            self.pending_approval = None
            await workflow.wait_condition(
                lambda: self.pending_approval is not None
            )

            if self.pending_approval.get("approved"):
                # Step 4: Execute lease
                await workflow.execute_activity(
                    "execute_lease",
                    args=[lease_draft["document_id"]],
                    start_to_close_timeout=timedelta(hours=1)
                )
                self.parcels_secured.append(site["parcel_id"])

        return {
            "parcels_secured": self.parcels_secured,
            "total_acres": sum(p.get("acres", 0) for p in sites)
        }
```

### Activities

```python
# activities/approval_activities.py
from temporalio import activity
from dataclasses import dataclass

@dataclass
class ApprovalRequest:
    approval_id: str
    approval_type: str
    project_id: str
    context: dict
    urgency: str

@activity.defn
async def notify_approval_required(
    approval_id: str,
    approval_type: str,
    context: dict
) -> None:
    """
    Notify stakeholders that approval is required.

    This creates a task in the approval queue and sends notifications.
    """
    # Create approval request in database
    # Send email/Slack notifications
    # This does NOT auto-approve - just notifies
    ...

@activity.defn
async def request_legal_review(document_id: str) -> dict:
    """
    Request legal review for a document.

    CRITICAL: Legal documents are NEVER auto-approved.
    This creates a review task for attorneys.
    """
    # Create legal review task
    # Assign to legal team
    # Return task ID for tracking
    ...
```

### Worker

```python
# worker.py
import asyncio
from temporalio.client import Client
from temporalio.worker import Worker

from .workflows.project_lifecycle import ProjectLifecycleWorkflow
from .workflows.land_acquisition import LandAcquisitionWorkflow
from .workflows.interconnection import InterconnectionWorkflow
from .workflows.permitting import PermittingWorkflow
from .activities import document_activities, approval_activities

async def main():
    client = await Client.connect("localhost:7233")

    worker = Worker(
        client,
        task_queue="neurogrid-main",
        workflows=[
            ProjectLifecycleWorkflow,
            LandAcquisitionWorkflow,
            InterconnectionWorkflow,
            PermittingWorkflow
        ],
        activities=[
            document_activities.process_document,
            document_activities.extract_document,
            approval_activities.notify_approval_required,
            approval_activities.request_legal_review,
        ]
    )

    await worker.run()

if __name__ == "__main__":
    asyncio.run(main())
```

---

## Phase 5: Visualization

### Overview

Build interactive maps and charts for project visualization using MapLibre GL JS and DHTMLX Gantt.

### ParcelMap Component

```typescript
// apps/web/components/maps/ParcelMap.tsx
"use client";

import { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as turf from "@turf/turf";

interface Parcel {
  id: string;
  geometry: GeoJSON.MultiPolygon;
  properties: {
    apn: string;
    acres: number;
    status: "available" | "under_option" | "leased" | "owned";
    owner: string;
    zoning: string;
  };
}

interface ParcelMapProps {
  parcels: Parcel[];
  center?: [number, number];
  zoom?: number;
  onParcelClick?: (parcel: Parcel) => void;
  onParcelHover?: (parcel: Parcel | null) => void;
}

const STATUS_COLORS: Record<string, string> = {
  available: "#22c55e",      // green
  under_option: "#eab308",   // yellow
  leased: "#3b82f6",         // blue
  owned: "#8b5cf6",          // purple
};

export function ParcelMap({
  parcels,
  center = [-98.5795, 39.8283], // US center
  zoom = 4,
  onParcelClick,
  onParcelHover,
}: ParcelMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: [
              "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap contributors",
          },
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
          },
        ],
      },
      center,
      zoom,
    });

    map.current.on("load", () => {
      setLoaded(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [center, zoom]);

  // Add parcel layer when map loads or parcels change
  useEffect(() => {
    if (!map.current || !loaded || parcels.length === 0) return;

    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: parcels.map((parcel) => ({
        type: "Feature",
        id: parcel.id,
        geometry: parcel.geometry,
        properties: parcel.properties,
      })),
    };

    // Add or update source
    if (map.current.getSource("parcels")) {
      (map.current.getSource("parcels") as maplibregl.GeoJSONSource)
        .setData(geojson);
    } else {
      map.current.addSource("parcels", {
        type: "geojson",
        data: geojson,
      });

      // Fill layer
      map.current.addLayer({
        id: "parcels-fill",
        type: "fill",
        source: "parcels",
        paint: {
          "fill-color": [
            "match",
            ["get", "status"],
            "available", STATUS_COLORS.available,
            "under_option", STATUS_COLORS.under_option,
            "leased", STATUS_COLORS.leased,
            "owned", STATUS_COLORS.owned,
            "#gray"
          ],
          "fill-opacity": 0.5,
        },
      });

      // Outline layer
      map.current.addLayer({
        id: "parcels-outline",
        type: "line",
        source: "parcels",
        paint: {
          "line-color": "#1e293b",
          "line-width": 2,
        },
      });

      // Click handler
      map.current.on("click", "parcels-fill", (e) => {
        if (e.features && e.features[0] && onParcelClick) {
          const feature = e.features[0];
          const parcel = parcels.find((p) => p.id === feature.id);
          if (parcel) onParcelClick(parcel);
        }
      });

      // Hover handlers
      map.current.on("mouseenter", "parcels-fill", () => {
        if (map.current) map.current.getCanvas().style.cursor = "pointer";
      });

      map.current.on("mouseleave", "parcels-fill", () => {
        if (map.current) map.current.getCanvas().style.cursor = "";
        if (onParcelHover) onParcelHover(null);
      });

      map.current.on("mousemove", "parcels-fill", (e) => {
        if (e.features && e.features[0] && onParcelHover) {
          const feature = e.features[0];
          const parcel = parcels.find((p) => p.id === feature.id);
          if (parcel) onParcelHover(parcel);
        }
      });
    }
  }, [parcels, loaded, onParcelClick, onParcelHover]);

  // Helper function using Turf.js
  const calculateTotalArea = (): number => {
    return parcels.reduce((total, parcel) => {
      const area = turf.area(parcel.geometry);
      return total + area / 4046.86; // Convert m² to acres
    }, 0);
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white p-3 rounded-lg shadow-lg">
        <h4 className="font-semibold mb-2">Status</h4>
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-2 text-sm">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: color }}
            />
            <span className="capitalize">{status.replace("_", " ")}</span>
          </div>
        ))}
        <div className="mt-2 pt-2 border-t text-sm">
          Total: {calculateTotalArea().toFixed(1)} acres
        </div>
      </div>
    </div>
  );
}
```

### PermitGantt Component

```typescript
// apps/web/components/charts/PermitGantt.tsx
"use client";

import { useEffect, useRef } from "react";
import { Gantt } from "dhtmlx-gantt";
import "dhtmlx-gantt/codebase/dhtmlxgantt.css";

interface PermitTask {
  id: string;
  text: string;
  start_date: string;
  end_date?: string;
  duration?: number;
  progress: number;
  parent?: string;
  type?: "task" | "milestone" | "project";
  permit_type?: string;
  status?: "pending" | "submitted" | "approved" | "rejected";
}

interface PermitLink {
  id: string;
  source: string;
  target: string;
  type: "0" | "1" | "2" | "3"; // finish-to-start, start-to-start, finish-to-finish, start-to-finish
}

interface PermitGanttProps {
  tasks: PermitTask[];
  links: PermitLink[];
  onTaskUpdate?: (task: PermitTask) => void;
  onLinkAdd?: (link: PermitLink) => void;
  readOnly?: boolean;
}

export function PermitGantt({
  tasks,
  links,
  onTaskUpdate,
  onLinkAdd,
  readOnly = false,
}: PermitGanttProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<typeof Gantt | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Configure Gantt
    Gantt.config.date_format = "%Y-%m-%d";
    Gantt.config.readonly = readOnly;
    Gantt.config.columns = [
      {
        name: "text",
        label: "Permit/Task",
        width: 200,
        tree: true,
      },
      {
        name: "start_date",
        label: "Start",
        align: "center",
        width: 90,
      },
      {
        name: "duration",
        label: "Days",
        align: "center",
        width: 50,
      },
      {
        name: "progress",
        label: "Progress",
        align: "center",
        width: 60,
        template: (task: PermitTask) => `${Math.round(task.progress * 100)}%`,
      },
    ];

    // Custom task coloring based on status
    Gantt.templates.task_class = (start, end, task: PermitTask) => {
      const classes = [];
      if (task.status === "approved") classes.push("gantt-task-approved");
      if (task.status === "rejected") classes.push("gantt-task-rejected");
      if (task.status === "submitted") classes.push("gantt-task-submitted");
      return classes.join(" ");
    };

    // Initialize
    Gantt.init(containerRef.current);
    ganttRef.current = Gantt;

    // Load data
    Gantt.parse({ data: tasks, links });

    // Event handlers
    if (onTaskUpdate) {
      Gantt.attachEvent("onAfterTaskUpdate", (id: string) => {
        const task = Gantt.getTask(id);
        onTaskUpdate(task as PermitTask);
      });

      Gantt.attachEvent("onAfterTaskDrag", (id: string) => {
        const task = Gantt.getTask(id);
        onTaskUpdate(task as PermitTask);
      });
    }

    if (onLinkAdd) {
      Gantt.attachEvent("onAfterLinkAdd", (id: string, link: PermitLink) => {
        onLinkAdd(link);
      });
    }

    return () => {
      Gantt.clearAll();
    };
  }, [tasks, links, onTaskUpdate, onLinkAdd, readOnly]);

  // Update data when props change
  useEffect(() => {
    if (ganttRef.current) {
      ganttRef.current.clearAll();
      ganttRef.current.parse({ data: tasks, links });
    }
  }, [tasks, links]);

  return (
    <div className="w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      <style jsx global>{`
        .gantt-task-approved .gantt_task_progress {
          background-color: #22c55e;
        }
        .gantt-task-rejected .gantt_task_content {
          background-color: #ef4444;
        }
        .gantt-task-submitted .gantt_task_content {
          background-color: #3b82f6;
        }
      `}</style>
    </div>
  );
}
```

---

## Phase 6: Production Readiness

### Real-time Collaboration

```typescript
// apps/web/hooks/useCollaboration.ts
import { useEffect, useState } from "react";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";

interface UseCollaborationOptions {
  documentId: string;
  userId: string;
  userName: string;
}

interface Collaborator {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
}

export function useCollaboration({
  documentId,
  userId,
  userName,
}: UseCollaborationOptions) {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ydoc = new Y.Doc();

    const hocuspocus = new HocuspocusProvider({
      url: process.env.NEXT_PUBLIC_COLLABORATION_URL || "ws://localhost:1234",
      name: documentId,
      document: ydoc,
      onConnect: () => setConnected(true),
      onDisconnect: () => setConnected(false),
      onAwarenessUpdate: ({ states }) => {
        const users = Array.from(states.entries())
          .filter(([id]) => id !== ydoc.clientID)
          .map(([id, state]) => ({
            id: String(id),
            name: state.user?.name || "Anonymous",
            color: state.user?.color || "#888",
            cursor: state.cursor,
          }));
        setCollaborators(users);
      },
    });

    // Set local user info
    hocuspocus.setAwarenessField("user", {
      id: userId,
      name: userName,
      color: generateColor(userId),
    });

    setDoc(ydoc);
    setProvider(hocuspocus);

    return () => {
      hocuspocus.destroy();
      ydoc.destroy();
    };
  }, [documentId, userId, userName]);

  const updateCursor = (x: number, y: number) => {
    provider?.setAwarenessField("cursor", { x, y });
  };

  return {
    doc,
    provider,
    collaborators,
    connected,
    updateCursor,
  };
}

function generateColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 50%)`;
}
```

### MCP Server

```python
# packages/mcp-server/server.py
from fastmcp import FastMCP
from fastmcp.resources import Resource
from fastmcp.tools import Tool
from pydantic import BaseModel
import httpx

mcp = FastMCP(
    name="neurogrid",
    version="1.0.0",
    description="Neurogrid MCP server for AI-powered solar development"
)

# Authentication middleware
@mcp.middleware
async def auth_middleware(request, call_next):
    """OAuth 2.1 authentication for MCP requests."""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise ValueError("Authentication required")

    # Validate token (implement your OAuth validation)
    user = await validate_oauth_token(token)
    request.state.user = user

    return await call_next(request)

# Tools

class ProjectStatusInput(BaseModel):
    project_id: str

class ProjectStatus(BaseModel):
    project_id: str
    name: str
    status: str
    phase: str
    completion_percentage: float
    pending_approvals: list[dict]
    recent_activity: list[dict]

@mcp.tool()
async def get_project_status(input: ProjectStatusInput) -> ProjectStatus:
    """
    Get the current status of a solar development project.

    Returns comprehensive project status including phase,
    completion percentage, pending approvals, and recent activity.
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{API_URL}/projects/{input.project_id}/status",
            headers={"Authorization": f"Bearer {get_service_token()}"}
        )
        data = response.json()

    return ProjectStatus(**data)

class SearchDocumentsInput(BaseModel):
    query: str
    project_id: str | None = None
    document_type: str | None = None
    limit: int = 10

class DocumentResult(BaseModel):
    document_id: str
    title: str
    document_type: str
    relevance_score: float
    snippet: str
    project_id: str

@mcp.tool()
async def search_documents(input: SearchDocumentsInput) -> list[DocumentResult]:
    """
    Search for documents across projects using semantic search.

    Searches document content, extractions, and metadata.
    Returns ranked results with relevance scores.
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{API_URL}/documents/search",
            json={
                "query": input.query,
                "project_id": input.project_id,
                "document_type": input.document_type,
                "limit": input.limit
            },
            headers={"Authorization": f"Bearer {get_service_token()}"}
        )
        data = response.json()

    return [DocumentResult(**doc) for doc in data["results"]]

class ApprovalRequestInput(BaseModel):
    approval_type: str
    project_id: str
    description: str
    context: dict
    urgency: str = "medium"

class ApprovalResponse(BaseModel):
    approval_id: str
    status: str
    message: str

@mcp.tool()
async def request_approval(input: ApprovalRequestInput) -> ApprovalResponse:
    """
    Request human approval for an action.

    Creates an approval request in the HITL queue.
    The request will be reviewed by the appropriate stakeholder.

    IMPORTANT: This does NOT auto-approve. It queues for human review.
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{API_URL}/approvals",
            json={
                "type": input.approval_type,
                "project_id": input.project_id,
                "description": input.description,
                "context": input.context,
                "urgency": input.urgency,
                "requested_by": "mcp_client"
            },
            headers={"Authorization": f"Bearer {get_service_token()}"}
        )
        data = response.json()

    return ApprovalResponse(
        approval_id=data["id"],
        status="pending",
        message="Approval request created and queued for human review"
    )

# Resources

@mcp.resource("projects/{project_id}")
async def get_project_resource(project_id: str) -> Resource:
    """Get project details as a resource."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{API_URL}/projects/{project_id}",
            headers={"Authorization": f"Bearer {get_service_token()}"}
        )
        data = response.json()

    return Resource(
        uri=f"projects/{project_id}",
        name=data["name"],
        description=f"Solar project: {data['name']}",
        mimeType="application/json",
        content=data
    )

if __name__ == "__main__":
    mcp.run()
```

### Kubernetes Manifests

```yaml
# infrastructure/kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: neurogrid-api
  namespace: neurogrid
spec:
  replicas: 3
  selector:
    matchLabels:
      app: neurogrid-api
  template:
    metadata:
      labels:
        app: neurogrid-api
    spec:
      containers:
        - name: api
          image: neurogrid/api:latest
          ports:
            - containerPort: 8000
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: neurogrid-secrets
                  key: database-url
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: neurogrid-secrets
                  key: redis-url
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: neurogrid-api
  namespace: neurogrid
spec:
  selector:
    app: neurogrid-api
  ports:
    - port: 80
      targetPort: 8000
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: neurogrid-ingress
  namespace: neurogrid
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - api.neurogrid.com
      secretName: neurogrid-tls
  rules:
    - host: api.neurogrid.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: neurogrid-api
                port:
                  number: 80
```

---

## Deliverables Checklist

### Phase 4: Temporal
- [ ] Temporal server in docker-compose
- [ ] ProjectLifecycleWorkflow (parent)
- [ ] LandAcquisitionWorkflow (child)
- [ ] InterconnectionWorkflow (child)
- [ ] PermittingWorkflow (child)
- [ ] HITL signal handlers
- [ ] wait_condition for approvals
- [ ] Worker implementation
- [ ] Activities for documents and approvals

### Phase 5: Visualization
- [ ] ParcelMap with MapLibre GL JS
- [ ] Status-based parcel coloring
- [ ] Click and hover handlers
- [ ] Turf.js area calculations
- [ ] PermitGantt with DHTMLX
- [ ] Task dependencies
- [ ] Drag-to-update functionality
- [ ] API sync on changes

### Phase 6: Production
- [ ] Hocuspocus collaboration server
- [ ] useCollaboration hook with Yjs
- [ ] MCP server with FastMCP
- [ ] get_project_status tool
- [ ] search_documents tool
- [ ] request_approval tool
- [ ] OAuth 2.1 authentication
- [ ] Kubernetes deployments
- [ ] Services and ingress
- [ ] Secrets management

### Critical HITL Requirements (All Phases)
- [ ] Workflows pause at HITL gates
- [ ] Legal documents require attorney review
- [ ] Confidence < 90% triggers review
- [ ] No auto-approval for any decisions
- [ ] All decisions logged for audit
