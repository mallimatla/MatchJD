# Phase 1: Foundation

## Overview

Establish the monorepo structure, database models, and development infrastructure for Neurogrid.

## Week 1: Project Setup

### 1.1 Turborepo Monorepo

Initialize a Turborepo monorepo with pnpm workspaces:

```bash
npx create-turbo@latest neurogrid --package-manager pnpm
```

**Structure:**
```
neurogrid/
├── apps/
│   ├── web/                # Next.js frontend
│   └── api/                # FastAPI backend
├── packages/
│   ├── ui/                 # Shared UI components
│   ├── config/             # Shared configurations
│   └── types/              # Shared TypeScript types
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### 1.2 Next.js 14 App (apps/web)

Create Next.js app with:

```bash
cd apps
pnpm create next-app web --typescript --tailwind --eslint --app --src-dir
```

**Configuration Requirements:**
- TypeScript strict mode (`strict: true` in tsconfig.json)
- App Router (not Pages Router)
- Tailwind CSS with custom theme
- shadcn/ui initialized

**shadcn/ui Setup:**
```bash
cd apps/web
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button card dialog form input label select table tabs
```

### 1.3 FastAPI App (apps/api)

Create FastAPI application structure:

```
apps/api/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app factory
│   ├── config.py            # Settings with pydantic-settings
│   ├── database.py          # Async SQLAlchemy setup
│   ├── models/              # SQLAlchemy models
│   │   ├── __init__.py
│   │   └── base.py
│   ├── schemas/             # Pydantic v2 schemas
│   │   └── __init__.py
│   ├── api/                 # API routes
│   │   ├── __init__.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       └── router.py
│   └── services/            # Business logic
│       └── __init__.py
├── alembic/                 # Migrations
├── alembic.ini
├── pyproject.toml
└── requirements.txt
```

**Dependencies:**
```
fastapi>=0.109.0
uvicorn[standard]>=0.27.0
sqlalchemy[asyncio]>=2.0.25
asyncpg>=0.29.0
pydantic>=2.5.0
pydantic-settings>=2.1.0
alembic>=1.13.0
python-multipart>=0.0.6
```

### 1.4 Docker Infrastructure

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: neurogrid-postgres
    environment:
      POSTGRES_USER: neurogrid
      POSTGRES_PASSWORD: neurogrid_dev
      POSTGRES_DB: neurogrid
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U neurogrid"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: neurogrid-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  minio:
    image: minio/minio:latest
    container_name: neurogrid-minio
    environment:
      MINIO_ROOT_USER: neurogrid
      MINIO_ROOT_PASSWORD: neurogrid_dev
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

### 1.5 Database Init Script

**scripts/init-db.sql:**
```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS land;
CREATE SCHEMA IF NOT EXISTS interconnection;
CREATE SCHEMA IF NOT EXISTS permitting;
CREATE SCHEMA IF NOT EXISTS documents;

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA land TO neurogrid;
GRANT ALL PRIVILEGES ON SCHEMA interconnection TO neurogrid;
GRANT ALL PRIVILEGES ON SCHEMA permitting TO neurogrid;
GRANT ALL PRIVILEGES ON SCHEMA documents TO neurogrid;
```

---

## Week 2: Database Models

### 2.1 Base Model (apps/api/app/models/base.py)

```python
from datetime import datetime
from uuid import uuid4
from sqlalchemy import Column, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, declared_attr

class Base(DeclarativeBase):
    pass

class TimestampMixin:
    """Mixin for created_at and updated_at timestamps."""

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

class TenantMixin:
    """Mixin for multi-tenant row-level security."""

    @declared_attr
    def tenant_id(cls):
        return Column(
            UUID(as_uuid=True),
            nullable=False,
            index=True
        )
```

### 2.2 Project Model (apps/api/app/models/project.py)

```python
from enum import Enum
from sqlalchemy import Column, String, Float, Integer, Text, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from uuid import uuid4

from .base import Base, TimestampMixin, TenantMixin

class ProjectStatus(str, Enum):
    PROSPECTING = "prospecting"
    SITE_CONTROL = "site_control"
    DUE_DILIGENCE = "due_diligence"
    DEVELOPMENT = "development"
    CONSTRUCTION = "construction"
    OPERATIONAL = "operational"
    DECOMMISSIONED = "decommissioned"

class ProjectType(str, Enum):
    UTILITY_SOLAR = "utility_solar"
    DISTRIBUTED_SOLAR = "distributed_solar"
    STORAGE = "storage"
    HYBRID = "hybrid"

