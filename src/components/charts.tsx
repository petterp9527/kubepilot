import { useRef, useState } from 'react'
import type { SeriesPoint } from '../types'
import { cn, formatTime } from '../lib/utils'

function toPath(points: SeriesPoint[], w: number, h: number, max: number) {
  const n = points.length
  const step = w / (n - 1)
  return points
    .map((p, i) => {
      const x = i * step
      const y = h - (p.v / max) * h
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

export function Sparkline({
  data,
  color = '#2563eb',
  className,
}: {
  data: SeriesPoint[]
  color?: string
  className?: string
}) {
  const max = Math.max(...data.map((d) => d.v)) * 1.15
  const path = toPath(data, 100, 28, max)
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className={cn('h-7 w-full', className)} aria-hidden>
      <path d={`${path} L100,28 L0,28 Z`} fill={color} opacity="0.09" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  )
}

export function LineChart({
  data,
  color = '#2563eb',
  unit = '%',
  height = 190,
  max = 100,
  ticks = [0, 25, 50, 75, 100],
  className,
}: {
  data: SeriesPoint[]
  color?: string
  unit?: string
  height?: number
  max?: number
  ticks?: number[]
  className?: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const W = 1000
  const H = 100
  const path = toPath(data, W, H, max)
  const id = `grad-${color.replace('#', '')}`

  const onMove = (e: React.MouseEvent) => {
    const el = wrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    setHover(Math.round(ratio * (data.length - 1)))
  }

  const active = hover !== null ? data[hover] : null
  const activeX = hover !== null ? (hover / (data.length - 1)) * 100 : 0
  const activeY = active ? (1 - active.v / max) * 100 : 0

  return (
    <div className={cn('select-none', className)}>
      <div className="flex gap-2">
        {/* Y 轴 */}
        <div className="flex flex-col justify-between pb-5 text-[10px] text-faint" style={{ height }}>
          {[...ticks].reverse().map((t) => (
            <span key={t} className="num leading-none">
              {t}
              {unit}
            </span>
          ))}
        </div>
        <div
          ref={wrapRef}
          className="relative flex-1"
          style={{ height }}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {ticks.map((t) => {
              const y = H - (t / max) * H
              return (
                <line
                  key={t}
                  x1="0"
                  x2={W}
                  y1={y}
                  y2={y}
                  stroke="#eef2f7"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}
            <path d={`${path} L${W},${H} L0,${H} Z`} fill={`url(#${id})`} />
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {active && (
            <>
              <div
                className="pointer-events-none absolute top-0 h-full w-px bg-slate-300"
                style={{ left: `${activeX}%` }}
              />
              <div
                className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm"
                style={{ left: `${activeX}%`, top: `${activeY}%`, background: color }}
              />
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border border-line bg-white px-2 py-1 text-[10.5px] shadow-md"
                style={{
                  left: `${Math.min(92, Math.max(8, activeX))}%`,
                  top: Math.max(0, activeY - 22) + '%',
                }}
              >
                <div className="num font-medium text-ink">
                  {active.v}
                  {unit}
                </div>
                <div className="text-faint">{formatTime(active.t)}</div>
              </div>
            </>
          )}

          <div className="absolute -bottom-5 left-0 right-0 flex justify-between text-[10px] text-faint">
            <span>{formatTime(data[0].t)}</span>
            <span>{formatTime(data[Math.floor(data.length / 2)].t)}</span>
            <span>{formatTime(data[data.length - 1].t)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function BarRow({
  label,
  value,
  max,
  color = '#2563eb',
  suffix,
}: {
  label: string
  value: number
  max: number
  color?: string
  suffix?: string
}) {
  const pct = max ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-[92px] shrink-0 truncate font-mono text-[11.5px] text-ink-soft">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.min(100, pct)}%`, background: color }}
        />
      </div>
      <span className="num w-[54px] shrink-0 text-right text-[11.5px] text-muted">
        {value}
        {suffix}
      </span>
    </div>
  )
}
