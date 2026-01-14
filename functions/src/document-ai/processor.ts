import Anthropic from '@anthropic-ai/sdk';
import * as admin from 'firebase-admin';

// Document categories
type DocumentCategory =
  | 'lease'
  | 'option'
  | 'easement'
  | 'title_report'
  | 'survey'
  | 'interconnection_agreement'
  | 'system_impact_study'
  | 'facility_study'
  | 'cup_application'
  | 'environmental_report'
  | 'ppa'
  | 'unknown';

interface ProcessingResult {
  category: DocumentCategory;
  extractedData: Record<string, any>;
  confidence: number;
  requiresReview: boolean;
  reviewReasons: string[];
}

interface LeaseExtraction {
  documentDate: string | null;
  effectiveDate: string | null;
  lessor: {
    name: string;
    entityType: string | null;
    address: string | null;
  };
  lessee: {
    name: string;
    entityType: string | null;
    address: string | null;
  };
  propertyDescription: string | null;
  county: string | null;
  state: string | null;
  parcelNumbers: string[];
  totalAcres: number | null;
  initialTermYears: number | null;
  commencementDate: string | null;
  expirationDate: string | null;
  rent: {
    baseRentPerAcre: number | null;
    annualEscalationPercent: number | null;
    signingBonus: number | null;
  };
  extensionOptions: Array<{
    termYears: number;
    noticeDays: number;
  }>;
  purchaseOption: {
    exists: boolean;
    priceFormula: string | null;
  };
  permittedUses: string[];
  terminationProvisions: string[];
}

export class DocumentProcessor {
  private anthropic: Anthropic;
  private storage = admin.storage();

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Main processing pipeline
   */
  async process(documentId: string, storageUrl: string): Promise<ProcessingResult> {
    // Step 1: Download and parse document
    const documentText = await this.extractText(storageUrl);

    // Step 2: Classify document
    const classification = await this.classifyDocument(documentText);

    // Step 3: Extract data based on classification
    let extractedData: Record<string, any> = {};
    if (classification.category === 'lease') {
      extractedData = await this.extractLeaseData(documentText);
    } else if (classification.category === 'ppa') {
      extractedData = await this.extractPPAData(documentText);
    } else {
      extractedData = await this.extractGenericData(documentText, classification.category);
    }

    // Step 4: Calculate confidence and determine if review needed
    const confidence = this.calculateConfidence(extractedData, classification);
    const { requiresReview, reviewReasons } = this.determineReviewRequirements(
      classification.category,
      confidence,
      extractedData
    );

    return {
      category: classification.category,
      extractedData,
      confidence,
      requiresReview,
      reviewReasons,
    };
  }

  /**
   * Extract text from document (simplified - in production use Azure Doc Intelligence)
   */
  private async extractText(storageUrl: string): Promise<string> {
    // Download file from Firebase Storage
    const bucket = this.storage.bucket();
    const urlPath = new URL(storageUrl).pathname;
    const filePath = decodeURIComponent(urlPath.split('/o/')[1]?.split('?')[0] || '');

    const [buffer] = await bucket.file(filePath).download();
    const lowerPath = filePath.toLowerCase();

    // For PDF files, use pdf-parse
    if (lowerPath.endsWith('.pdf')) {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return data.text;
    }

    // For DOCX files, use mammoth
    if (lowerPath.endsWith('.docx')) {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer: buffer });
      return result.value;
    }

    // For DOC files (legacy Word format) - attempt basic extraction
    if (lowerPath.endsWith('.doc')) {
      // DOC files are binary - mammoth doesn't support them well
      // Try to extract any readable text content
      const text = buffer.toString('utf-8');
      // Filter out non-printable characters but keep the readable parts
      const cleanText = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleanText.length > 100) {
        return cleanText;
      }
      // If we couldn't extract meaningful text, return error message
      return 'Error: Unable to extract text from legacy .doc format. Please convert to .docx or .pdf';
    }

    // For text files (.txt, etc.)
    return buffer.toString('utf-8');
  }

  /**
   * Classify document type using Claude
   */
  private async classifyDocument(
    text: string
  ): Promise<{ category: DocumentCategory; confidence: number }> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Analyze this document and classify it into one of these categories:

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

