import { FieldHint, FieldLabel, Input } from '@cookbook/web';

export function UnderAControl() {
  return (
    <div className="flex max-w-100 flex-col gap-1.5">
      <FieldLabel htmlFor="fh-src">Source</FieldLabel>
      <Input aria-describedby="fh-src-hint" id="fh-src" placeholder="https://" />
      <FieldHint id="fh-src-hint">Where it came from, if it came from anywhere.</FieldHint>
    </div>
  );
}

export function Alone() {
  return <FieldHint id="fh-alone">Only the household sees this.</FieldHint>;
}
