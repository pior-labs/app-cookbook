import { FieldLabel, Input } from '@cookbook/web';

export function LabellingAControl() {
  return (
    <div className="flex max-w-100 flex-col gap-1.5">
      <FieldLabel htmlFor="fl-name">Recipe name</FieldLabel>
      <Input defaultValue="Lemon and dill orzo" id="fl-name" />
    </div>
  );
}

export function Alone() {
  return <FieldLabel htmlFor="fl-x">Serves</FieldLabel>;
}
