# Test Documents for HITL Workflow

These sample documents are designed to test the AI document processing and HITL (Human-in-the-Loop) workflows.

## Documents Included

### 1. sample-lease-agreement.txt
**Type:** Solar Land Lease Agreement
**Expected AI Classification:** `lease`
**Expected HITL Trigger:** YES (legal document always requires review)

**Key Terms AI Should Extract:**
- Lessor: John Smith and Mary Smith
- Lessee: SunPower Solar Development LLC
- Total Acres: 320 acres
- Parcel Numbers: APN 123-456-789, APN 123-456-790
- Initial Term: 25 years
- Base Rent: $1,200/acre ($384,000/year)
- Annual Escalation: 2%
- Signing Bonus: $50,000
- Extension Options: 3 x 5-year extensions

---

### 2. sample-ppa.txt
**Type:** Power Purchase Agreement
**Expected AI Classification:** `ppa`
**Expected HITL Trigger:** YES (legal document always requires review)

**Key Terms AI Should Extract:**
- Seller: Midwest Solar Farm LLC
- Buyer: Central Illinois Electric Cooperative
- Contract Capacity: 100 MW AC
- Contract Price: $35.00/MWh
- Annual Escalation: 1.5%
- Term: 20 years
- Expected COD: January 1, 2028
- Minimum Generation: 157,500 MWh/year

---

### 3. sample-easement.txt
**Type:** Easement Agreement
**Expected AI Classification:** `easement`
**Expected HITL Trigger:** YES (legal document always requires review)

**Key Terms AI Should Extract:**
- Grantor: James Wilson
- Grantee: Springfield Solar Transmission LLC
- Easement Width: 50 feet
- Easement Length: ~2,500 linear feet
- Initial Payment: $25,000
- Annual Payment: $500
- Purpose: Transmission lines up to 138 kV

---

## How to Test

1. Convert these .txt files to PDF (use any text-to-PDF converter)
2. Upload to your Neurogrid project
3. Wait for AI processing (10-30 seconds)
4. Check the document status - should be "review_required"
5. Go to Dashboard > Review Queue
6. See the HITL request with extracted data
7. Approve or Reject the document

## Expected Behavior

| Document | Classification | Confidence | HITL Triggered | Review Reasons |
|----------|---------------|------------|----------------|----------------|
| Lease | `lease` | 85-95% | YES | "Legal document requires attorney review" |
| PPA | `ppa` | 85-95% | YES | "Legal document requires attorney review" |
| Easement | `easement` | 85-95% | YES | "Legal document requires attorney review" |
