# /add-keyword — Add Tracked Keywords to a Project

## What this command does
Generates all code needed to add keywords to a client project:
API route, form component, and Supabase insert with validation.

## When to use
User says: "add keywords to project", "track new keywords", "เพิ่ม keyword"

## Steps Claude should follow

1. Ask which project (show list from projects table if needed)
2. Accept keyword list (comma-separated or newline)
3. Confirm settings:
   - country_code (default: TH)
   - language_code (default: th)
   - device (default: desktop — offer both desktop+mobile as option)
   - tag (optional — e.g. "brand", "service", "competitor")

## Code to generate

### API Route
```typescript
// POST /api/projects/[projectId]/keywords
// Validates org ownership, checks keyword limit, bulk inserts
```

### Form Component
```tsx
// /components/rank-tracker/AddKeywordsDialog.tsx
// Dialog with textarea (one keyword per line), tag selector, device selector
// Shows current usage vs plan limit
// Uses brand colors from BRAND.md
```

### Supabase Insert
```typescript
// Bulk insert with organization_id from session
// Check keyword_limit: SELECT COUNT(*) FROM tracked_keywords WHERE org_id = ?
// If over limit → return 403 with upgrade message
```

## Validation Rules
- Max keywords per insert: 500 at once
- Trim whitespace, remove duplicates, lowercase
- Check plan limit before inserting (use usage_logs or COUNT query)
- Return { added: N, duplicates: N, overLimit: boolean }
