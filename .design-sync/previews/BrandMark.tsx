import { BrandMark, Panel } from '@cookbook/web';

export function Sizes() {
  return (
    <div className="flex items-end gap-6">
      <BrandMark size={28} />
      <BrandMark size={44} />
      <BrandMark size={72} />
    </div>
  );
}

export function OnGlass() {
  return (
    <Panel className="inline-flex items-center gap-3">
      <BrandMark size={40} />
      <span className="font-serif text-[20px] text-ink">Pior Labs Cookbook</span>
    </Panel>
  );
}
