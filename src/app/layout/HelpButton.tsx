import { useLocation } from 'react-router-dom'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { PAGE_HELP } from '@/app/help'

/**
 * Contextual help for the current page. Renders a `?` button in the top bar that
 * opens a short explanation of the concepts the page deals with. Hidden on pages
 * with no registered help entry.
 */
export function HelpButton() {
  const { pathname } = useLocation()
  const help = PAGE_HELP[pathname]
  if (!help) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Help: ${help.title}`}>
          <Icon name="circle-help" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-xs p-3">
        <p className="mb-1.5 text-sm font-semibold">{help.title}</p>
        <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
          {help.body.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
