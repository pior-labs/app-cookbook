import { FieldHint, FieldLabel, Textarea } from '@cookbook/web';

export function Default() {
  return (
    <div className="flex max-w-140 flex-col gap-1.5">
      <FieldLabel htmlFor="ta-method">Method</FieldLabel>
      <Textarea
        defaultValue={'Toast the orzo in the butter until it smells nutty.\n\nAdd the stock a ladle at a time, keeping the pan moving, until the orzo is tender but still has bite.\n\nOff the heat, fold through the lemon zest and most of the dill.'}
        id="ta-method"
        rows={6}
      />
    </div>
  );
}

export function WithHint() {
  return (
    <div className="flex max-w-140 flex-col gap-1.5">
      <FieldLabel htmlFor="ta-note">Note</FieldLabel>
      <Textarea aria-describedby="ta-note-hint" id="ta-note" placeholder="Anything worth remembering next time." />
      <FieldHint id="ta-note-hint">Only the household sees this.</FieldHint>
    </div>
  );
}
