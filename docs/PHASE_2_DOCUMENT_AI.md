# Phase 2: Document AI Pipeline

## Overview

Build an intelligent document processing pipeline that classifies, parses, and extracts structured data from solar development documents.

## Architecture

```
packages/document-ai/
├── __init__.py
├── pipeline.py              # Main orchestrator
├── classifiers/
│   ├── __init__.py
│   └── document_classifier.py
├── parsers/
│   ├── __init__.py
│   ├── ocr.py              # Azure Document Intelligence
│   └── llama_parser.py     # LlamaParse integration
├── extractors/
│   ├── __init__.py
│   ├── base.py             # Base extractor class
│   ├── lease_extractor.py
│   ├── permit_extractor.py
│   └── study_extractor.py
├── schemas/
│   ├── __init__.py
│   ├── lease.py
│   ├── permit.py
│   └── study.py
└── utils/
    ├── __init__.py
    └── confidence.py
```

## Document Types

The system handles these document categories:

| Category | Document Types |
|----------|---------------|
| **Land** | Leases, Options, Easements, Title Reports, Surveys |
| **Interconnection** | IA Agreements, System Impact Studies, Facility Studies |
| **Permitting** | CUP Applications, Environmental Reports, Building Permits |
| **Financial** | PPAs, Tax Equity Docs, Loan Agreements |
| **Technical** | Site Plans, Equipment Specs, As-Builts |

---

## Document Classifier

### classifier/document_classifier.py

```python
from enum import Enum
from pydantic import BaseModel
from anthropic import Anthropic

class DocumentCategory(str, Enum):
    LEASE = "lease"
    OPTION = "option"
    EASEMENT = "easement"
    TITLE_REPORT = "title_report"
    SURVEY = "survey"
    INTERCONNECTION_AGREEMENT = "interconnection_agreement"
    SYSTEM_IMPACT_STUDY = "system_impact_study"
    FACILITY_STUDY = "facility_study"
    CUP_APPLICATION = "cup_application"
    ENVIRONMENTAL_REPORT = "environmental_report"
    PPA = "ppa"
    UNKNOWN = "unknown"

class ClassificationResult(BaseModel):
    category: DocumentCategory
    confidence: float
    reasoning: str
    suggested_extractors: list[str]

class DocumentClassifier:
    def __init__(self, client: Anthropic):
        self.client = client

    async def classify(
        self,
        text: str,
        filename: str | None = None
    ) -> ClassificationResult:
        """
        Classify a document based on its content.
        Uses Claude for intelligent classification with reasoning.
        """
        prompt = f"""Analyze this document and classify it into one of these categories:

Categories:
- lease: Land lease agreements for solar projects
- option: Option to lease or purchase agreements
- easement: Easement agreements (access, transmission, etc.)
- title_report: Title reports and commitments
- survey: Land surveys and ALTA surveys
- interconnection_agreement: Utility interconnection agreements
- system_impact_study: Grid system impact studies
- facility_study: Facility studies from utilities
- cup_application: Conditional use permit applications
- environmental_report: Environmental impact reports
- ppa: Power purchase agreements
- unknown: Cannot determine document type

Filename: {filename or 'Unknown'}

Document text (first 5000 chars):
{text[:5000]}

Respond with JSON:
{{
    "category": "category_name",
    "confidence": 0.0-1.0,
    "reasoning": "explanation",
    "suggested_extractors": ["extractor1", "extractor2"]
}}
"""
        response = await self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}]
        )

        # Parse response and return ClassificationResult
        ...
```

---

## Document Parsing

### parsers/ocr.py (Azure Document Intelligence)

```python
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.core.credentials import AzureKeyCredential
from pydantic import BaseModel

class OCRResult(BaseModel):
    text: str
    pages: list[dict]
    tables: list[dict]
    confidence: float

class AzureOCRParser:
    def __init__(self, endpoint: str, key: str):
        self.client = DocumentIntelligenceClient(
            endpoint=endpoint,
            credential=AzureKeyCredential(key)
        )

    async def parse(self, file_bytes: bytes) -> OCRResult:
        """
        Parse document using Azure Document Intelligence.
        Extracts text, tables, and structural information.
        """
        poller = self.client.begin_analyze_document(
            "prebuilt-layout",
            file_bytes
        )
        result = poller.result()

        return OCRResult(
            text=result.content,
            pages=[self._process_page(p) for p in result.pages],
            tables=[self._process_table(t) for t in result.tables],
            confidence=self._calculate_confidence(result)
        )
```

### parsers/llama_parser.py (LlamaParse Integration)

