import { FieldError, FieldLabel, Input } from '@cookbook/web';

export function UnderAControl() {
  return (
    <div className="flex max-w-100 flex-col gap-1.5">
      <FieldLabel htmlFor="fe-serves">Serves</FieldLabel>
      <Input aria-describedby="fe-serves-err" aria-invalid defaultValue="0" id="fe-serves" type="number" />
      <FieldError id="fe-serves-err">Serves has to be at least one.</FieldError>
    </div>
  );
}

export function Alone() {
  return <FieldError id="fe-alone">That recipe name is already in the cookbook.</FieldError>;
}
