import type { AgentAdapter } from '@/shared/types/agent'
import { cn } from '@/shared/lib/utils'
import { useAgentIcon } from '../hooks/useAgentIcon'
import { iconKind } from '../lib/agent-icons'
import { AgentIcon } from './AgentIcon'

interface AgentAvatarProps {
  agent: AgentAdapter
  /** Size (and any extra) classes for the tile, e.g. `size-10`. */
  className?: string
  /** Background/text classes used for brand marks and Lucide glyphs. */
  glyphToneClassName?: string
}

/**
 * The boxed agent icon tile. Brand marks and Lucide glyphs sit in a themed,
 * tinted box and inherit its `currentColor`, so they recolor with the theme.
 * Only user-uploaded custom images keep a neutral tile and are drawn contained.
 */
export function AgentAvatar({
  agent,
  className,
  glyphToneClassName = 'bg-primary/15 text-primary',
}: AgentAvatarProps) {
  const icon = useAgentIcon(agent)
  const customImage = iconKind(icon) === 'image'
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-lg',
        customImage ? 'bg-muted' : glyphToneClassName,
        className,
      )}
    >
      <AgentIcon
        icon={icon}
        alt={agent.displayName}
        className={customImage ? 'size-full p-1.5' : 'size-5'}
      />
    </div>
  )
}
