import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { resolveBrandSvg, resolveImageSrc } from '../lib/agent-icons'

interface AgentIconProps {
  /** Resolved icon string (lucide name, `img:<key>` or a data URL). */
  icon: string
  /** Accessible label / alt text — used for image icons. */
  alt?: string
  className?: string
}

/**
 * Renders an agent icon, transparently handling the three icon kinds:
 *
 *   - brand marks (`img:<key>`) are inlined as SVG so they inherit the ambient
 *     `currentColor` and adapt to the theme — just like a Lucide glyph;
 *   - custom images (`data:` URLs) are drawn as a contained `<img>`;
 *   - everything else falls through to the shared Lucide icon registry.
 */
export function AgentIcon({ icon, alt, className }: AgentIconProps) {
  const brand = resolveBrandSvg(icon)
  if (brand) {
    return (
      <span
        className={cn('inline-flex [&>svg]:size-full', className)}
        {...(alt ? { role: 'img', 'aria-label': alt } : { 'aria-hidden': true })}
        dangerouslySetInnerHTML={{ __html: brand }}
      />
    )
  }
  const src = resolveImageSrc(icon)
  if (src) {
    return (
      <img
        src={src}
        alt={alt ?? ''}
        className={cn('object-contain', className)}
        draggable={false}
      />
    )
  }
  return <Icon name={icon} className={className} />
}
