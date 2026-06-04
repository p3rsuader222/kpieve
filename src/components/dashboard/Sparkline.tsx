import { useEffect, useId, useRef, useState } from 'react'
import type { SeriesPoint } from '@/lib/metrics'
import { STATUS_VAR, type Status } from '@/lib/status'

interface Props {
  data: SeriesPoint[]
  status: Status
  height?: number
}

/** Tiny, container-responsive area+line sparkline (pure SVG, no axes). */
export function Sparkline({ data, status, height = 42 }: Props) {
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const pts = data.filter((d): d is SeriesPoint & { value: number } => d.value != null)
  const color = STATUS_VAR[status]

  let content = null
  if (width > 0 && pts.length >= 2) {
    const values = pts.map((d) => d.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || 1
    const pad = 3
    const stepX = (width - pad * 2) / (pts.length - 1)
    const y = (v: number) => pad + (height - pad * 2) * (1 - (v - min) / span)
    const line = pts.map((d, i) => `${pad + i * stepX},${y(d.value)}`).join(' ')
    const area = `${pad},${height} ${line} ${pad + (pts.length - 1) * stepX},${height}`
    const last = pts[pts.length - 1]
    content = (
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id={`sg-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#sg-${id})`} />
        <polyline points={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={pad + (pts.length - 1) * stepX} cy={y(last.value)} r={2.6} fill={color} />
      </svg>
    )
  }

  return (
    <div ref={ref} style={{ height }} className="w-full">
      {content}
    </div>
  )
}
