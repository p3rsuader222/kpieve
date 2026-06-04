import { useId } from 'react'
import { cn } from '@/lib/cn'

/** The 11 selectable presets (10 women + 1 man), in picker order. */
export const PRESET_AVATARS = [
  'preset:w1', 'preset:w2', 'preset:w3', 'preset:w4', 'preset:w5',
  'preset:w6', 'preset:w7', 'preset:w8', 'preset:w9', 'preset:w10',
  'preset:m1',
] as const

const SKIN = ['#F4CBA6', '#EBB58C', '#D49A73', '#A9714E', '#8A5635', '#F7D9C4']
const HAIR = ['#2B2620', '#5A3A22', '#A6671F', '#D9A441', '#6B4226', '#1C1C1C', '#7A4A2B', '#B5651D', '#3A2A1A', '#9AA0A6']
const BG = ['#E1EEFF', '#E2F7EF', '#FCF1D8', '#F0E9FF', '#E0F7FF', '#FFE6EC', '#E9F0FF', '#EAF7E6', '#FFF0E0', '#E6F4F1']
const CLOTHES = ['#0A7AFF', '#32C998', '#E8A100', '#7C5CFF', '#1098AD', '#E64980', '#2B8A3E', '#1971C2', '#E67700', '#0CA678', '#495057']

interface Variant {
  isMan: boolean
  skin: string
  hair: string
  bg: string
  clothes: string
}

/** Parse a "preset:w3" / "preset:m1" key into deterministic styling. */
function variantFor(key: string): Variant {
  const raw = key.startsWith('preset:') ? key.slice(7) : key
  const isMan = raw.startsWith('m')
  const n = Math.max(1, parseInt(raw.slice(1), 10) || 1)
  const i = n - 1
  // Spread choices so the 10 women look clearly different.
  return {
    isMan,
    skin: SKIN[(i * 2) % SKIN.length],
    hair: isMan ? HAIR[0] : HAIR[i % HAIR.length],
    bg: BG[i % BG.length],
    clothes: CLOTHES[i % CLOTHES.length],
  }
}

interface Props {
  /** Preset key, e.g. "preset:w3". */
  id: string
  size?: number
  className?: string
}

/** A clean flat illustrated avatar derived from a preset key. */
export function PresetAvatar({ id, size = 36, className }: Props) {
  const clipId = useId()
  const { isMan, skin, hair, bg, clothes } = variantFor(id)

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={cn('shrink-0 rounded-full', className)}
      role="img"
      aria-hidden="true"
    >
      <clipPath id={`a-${clipId}`}>
        <circle cx="20" cy="20" r="20" />
      </clipPath>
      <g clipPath={`url(#a-${clipId})`}>
        <rect width="40" height="40" fill={bg} />
        {/* Long hair behind the head (women only). */}
        {!isMan && <ellipse cx="20" cy="23" rx="13" ry="14" fill={hair} />}
        {/* Shoulders / top. */}
        <ellipse cx="20" cy="39" rx="11" ry="9" fill={clothes} />
        {/* Head. */}
        <circle cx="20" cy="17" r="8.5" fill={skin} />
        {/* Hair cap over the forehead. */}
        {isMan ? (
          <path d="M11.5 16.5 a8.5 8.5 0 0 1 17 0 L26 14 Q20 11 14 14 Z" fill={hair} />
        ) : (
          <path d="M11 17 a9 9 0 0 1 18 0 Q20 9.5 11 17 Z" fill={hair} />
        )}
        {/* Eyes. */}
        <circle cx="16.6" cy="17.2" r="1.05" fill="#2A2A2A" />
        <circle cx="23.4" cy="17.2" r="1.05" fill="#2A2A2A" />
        {/* Smile. */}
        <path d="M16.8 20.6 q3.2 2.4 6.4 0" fill="none" stroke="#9B5B4A" strokeWidth="1" strokeLinecap="round" />
      </g>
    </svg>
  )
}
