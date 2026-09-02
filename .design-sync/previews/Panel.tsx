import { Button, Eyebrow, FieldHint, FieldLabel, Input, Panel, SectionHeading } from '@cookbook/web';

export function ShortContent() {
  return (
    <Panel>
      <Eyebrow>Weeknight</Eyebrow>
      <SectionHeading sub="Serves 4, ready in 35 minutes">Lemon and dill orzo</SectionHeading>
      <p className="mt-3 mb-0 text-[15px] text-ink-2">
        The one the household asks for when nobody wants to think about dinner. Keep the pan
        moving once the stock is in, or the orzo catches.
      </p>
    </Panel>
  );
}

export function AsFormCard() {
  return (
    <Panel>
      <SectionHeading>Add to the cookbook</SectionHeading>
      <div className="mt-4 flex flex-col gap-1.5">
        <FieldLabel htmlFor="panel-title">Recipe name</FieldLabel>
        <Input defaultValue="Lemon and dill orzo" id="panel-title" />
        <FieldHint id="panel-title-hint">However you would say it out loud.</FieldHint>
      </div>
      <div className="mt-5 flex justify-end gap-2.5">
        <Button variant="quiet">Cancel</Button>
        <Button variant="primary">Save recipe</Button>
      </div>
    </Panel>
  );
}
