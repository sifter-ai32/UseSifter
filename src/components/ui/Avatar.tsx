import { getInitials, getImageUrl } from '@/lib/utils'

interface AvatarProps {
  name: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  online?: boolean
  onClick?: () => void
}

const SIZES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-sm',
  xl: 'w-16 h-16 text-lg',
} as const

const ONLINE_DOT = {
  sm: 'w-2 h-2 border',
  md: 'w-2.5 h-2.5 border-2',
  lg: 'w-3 h-3 border-2',
  xl: 'w-3.5 h-3.5 border-2',
} as const

export default function Avatar({ name, src, size = 'md', online, onClick }: AvatarProps) {
  const imageUrl = getImageUrl(src)
  const sizeClass = SIZES[size]
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`relative shrink-0 ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name}
          className={`${sizeClass} rounded-full object-cover`}
        />
      ) : (
        <div className={`${sizeClass} rounded-full bg-[#ffffff]/10 border border-[#ffffff]/5 flex items-center justify-center text-[#fafafa]`}>
          {getInitials(name)}
        </div>
      )}
      {online && (
        <div className={`absolute bottom-0 right-0 ${ONLINE_DOT[size]} bg-[#fafafa] rounded-full border-[#000000]`} />
      )}
    </Tag>
  )
}