Document text (first 5000 characters):
${text.slice(0, 5000)}

Respond with JSON only:
{
  "category": "category_name",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`,
        },
      ],
    });

    try {
      const content = response.content[0];
      if (content.type === 'text') {
        const result = JSON.parse(content.text);
        return {
          category: result.category as DocumentCategory,
          confidence: result.confidence,
        };
      }
    } catch (error) {
      console.error('Error parsing classification:', error);
    }

    return { category: 'unknown', confidence: 0 };
  }

  /**
   * Extract lease-specific data using Claude
   */
  private async extractLeaseData(text: string): Promise<LeaseExtraction> {
    const schema = `{
      "documentDate": "YYYY-MM-DD or null",
      "effectiveDate": "YYYY-MM-DD or null",
      "lessor": {
        "name": "string",
        "entityType": "individual|corporation|llc|trust|partnership|government|null",
        "address": "string or null"
      },
      "lessee": {
        "name": "string",
        "entityType": "string or null",
        "address": "string or null"
      },
      "propertyDescription": "string or null",
      "county": "string or null",
      "state": "two-letter code or null",
      "parcelNumbers": ["string array"],
      "totalAcres": number or null,
      "initialTermYears": number or null,
      "commencementDate": "YYYY-MM-DD or null",
      "expirationDate": "YYYY-MM-DD or null",
      "rent": {
        "baseRentPerAcre": number or null,
        "annualEscalationPercent": number or null,
        "signingBonus": number or null
      },
      "extensionOptions": [{"termYears": number, "noticeDays": number}],
      "purchaseOption": {
        "exists": boolean,
        "priceFormula": "string or null"
      },
      "permittedUses": ["string array"],
      "terminationProvisions": ["string array"]
    }`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Extract all lease terms from this document into structured JSON.

CRITICAL INSTRUCTIONS:
1. Extract ONLY information explicitly stated in the document
2. Use null for fields not found in the document
3. Be precise with dates and numbers
4. For parcel numbers, extract all APNs mentioned

Document:
${text}

Return a JSON object matching this schema:
${schema}

Return only valid JSON, no explanation.`,
        },
      ],
    });

    try {
      const content = response.content[0];
      if (content.type === 'text') {
        // Clean the response - remove markdown code blocks if present
        let jsonText = content.text.trim();
        if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```$/g, '');
        }
        return JSON.parse(jsonText);
      }
    } catch (error) {
      console.error('Error parsing lease extraction:', error);
    }

    // Return empty extraction if parsing fails
    return {
      documentDate: null,
      effectiveDate: null,
      lessor: { name: '', entityType: null, address: null },
      lessee: { name: '', entityType: null, address: null },
      propertyDescription: null,
      county: null,
      state: null,
      parcelNumbers: [],
      totalAcres: null,
      initialTermYears: null,
      commencementDate: null,
      expirationDate: null,
      rent: { baseRentPerAcre: null, annualEscalationPercent: null, signingBonus: null },
      extensionOptions: [],
      purchaseOption: { exists: false, priceFormula: null },
      permittedUses: [],
      terminationProvisions: [],
    };
  }

  /**
   * Extract PPA-specific data
   */
  private async extractPPAData(text: string): Promise<Record<string, any>> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Extract Power Purchase Agreement terms from this document.

Extract:
- Parties (buyer, seller)
- Contract capacity (MW)
- Price structure ($/MWh, escalation)
- Delivery point
- Term start and end dates
- Commercial operation date requirements
- Curtailment provisions
- Performance guarantees
- Termination provisions

Document:
${text}

Return only valid JSON.`,
        },
      ],
    });

    try {
      const content = response.content[0];
      if (content.type === 'text') {
        let jsonText = content.text.trim();
        if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```$/g, '');
        }
        return JSON.parse(jsonText);
      }
    } catch (error) {
      console.error('Error parsing PPA extraction:', error);
    }

    return {};
  }

  /**
   * Generic data extraction for other document types
   */
  private async extractGenericData(
    text: string,
    category: DocumentCategory
  ): Promise<Record<string, any>> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Extract key information from this ${category.replace('_', ' ')} document.

Document:
${text.slice(0, 10000)}

Return a JSON object with the most relevant extracted fields for this document type.
Include: dates, parties involved, key terms, locations, and any critical numbers or requirements.`,
        },
      ],
    });

    try {
      const content = response.content[0];
      if (content.type === 'text') {
        let jsonText = content.text.trim();
        if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```$/g, '');
        }
        return JSON.parse(jsonText);
      }
    } catch (error) {
      console.error('Error parsing generic extraction:', error);
    }

    return {};
  }

  /**
   * Calculate overall extraction confidence
   */
  private calculateConfidence(
    extractedData: Record<string, any>,
    classification: { category: DocumentCategory; confidence: number }
  ): number {
    // Start with classification confidence
    let confidence = classification.confidence;

    // Adjust based on extracted data completeness
    const criticalFields = this.getCriticalFields(classification.category);
    let foundCritical = 0;

    for (const field of criticalFields) {
      const value = this.getNestedValue(extractedData, field);
      if (value !== null && value !== undefined && value !== '') {
        foundCritical++;
      }
    }

    const criticalConfidence = criticalFields.length > 0
      ? foundCritical / criticalFields.length
      : 1;

    // Weight: 40% classification, 60% extraction
    confidence = classification.confidence * 0.4 + criticalConfidence * 0.6;

    return Math.round(confidence * 100) / 100;
  }

  /**
   * Get critical fields for a document type
   */
  private getCriticalFields(category: DocumentCategory): string[] {
    const fields: Record<DocumentCategory, string[]> = {
      lease: ['lessor.name', 'lessee.name', 'totalAcres', 'initialTermYears', 'rent.baseRentPerAcre'],
      ppa: ['buyer', 'seller', 'contractCapacity', 'price', 'term'],
      option: ['grantor', 'grantee', 'optionPeriod', 'purchasePrice'],
      easement: ['grantor', 'grantee', 'purpose', 'location'],
      title_report: ['effectiveDate', 'owner', 'legalDescription'],
      survey: ['surveyor', 'date', 'acreage', 'legalDescription'],
      interconnection_agreement: ['utility', 'developer', 'capacity', 'poi'],
      system_impact_study: ['utility', 'capacity', 'networkUpgrades'],
      facility_study: ['utility', 'capacity', 'estimatedCost'],
      cup_application: ['applicant', 'projectName', 'location', 'capacity'],
      environmental_report: ['preparer', 'date', 'findings'],
      unknown: [],
    };

    return fields[category] || [];
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Determine if human review is required
   */
  private determineReviewRequirements(
    category: DocumentCategory,
    confidence: number,
    extractedData: Record<string, any>
  ): { requiresReview: boolean; reviewReasons: string[] } {
    const reviewReasons: string[] = [];

    // CRITICAL: Legal documents ALWAYS require review
    const legalDocuments: DocumentCategory[] = ['lease', 'option', 'easement', 'ppa'];
    if (legalDocuments.includes(category)) {
      reviewReasons.push('Legal document requires attorney review');
    }

    // Low confidence threshold
    if (confidence < 0.9) {
      reviewReasons.push(`Extraction confidence (${Math.round(confidence * 100)}%) below 90% threshold`);
    }

    // Very low confidence
    if (confidence < 0.7) {
      reviewReasons.push('Critical: Very low extraction confidence');
    }

    // Missing critical fields
    const criticalFields = this.getCriticalFields(category);
    const missingFields: string[] = [];
    for (const field of criticalFields) {
      const value = this.getNestedValue(extractedData, field);
      if (value === null || value === undefined || value === '') {
        missingFields.push(field);
      }
    }
    if (missingFields.length > 0) {
      reviewReasons.push(`Missing critical fields: ${missingFields.join(', ')}`);
    }

    // Financial thresholds in extracted data
    if (extractedData.rent?.signingBonus && extractedData.rent.signingBonus > 10000) {
      reviewReasons.push('Financial commitment > $10,000 requires approval');
    }

    return {
      requiresReview: reviewReasons.length > 0,
      reviewReasons,
    };
  }
}
