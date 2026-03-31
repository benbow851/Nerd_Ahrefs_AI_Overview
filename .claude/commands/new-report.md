# /new-report — Generate SEO Report for a Project

## What this command does
Generates all code needed to trigger + monitor a report generation job.

## When to use
User says: "generate report", "สร้าง report", "new report for client X"

## Steps Claude should follow

1. Show date range picker (default: last calendar month)
2. Show white-label preview (agency name + logo from white_label_config)
3. On submit: POST /api/reports/generate → returns jobId
4. Show real-time status using Supabase Realtime
5. When done: show download button with signed URL

## Code to generate

### Dialog Component
```tsx
// /components/reports/NewReportDialog.tsx
// Date range picker (shadcn DateRangePicker)
// White-label preview card
// Submit button → calls API → shows inline status
```

### API Route
```typescript
// /app/api/reports/generate/route.ts
// Already defined in JOBS.md — reference that pattern
// Returns: { jobId, triggerId }
```

### Status Component (Realtime)
```tsx
// /components/reports/ReportStatusCard.tsx
// Shows: Pending → Generating... (with spinner) → Ready (download button)
// Subscribes to Supabase Realtime on report_jobs table
// Cleanup subscription on unmount
// Uses ReportStatusBadge from BRAND.md
```

### Report List Page
```tsx
// /app/dashboard/[projectId]/reports/page.tsx
// Table: date range | status badge | created | download
// "New Report" button top-right
// Sort by created_at DESC
```

## Status Flow
pending → processing → done (show download)
                    ↘ failed (show error + retry button)
