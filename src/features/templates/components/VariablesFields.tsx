import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'

/** One labelled input per `{{placeholder}}` found in a template. */
export function VariablesFields({
  variables,
  values,
  onChange,
}: {
  variables: string[]
  values: Record<string, string>
  onChange: (name: string, value: string) => void
}) {
  if (variables.length === 0) return null
  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">
        Fill in the template’s variables.
      </p>
      {variables.map((name) => (
        <div key={name} className="space-y-1">
          <Label htmlFor={`var-${name}`} className="font-code text-xs">
            {`{{${name}}}`}
          </Label>
          <Input
            id={`var-${name}`}
            value={values[name] ?? ''}
            onChange={(e) => onChange(name, e.target.value)}
            placeholder={`Value for ${name}`}
          />
        </div>
      ))}
    </div>
  )
}
