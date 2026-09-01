import { Eyebrow, SectionHeading } from '@cookbook/web';

export function AboveAHeading() {
  return (
    <div>
      <Eyebrow>Weeknight</Eyebrow>
      <SectionHeading sub="Serves 4, ready in 35 minutes">Lemon and dill orzo</SectionHeading>
    </div>
  );
}

export function Categories() {
  return (
    <div className="flex flex-col gap-2">
      <Eyebrow>Weeknight</Eyebrow>
      <Eyebrow>Slow weekend</Eyebrow>
      <Eyebrow>Baking</Eyebrow>
    </div>
  );
}
