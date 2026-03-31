# BRAND.md — NerdOptimize Design System

## Colors

```typescript
// tailwind.config.ts
colors: {
  navy:  '#1d252d',   // primary text, nav, dark backgrounds
  blue:  '#4d62a7',   // primary actions, accents, links
  light: '#dfe6ef',   // card backgrounds, borders, surfaces
  cream: '#d9d4c8',   // secondary backgrounds, alternating rows
}
```

## Typography

```html
<!-- In layout.tsx / _document -->
<link href="https://fonts.googleapis.com/css2?
  family=Poppins:wght@400;500;600&
  family=Mitr:wght@400;500&
  family=Noto+Sans+Thai:wght@400;500&
  display=swap" rel="stylesheet" />
```

- Headings (EN): Poppins 500/600
- Body text (TH): Mitr 400/500
- Body text (EN): Poppins 400
- PDF Thai body: Noto Sans Thai (for Puppeteer compatibility)

---

## Component Patterns

### Buttons
```tsx
// Primary
<Button className="bg-[#4d62a7] text-white hover:bg-[#3d5297] rounded-lg px-4 py-2">
  Generate Report
</Button>

// Secondary / outline
<Button variant="outline" className="border-[#4d62a7] text-[#4d62a7] hover:bg-[#dfe6ef]">
  Export CSV
</Button>
```

### Cards
```tsx
<div className="bg-white border border-[#dfe6ef] rounded-xl p-6 shadow-none">
  {/* content */}
</div>
```

### Metric Summary Cards (top of pages)
```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  <div className="bg-[#dfe6ef] rounded-lg p-4">
    <p className="text-xs text-[#888] font-medium uppercase tracking-wide">Total Keywords</p>
    <p className="text-2xl font-semibold text-[#1d252d] mt-1">128</p>
  </div>
</div>
```

---

## Badge Components

### Organic Position Badge
```tsx
function PositionBadge({ position }: { position: number | null }) {
  if (!position) return <span className="text-gray-400 text-sm">—</span>

  const style =
    position <= 3  ? 'bg-green-50 text-green-700 border border-green-200' :
    position <= 10 ? 'bg-blue-50 text-blue-700 border border-blue-200' :
    position <= 20 ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                     'bg-gray-50 text-gray-500 border border-gray-200'

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style}`}>
      #{position}
    </span>
  )
}
```

### Position Change Indicator
```tsx
function PositionChange({ change }: { change: number | null }) {
  if (!change) return <span className="text-gray-400">—</span>

  // Positive = moved up (improved), Negative = moved down (dropped)
  if (change > 0) return <span className="text-green-600 text-sm font-medium">▲ {change}</span>
  if (change < 0) return <span className="text-red-500 text-sm font-medium">▼ {Math.abs(change)}</span>
  return <span className="text-gray-400 text-sm">—</span>
}
```

### AI Overview Status Badge
```tsx
function AIOBadge({ present, cited, position }: {
  present: boolean
  cited: boolean
  position: number | null
}) {
  if (!present) {
    return <span className="bg-gray-50 text-gray-400 border border-gray-200 text-xs px-2 py-0.5 rounded">—</span>
  }
  if (cited) {
    return (
      <span className="bg-green-50 text-green-700 border border-green-200 text-xs px-2 py-0.5 rounded font-medium">
        Cited #{(position ?? 0) + 1}
      </span>
    )
  }
  return (
    <span className="bg-yellow-50 text-yellow-700 border border-yellow-200 text-xs px-2 py-0.5 rounded">
      AIO only
    </span>
  )
}
```

### Report Status Badge
```tsx
function ReportStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:    'bg-gray-50 text-gray-500 border-gray-200',
    processing: 'bg-blue-50 text-blue-600 border-blue-200',
    done:       'bg-green-50 text-green-700 border-green-200',
    failed:     'bg-red-50 text-red-600 border-red-200',
  }
  const labels: Record<string, string> = {
    pending: 'Pending', processing: 'Generating...', done: 'Ready', failed: 'Failed',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styles[status] ?? styles.pending}`}>
      {status === 'processing' && <span className="mr-1 animate-spin">⟳</span>}
      {labels[status] ?? status}
    </span>
  )
}
```

---

## Chart Colors (Recharts)

```typescript
// /lib/chart-colors.ts
export const CHART_COLORS = {
  primary:   '#4d62a7',   // blue — main data series
  secondary: '#1d252d',   // navy — comparison series
  positive:  '#16a34a',   // green — improvements
  negative:  '#dc2626',   // red — drops
  neutral:   '#dfe6ef',   // light — reference/background fills
  muted:     '#888780',   // gray — secondary data
}

// For multi-series charts (traffic by channel etc.)
export const SERIES_COLORS = [
  '#4d62a7',  // blue
  '#1d252d',  // navy
  '#16a34a',  // green
  '#d97706',  // amber
  '#9333ea',  // purple
]
```

### Line Chart (position history)
```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

// Note: position scale is INVERTED (lower = better, so reverse Y axis)
<ResponsiveContainer width="100%" height={200}>
  <LineChart data={data}>
    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
    <YAxis reversed domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
    <Tooltip />
    <Line
      type="monotone"
      dataKey="position"
      stroke="#4d62a7"
      strokeWidth={2}
      dot={false}
    />
  </LineChart>
</ResponsiveContainer>
```

---

## Page Layout Template

```tsx
// Dashboard page layout
export default function PageName() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1d252d]">Page Title</h1>
          <p className="text-sm text-gray-500 mt-0.5">Subtitle or description</p>
        </div>
        <Button className="bg-[#4d62a7] text-white">Primary Action</Button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* ... */}
      </div>

      {/* Main content card */}
      <div className="bg-white border border-[#dfe6ef] rounded-xl">
        {/* table, chart, etc. */}
      </div>
    </div>
  )
}
```

---

## Nav + Sidebar Colors

```
Sidebar background: #1d252d (navy)
Sidebar text: #dfe6ef (light)
Active nav item: #4d62a7 (blue) background, white text
Hover nav item: rgba(255,255,255,0.08) background
Top bar: white, bottom border #dfe6ef
```
