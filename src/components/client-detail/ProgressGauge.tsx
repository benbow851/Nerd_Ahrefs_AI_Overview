interface ProgressGaugeProps {
  citations: number
  target: number
  label?: string
}

// ── Colour mapping based on completion % ──────────────────────────────────────
function gaugeColor(pct: number): string {
  if (pct >= 100) return '#44a2a5' // teal — status-success
  if (pct >= 60) return '#4d62a7'  // blue
  if (pct >= 30) return '#f7991a'  // amber — status-warning
  return '#bf415c'                  // red — status-danger
}

// ── SVG arc helpers ────────────────────────────────────────────────────────────
// The semicircle spans 180° from the left (180°) to the right (0°) going
// counter-clockwise when drawn, but we use a standard SVG arc so we'll draw
// from −180° to 0° (i.e., left-to-right across the top of a circle).
//
// We render in a 140×80 viewport.
// Centre: (70, 75) so the full arc sits nicely with a small bottom margin.
// Radius: 58px

const CX = 70
const CY = 75
const R  = 54
const STROKE_W = 10

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

/** Build a large-arc SVG path descriptor for a portion of a circle.
 *  startAngle / endAngle are in degrees (0 = top, clockwise).
 */
function arcPath(
  cx: number,
  cy: number,
  r: number,
  startAngleDeg: number,
  endAngleDeg: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngleDeg)
  const end   = polarToCartesian(cx, cy, r, startAngleDeg)
  const largeArc = endAngleDeg - startAngleDeg > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`
}

// The semicircle goes from 270° (left) to 90° (right), spanning 180°.
const TRACK_START = 270  // left tip
const TRACK_END   = 90   // right tip  (270 → 90 clockwise = 180°)

export default function ProgressGauge({
  citations,
  target,
  label = 'KPI Progress',
}: ProgressGaugeProps) {
  const pct      = target > 0 ? Math.min(Math.round((citations / target) * 100), 100) : 0
  const color    = gaugeColor(pct)

  // Fill arc: from TRACK_START, sweep (180 × pct/100)° clockwise
  const fillSweep = 180 * (pct / 100)
  const fillEnd   = TRACK_START + fillSweep  // always ≤ 270+180 = 450, normalise below

  // Build paths
  const trackPath = arcPath(CX, CY, R, TRACK_START, TRACK_END + 360) // full 180° track
  const fillPath  = pct > 0
    ? arcPath(CX, CY, R, TRACK_START, fillEnd)
    : null

  return (
    <div className="flex flex-col items-center gap-1" style={{ width: 140 }}>
      <svg
        width={140}
        height={80}
        viewBox="0 0 140 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label={`${label}: ${pct}%`}
      >
        {/* Track (background arc) */}
        <path
          d={trackPath}
          stroke="rgba(223,230,239,0.1)"
          strokeWidth={STROKE_W}
          strokeLinecap="round"
          fill="none"
        />

        {/* Fill arc */}
        {fillPath && (
          <path
            d={fillPath}
            stroke={color}
            strokeWidth={STROKE_W}
            strokeLinecap="round"
            fill="none"
            style={{ transition: 'stroke 0.4s ease' }}
          />
        )}

        {/* Percentage text */}
        <text
          x={CX}
          y={CY - 6}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={22}
          fontWeight={700}
          fill={color}
          fontFamily="'Poppins', sans-serif"
          style={{ transition: 'fill 0.4s ease' }}
        >
          {pct}%
        </text>

        {/* citations / target sub-text */}
        <text
          x={CX}
          y={CY + 14}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={9}
          fill="rgba(143,163,176,0.8)"
          fontFamily="'Poppins', sans-serif"
        >
          {citations}/{target}
        </text>
      </svg>

      {/* Label */}
      <p
        className="text-xs font-medium text-[var(--text-secondary)] text-center"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        {label}
      </p>
    </div>
  )
}
