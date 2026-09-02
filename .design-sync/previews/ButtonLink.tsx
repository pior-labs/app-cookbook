import { ButtonLink } from '@cookbook/web';

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ButtonLink to="/recipes/new" variant="primary">New recipe</ButtonLink>
      <ButtonLink to="/recipes" variant="ghost">Browse the cookbook</ButtonLink>
      <ButtonLink to="/trash" variant="quiet">Recently deleted</ButtonLink>
    </div>
  );
}

export function Sizes() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ButtonLink to="/recipes/new" variant="primary">New recipe</ButtonLink>
      <ButtonLink size="small" to="/recipes/new" variant="primary">New</ButtonLink>
    </div>
  );
}
