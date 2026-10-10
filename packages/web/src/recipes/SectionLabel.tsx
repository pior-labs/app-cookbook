// A boundary is not a checklist item. Keep it outside the tappable row so a
// cook can scan stages without accidentally ticking an ingredient or step.
export function SectionLabel({ name }: { name: string }) {
  return (
    <li className="mt-6 mb-2 border-t border-ink/15 pt-4 first:mt-0 first:border-t-0 first:pt-0">
      <h3 className="m-0 font-serif text-xl font-medium text-ink">{name}</h3>
    </li>
  );
}
