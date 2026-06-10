import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'
import { ipc } from '@/shared/ipc/ipc.client'

/** Extra working directories the agent may access (`permissions.additionalDirectories`). */
export function AdditionalDirectories({
  dirs,
  onChange,
}: {
  dirs: string[]
  onChange: (dirs: string[]) => void
}) {
  const add = async () => {
    const { path } = await ipc.pickDirectory('Add a working directory')
    if (path && !dirs.includes(path)) onChange([...dirs, path])
  }

  const remove = (dir: string) => onChange(dirs.filter((d) => d !== dir))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="folder-plus" className="size-4" />
          Additional directories
        </CardTitle>
        <CardDescription>
          Extra folders the agent may read and write outside the project root.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {dirs.length === 0 ? (
          <p className="text-xs text-muted-foreground">None added.</p>
        ) : (
          dirs.map((dir) => (
            <div
              key={dir}
              className="flex items-center gap-2 rounded-md border border-border px-2 py-1"
            >
              <Icon
                name="folder"
                className="size-3.5 shrink-0 text-muted-foreground"
              />
              <span
                data-selectable
                className="min-w-0 flex-1 truncate font-code text-xs"
                title={dir}
              >
                {dir}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(dir)}
                aria-label={`Remove ${dir}`}
              >
                <Icon name="x" />
              </Button>
            </div>
          ))
        )}
        <Button variant="outline" size="sm" onClick={add}>
          <Icon name="plus" />
          Add directory
        </Button>
      </CardContent>
    </Card>
  )
}
