import { FieldError, FieldHint, FieldLabel, Input } from '@cookbook/web';

export function Default() {
  return (
    <div className="flex max-w-100 flex-col gap-1.5">
      <FieldLabel htmlFor="in-name">Recipe name</FieldLabel>
      <Input defaultValue="Lemon and dill orzo" id="in-name" />
    </div>
  );
}

export function WithHint() {
  return (
    <div className="flex max-w-100 flex-col gap-1.5">
      <FieldLabel htmlFor="in-src">Source</FieldLabel>
      <Input aria-describedby="in-src-hint" id="in-src" placeholder="https://" />
      <FieldHint id="in-src-hint">Where it came from, if it came from anywhere.</FieldHint>
    </div>
  );
}

export function Invalid() {
  return (
    <div className="flex max-w-100 flex-col gap-1.5">
      <FieldLabel htmlFor="in-serves">Serves</FieldLabel>
      <Input aria-describedby="in-serves-err" aria-invalid defaultValue="0" id="in-serves" type="number" />
      <FieldError id="in-serves-err">Serves has to be at least one.</FieldError>
    </div>
  );
}

export function Disabled() {
  return (
    <div className="flex max-w-100 flex-col gap-1.5">
      <FieldLabel htmlFor="in-owner">Added by</FieldLabel>
      <Input defaultValue="Ana Bergeron" disabled id="in-owner" />
    </div>
  );
}