```python
from llama_parse import LlamaParse
from pydantic import BaseModel

class LlamaParseResult(BaseModel):
    markdown: str
    text: str
    metadata: dict

class LlamaParseParser:
    def __init__(self, api_key: str):
        self.parser = LlamaParse(
            api_key=api_key,
            result_type="markdown",
            num_workers=4,
            verbose=False,
            language="en"
        )

    async def parse(self, file_path: str) -> LlamaParseResult:
        """
        Parse document using LlamaParse.
        Better for complex PDFs with mixed content.
        """
        documents = await self.parser.aload_data(file_path)

        return LlamaParseResult(
            markdown=documents[0].text,
            text=documents[0].text,
            metadata=documents[0].metadata
        )
```

---

## Lease Extraction

### schemas/lease.py

```python
from pydantic import BaseModel, Field
from datetime import date
from enum import Enum

class PartyType(str, Enum):
    INDIVIDUAL = "individual"
    CORPORATION = "corporation"
    LLC = "llc"
    TRUST = "trust"
    PARTNERSHIP = "partnership"
    GOVERNMENT = "government"

class Party(BaseModel):
    name: str
    entity_type: PartyType | None = None
    address: str | None = None
    state_of_formation: str | None = None

class RentStructure(BaseModel):
    base_rent_per_acre: float | None = None
    annual_escalation_percent: float | None = None
    escalation_start_year: int | None = None
    minimum_annual_rent: float | None = None
    signing_bonus: float | None = None
    signing_bonus_per_acre: float | None = None

class ExtensionOption(BaseModel):
    term_years: int
    notice_days: int
    rent_adjustment: str | None = None

class PurchaseOption(BaseModel):
    exists: bool = False
    price_formula: str | None = None
    notice_period_days: int | None = None
    conditions: list[str] = []

class TerminationProvision(BaseModel):
    party: str  # "lessor", "lessee", "either"
    conditions: list[str]
    notice_days: int | None = None
    penalties: str | None = None

class LeaseExtraction(BaseModel):
    """Complete lease extraction schema."""

    # Document info
    document_date: date | None = None
    effective_date: date | None = None
    execution_date: date | None = None

    # Parties
    lessor: Party
    lessee: Party

    # Property
    property_description: str | None = None
    county: str | None = None
    state: str | None = None
    parcel_numbers: list[str] = []
    total_acres: float | None = None

    # Term
    initial_term_years: int | None = None
    commencement_date: date | None = None
    expiration_date: date | None = None

    # Rent
    rent: RentStructure = Field(default_factory=RentStructure)

    # Options
    extension_options: list[ExtensionOption] = []
    purchase_option: PurchaseOption = Field(default_factory=PurchaseOption)

    # Use rights
    permitted_uses: list[str] = []
    exclusive_use: bool = False
    sublease_allowed: bool = False

    # Termination
    termination_provisions: list[TerminationProvision] = []

    # Other
    insurance_requirements: str | None = None
    indemnification: str | None = None
    confidentiality: bool = False

    # Extraction metadata
    extraction_confidence: float = Field(ge=0.0, le=1.0)
    low_confidence_fields: list[str] = []
    requires_review: bool = False
    review_reasons: list[str] = []
```

### extractors/lease_extractor.py

```python
from anthropic import Anthropic
from ..schemas.lease import LeaseExtraction

class LeaseExtractor:
    def __init__(self, client: Anthropic):
        self.client = client

    async def extract(self, document_text: str) -> LeaseExtraction:
        """
        Extract structured lease data using Claude.
        """
        response = await self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": f"""Extract all lease terms from this document into structured JSON.

CRITICAL INSTRUCTIONS:
1. Extract ONLY information explicitly stated in the document
2. Use null for fields not found in the document
3. Set extraction_confidence based on clarity of the text
4. Add field names to low_confidence_fields if uncertain
5. Set requires_review=true if confidence < 0.9 for critical fields
6. Critical fields: parties, term, rent, property description

Document:
{document_text}

Return a JSON object matching this schema:
{LeaseExtraction.model_json_schema()}
"""
                }
            ],
            response_format={"type": "json_object"}
        )

        data = json.loads(response.content[0].text)
        extraction = LeaseExtraction(**data)

        # Apply confidence rules
        extraction = self._apply_confidence_rules(extraction)

        return extraction

    def _apply_confidence_rules(self, extraction: LeaseExtraction) -> LeaseExtraction:
        """
        Apply business rules for review requirements.
        """
        review_reasons = []

        # Always require legal review for leases
        review_reasons.append("Legal document requires attorney review")

        # Check confidence thresholds
        if extraction.extraction_confidence < 0.9:
            review_reasons.append(f"Overall confidence {extraction.extraction_confidence:.0%} below threshold")

        # Check critical field presence
        if not extraction.rent.base_rent_per_acre:
            review_reasons.append("Rent structure unclear")

        if not extraction.initial_term_years:
            review_reasons.append("Lease term not clearly identified")

        extraction.requires_review = True  # Always for legal docs
        extraction.review_reasons = review_reasons

        return extraction
```

---

