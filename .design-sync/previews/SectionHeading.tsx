import { SectionHeading } from '@cookbook/web';

export function WithSub() {
  return <SectionHeading sub="Serves 4, ready in 35 minutes">Lemon and dill orzo</SectionHeading>;
}

export function Plain() {
  return <SectionHeading id="sh-ingredients">Ingredients</SectionHeading>;
}

export function InASection() {
  return (
    <section aria-labelledby="sh-method" className="flex flex-col gap-3">
      <SectionHeading id="sh-method" sub="Keep the pan moving">Method</SectionHeading>
      <p className="m-0 max-w-140 text-[15px] text-ink-2">
        Toast the orzo in the butter until it smells nutty, then add the stock a ladle at a time
        until it is tender but still has bite.
      </p>
    </section>
  );
}
