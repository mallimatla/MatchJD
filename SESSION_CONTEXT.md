# Session Context - Neurogrid Admin Portal Enhancements

## Last Updated: January 15, 2026

## Current Branch
```
claude/setup-claude-prompts-GQT6K
```

## Summary of Completed Work

### 1. Workflow Builder UX Improvements
- Fixed connection lines/arrows not appearing between nodes
- Widened left sidebar (w-72) and right sidebar (w-96) for better text display
- Added visual feedback for connection mode
- Fixed SVG pointer-events for clickable connections
- Hide admin sidebar when editing workflow for full-screen canvas

### 2. Admin Workflows → User App Connection
- Updated `WorkflowStatus.tsx` to load workflow definitions from Firestore (`config/workflows`)
- Created `convertAdminWorkflow()` function to transform admin node-based config to step-based UI
- Admin-defined workflows now appear in user's project Workflows tab

### 3. Document Display - Made Dynamic and Powerful (MAIN WORK)

#### Admin Portal (`/admin` → Document Display section):
- **Full CRUD for document type categories** - create, edit, delete
- **Dynamic field management** - add/edit/delete extraction fields per category
- Each field has: Label, JSON Path (dot notation), Display Type, Visibility toggle
- Changes save to Firestore `config/documentDisplay` and auto-sync to user app

#### User App - New Component Created:
**File: `/src/components/DocumentDataDisplay.tsx`**

Key features:
- `DocumentDataDisplay` - Full display component with variants: 'full', 'compact', 'card'
- `CompactDocumentPreview` - Inline preview for compact display
- `useAllDocumentDisplayConfigs()` - Hook to get all configs and category labels
- `extractValue()` - Smart value extractor that tries multiple paths
- `getNestedValue()` - Handles nested objects, extracts .name/.value automatically
- **Fallback display** - If configured paths don't match data, shows flattened raw extraction results

#### ReviewQueue Updated:
- Replaced hardcoded `LeaseDataDisplay`, `PPADataDisplay`, `EasementDataDisplay` with dynamic `DocumentDataDisplay`
- Uses `CompactDocumentPreview` for inline preview
- `getCategoryLabel` now comes from dynamic config

---

## Key Files Modified

### 1. `/src/app/admin/page.tsx`
- Enhanced Document Display section (lines ~1080-1330)
- Full CRUD for document categories and fields
- Category settings: Display Name, Category ID
- Field settings: Label, JSON Path, Display Type, Visibility
- Fixed TypeScript Set iteration issue (line ~1100)

### 2. `/src/components/DocumentDataDisplay.tsx` (NEW FILE)
- Complete dynamic document display component
- Smart value extraction with fallbacks
- Flattens nested objects for raw data display
- Real-time Firestore config loading

### 3. `/src/components/ReviewQueue.tsx`
- Removed hardcoded display components (LeaseDataDisplay, PPADataDisplay, etc.)
- Added import: `import { DocumentDataDisplay, CompactDocumentPreview, useAllDocumentDisplayConfigs } from './DocumentDataDisplay';`
- Uses `useAllDocumentDisplayConfigs()` hook for `getCategoryLabel`
- `renderExtractedData()` now uses `<DocumentDataDisplay category={category} data={data} variant="full" />`
- Preview uses `<CompactDocumentPreview category={category} data={...} />`

### 4. `/src/components/WorkflowStatus.tsx`
- Added Firestore config loading from `config/workflows`
- `convertAdminWorkflow()` function for admin → user format conversion
- Dynamically shows all enabled admin workflows

### 5. `/src/components/admin/WorkflowBuilder.tsx`
- Fixed node connection functionality
- Improved visual feedback and UX
- Better event handling for connections

---

## Firestore Config Structure

### `config/documentDisplay`
```javascript
{
  configs: [
    {
      category: 'lease',
      label: 'Land Lease',
      fields: [
        { path: 'lessor.name', label: 'Lessor', type: 'text', visible: true, order: 1 },
        { path: 'totalAcres', label: 'Total Acres', type: 'number', visible: true, order: 2 },
        // ... more fields
      ]
    },
    {
      category: 'ppa',
      label: 'Power Purchase Agreement',
      fields: [
        { path: 'seller', label: 'Seller', type: 'text', visible: true, order: 1 },
        { path: 'buyer', label: 'Buyer', type: 'text', visible: true, order: 2 },
        { path: 'contractCapacity', label: 'Capacity (MW)', type: 'number', visible: true, order: 3 },
        // ... more fields
      ]
    }
  ],
  updatedAt: Timestamp
}
```

### `config/workflows`
```javascript
{
  configs: [
    {
      id: 'document_processing',
      name: 'Document Processing',
      enabled: true,
      description: '...',
      nodes: [...],
      connections: [...],
      steps: [...]
    }
  ],
  updatedAt: Timestamp
}
```

---

## Current Issue / Next Steps

The Document Display is now working but has a known limitation:

**When AI extraction produces data with different field paths than configured:**
- The component shows a fallback view with raw extracted data
- It flattens nested objects and displays them individually
- Shows amber warning: "Configured field paths don't match extracted data"

**To improve:**
1. Admin could update field paths in Document Display config to match actual AI extraction output
2. Or enhance AI extraction to output data in expected format
3. The `extractValue()` function already tries multiple path variations automatically

---

## Git Commits Made This Session

1. `Make Document Display admin section dynamic and powerful`
2. `Improve DocumentDataDisplay to handle various data structures`
3. `Fix raw data display to flatten nested objects properly`

All pushed to branch: `claude/setup-claude-prompts-GQT6K`

---

## How to Continue

1. **Check current status:**
   ```bash
   git status
   git log --oneline -5
   ```

2. **If user reports display issues:**
   - Check the field paths in admin Document Display config
   - Compare with actual extracted data structure in Firestore documents
   - The `extractValue()` function in DocumentDataDisplay.tsx handles path variations

3. **To add new document types:**
   - Go to Admin Portal → Document Display
   - Click "Add Document Type"
   - Set category ID (used in code) and display name
   - Add fields with correct JSON paths matching AI extraction output

4. **Key files to review:**
   - `/src/components/DocumentDataDisplay.tsx` - Main display component
   - `/src/app/admin/page.tsx` - Admin config UI (Document Display section ~line 1080)
   - `/src/components/ReviewQueue.tsx` - Uses the dynamic display

---

## Tech Stack Reference

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Firebase (Firestore, Storage, Auth, Cloud Functions)
- **State:** React hooks + Firestore real-time listeners
- **AI:** Claude API for document extraction

## Important Patterns

1. **Config loading pattern:**
   ```typescript
   useEffect(() => {
     const unsubscribe = onSnapshot(
       doc(firebaseDb, 'config', 'documentDisplay'),
       (snapshot) => {
         if (snapshot.exists()) {
           const configs = snapshot.data().configs;
           // use configs
         }
       }
     );
     return () => unsubscribe();
   }, []);
   ```

2. **Smart value extraction:**
   ```typescript
   // extractValue tries: exact path → path.name → path.value → special cases
   const value = extractValue(data, field.path);
   ```

3. **Nested object flattening for display:**
   ```typescript
   Object.entries(data).forEach(([key, value]) => {
     if (typeof value === 'object' && !Array.isArray(value)) {
       Object.entries(value).forEach(([nestedKey, nestedValue]) => {
         flattenedEntries.push({ key: `${key}.${nestedKey}`, value: nestedValue, label: nestedLabel });
       });
     }
   });
   ```