## Pipeline Orchestrator

### pipeline.py

```python
from dataclasses import dataclass
from enum import Enum
from .classifiers.document_classifier import DocumentClassifier, DocumentCategory
from .parsers.ocr import AzureOCRParser
from .parsers.llama_parser import LlamaParseParser
from .extractors.lease_extractor import LeaseExtractor

class ProcessingStatus(str, Enum):
    PENDING = "pending"
    PARSING = "parsing"
    CLASSIFYING = "classifying"
    EXTRACTING = "extracting"
    REVIEW_REQUIRED = "review_required"
    COMPLETED = "completed"
    FAILED = "failed"

@dataclass
class ProcessingResult:
    document_id: str
    status: ProcessingStatus
    category: DocumentCategory | None
    extraction: dict | None
    confidence: float
    requires_review: bool
    review_reasons: list[str]
    error: str | None = None

class DocumentPipeline:
    def __init__(
        self,
        anthropic_client,
        azure_endpoint: str,
        azure_key: str,
        llama_api_key: str
    ):
        self.classifier = DocumentClassifier(anthropic_client)
        self.ocr_parser = AzureOCRParser(azure_endpoint, azure_key)
        self.llama_parser = LlamaParseParser(llama_api_key)
        self.lease_extractor = LeaseExtractor(anthropic_client)
        # Add more extractors as needed

    async def process(
        self,
        file_bytes: bytes,
        filename: str,
        document_id: str
    ) -> ProcessingResult:
        """
        Process a document through the full pipeline.
        """
        try:
            # Step 1: Parse document
            ocr_result = await self.ocr_parser.parse(file_bytes)

            # Step 2: Classify document
            classification = await self.classifier.classify(
                ocr_result.text,
                filename
            )

            # Step 3: Extract based on category
            extraction = None
            if classification.category == DocumentCategory.LEASE:
                extraction = await self.lease_extractor.extract(ocr_result.text)
                extraction_dict = extraction.model_dump()
                requires_review = extraction.requires_review
                review_reasons = extraction.review_reasons
                confidence = extraction.extraction_confidence
            else:
                # Handle other document types
                extraction_dict = {}
                requires_review = True
                review_reasons = ["Extractor not yet implemented for this document type"]
                confidence = classification.confidence

            return ProcessingResult(
                document_id=document_id,
                status=ProcessingStatus.REVIEW_REQUIRED if requires_review else ProcessingStatus.COMPLETED,
                category=classification.category,
                extraction=extraction_dict,
                confidence=confidence,
                requires_review=requires_review,
                review_reasons=review_reasons
            )

        except Exception as e:
            return ProcessingResult(
                document_id=document_id,
                status=ProcessingStatus.FAILED,
                category=None,
                extraction=None,
                confidence=0.0,
                requires_review=True,
                review_reasons=["Processing failed"],
                error=str(e)
            )
```

---

## Confidence Scoring

### utils/confidence.py

```python
from dataclasses import dataclass

@dataclass
class ConfidenceConfig:
    """Configuration for confidence scoring."""
    high_threshold: float = 0.95
    medium_threshold: float = 0.85
    low_threshold: float = 0.70
    auto_approve_threshold: float = 0.90  # NEVER auto-approve legal docs

def calculate_extraction_confidence(
    fields_extracted: int,
    fields_expected: int,
    field_confidences: list[float],
    critical_fields_found: list[bool]
) -> float:
    """
    Calculate overall extraction confidence.

    Factors:
    - Coverage: fields_extracted / fields_expected
    - Average field confidence
    - Critical field penalty if any missing
    """
    if fields_expected == 0:
        return 0.0

    coverage = fields_extracted / fields_expected
    avg_confidence = sum(field_confidences) / len(field_confidences) if field_confidences else 0.0
    critical_penalty = 0.0 if all(critical_fields_found) else 0.2

    confidence = (coverage * 0.3 + avg_confidence * 0.5) - critical_penalty
    return max(0.0, min(1.0, confidence))
```

---

## Deliverables Checklist

- [ ] Document classifier with category routing
- [ ] Azure Document Intelligence OCR integration
- [ ] LlamaParse integration for complex PDFs
- [ ] LeaseExtraction schema with all fields
- [ ] Lease extractor with Claude structured output
- [ ] Confidence scoring system
- [ ] Pipeline orchestrator
- [ ] HITL review flagging (confidence < 90%)
- [ ] Legal document auto-flagging for review
- [ ] Unit tests for extractors
- [ ] Integration tests for pipeline

## Critical HITL Requirements

**ALWAYS require human review for:**
1. All legal documents (leases, contracts, easements)
2. Any extraction with confidence < 90%
3. Documents with missing critical fields
4. New document types not yet supported

**NEVER auto-approve:**
1. Financial terms in any document
2. Legal commitments or obligations
3. Party information extraction
