import { cn } from '@/lib/cn'
import { PresetAvatar } from './PresetAvatar'

interface Props {
  initials: string
  color: string
  /** Preset key ("preset:…") or an image URL / data URL. Null → tinted initials. */
  avatar?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 'h-7 w-7 text-2xs',
  md: 'h-9 w-9 text-xs',
  lg: 'h-11 w-11 text-sm',
}

const pxMap = { sm: 28, md: 36, lg: 44 }

/** Avatar: preset illustration, uploaded photo, or tinted initials fallback. */
export function Avatar({ initials, color, avatar, size = 'md', className }: Props) {
  if (avatar && avatar.startsWith('preset:')) {
    return <PresetAvatar id={avatar} size={pxMap[size]} className={className} />
  }

  if (avatar) {
    return (
      <img
        src={avatar}
        alt=""
        className={cn('shrink-0 rounded-full object-cover ring-1 ring-inset ring-black/10', sizeMap[size], className)}
      />
    )
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-tight',
        sizeMap[size],
        className,
      )}
      style={{
        color,
        backgroundColor: `${color}1f`,
        boxShadow: `inset 0 0 0 1px ${color}33`,
      }}
    >
      {initials}
    </span>
  )
}