class Project(Base, TimestampMixin, TenantMixin):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text)

    # Classification
    project_type = Column(SQLEnum(ProjectType), nullable=False)
    status = Column(SQLEnum(ProjectStatus), default=ProjectStatus.PROSPECTING)

    # Location
    state = Column(String(2), nullable=False)
    county = Column(String(100))
    latitude = Column(Float)
    longitude = Column(Float)

    # Capacity
    capacity_mw_ac = Column(Float)
    capacity_mw_dc = Column(Float)
    storage_mwh = Column(Float)

    # Financials
    estimated_capex = Column(Float)
    target_cod = Column(String(10))  # YYYY-MM format

    # Metadata
    metadata = Column(JSONB, default={})

    # Relationships
    parcels = relationship("Parcel", back_populates="project")
    documents = relationship("Document", back_populates="project")
```

### 2.3 Land Models (apps/api/app/models/land/)

**parcel.py:**
```python
from sqlalchemy import Column, String, Float, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from uuid import uuid4

from ..base import Base, TimestampMixin, TenantMixin

class Parcel(Base, TimestampMixin, TenantMixin):
    __tablename__ = "parcels"
    __table_args__ = {"schema": "land"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"))

    # Identification
    apn = Column(String(50), nullable=False)  # Assessor Parcel Number
    county = Column(String(100), nullable=False)
    state = Column(String(2), nullable=False)

    # Geometry
    geometry = Column(Geometry("MULTIPOLYGON", srid=4326))
    centroid = Column(Geometry("POINT", srid=4326))

    # Physical
    acres = Column(Float)
    zoning = Column(String(50))
    land_use = Column(String(100))

    # Ownership
    owner_name = Column(String(255))
    owner_address = Column(Text)
    owner_type = Column(String(50))  # individual, corporate, government

    # Assessment
    assessed_value = Column(Float)
    market_value = Column(Float)

    # Metadata
    source = Column(String(100))
    raw_data = Column(JSONB)

    # Relationships
    project = relationship("Project", back_populates="parcels")
    leases = relationship("Lease", back_populates="parcel")
```

**lease.py:**
```python
from sqlalchemy import Column, String, Float, Date, ForeignKey, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from uuid import uuid4
from enum import Enum

from ..base import Base, TimestampMixin, TenantMixin

class LeaseStatus(str, Enum):
    DRAFT = "draft"
    NEGOTIATING = "negotiating"
    PENDING_REVIEW = "pending_review"
    EXECUTED = "executed"
    TERMINATED = "terminated"

class Lease(Base, TimestampMixin, TenantMixin):
    __tablename__ = "leases"
    __table_args__ = {"schema": "land"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    parcel_id = Column(UUID(as_uuid=True), ForeignKey("land.parcels.id"))

    # Status
    status = Column(String(50), default=LeaseStatus.DRAFT)

    # Parties
    lessor_name = Column(String(255))
    lessor_entity_type = Column(String(50))
    lessee_name = Column(String(255))

    # Terms
    effective_date = Column(Date)
    expiration_date = Column(Date)
    term_years = Column(Integer)

    # Rent
    rent_per_acre = Column(Float)
    annual_escalation_pct = Column(Float)
    signing_bonus = Column(Float)

    # Options
    extension_terms = Column(JSONB)  # [{years: 5, notice_days: 180}, ...]
    purchase_option = Column(Boolean, default=False)
    purchase_price_formula = Column(Text)

    # Extracted from document
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.documents.id"))
    extraction_confidence = Column(Float)
    extracted_terms = Column(JSONB)

    # Relationships
    parcel = relationship("Parcel", back_populates="leases")
```

### 2.4 Row-Level Security

After creating models, apply RLS policies:

```sql
-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE land.parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE land.leases ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY tenant_isolation_projects ON projects
    USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_parcels ON land.parcels
    USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_leases ON land.leases
    USING (tenant_id = current_setting('app.current_tenant')::uuid);
```

---

## Week 3: API Foundation

### 3.1 Database Connection (apps/api/app/database.py)

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
from .config import settings

engine = create_async_engine(
    settings.database_url,
    poolclass=NullPool,
    echo=settings.debug
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def get_db():
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()
```

### 3.2 Basic CRUD Endpoints

Implement standard REST endpoints for:
- Projects: CRUD operations
- Parcels: CRUD with geospatial queries
- Documents: Upload, list, retrieve

---

## Deliverables Checklist

### Week 1
- [ ] Turborepo monorepo initialized
- [ ] Next.js 14 app with TypeScript strict
- [ ] Tailwind CSS configured
- [ ] shadcn/ui initialized with components
- [ ] FastAPI app structure created
- [ ] docker-compose.yml with PostgreSQL, Redis, MinIO
- [ ] Database init script with extensions

### Week 2
- [ ] Base model with mixins
- [ ] Project model with all fields
- [ ] Land schema models (Parcel, Lease)
- [ ] Alembic configured
- [ ] Initial migration created
- [ ] RLS policies applied

### Week 3
- [ ] Async database connection
- [ ] Project CRUD API
- [ ] Parcel CRUD API with geo queries
- [ ] Document upload API
- [ ] Basic API tests
