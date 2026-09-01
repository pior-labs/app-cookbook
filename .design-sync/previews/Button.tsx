import { Button } from '@cookbook/web';

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary">Save recipe</Button>
      <Button variant="ghost">Add to shortlist</Button>
      <Button variant="quiet">Cancel</Button>
      <Button variant="danger">Move to trash</Button>
    </div>
  );
}

export function Sizes() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="default" variant="primary">Save recipe</Button>
      <Button size="small" variant="primary">Save</Button>
      <Button size="default" variant="ghost">Scale servings</Button>
      <Button size="small" variant="ghost">Scale</Button>
    </div>
  );
}

export function Disabled() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled variant="primary">Save recipe</Button>
      <Button disabled variant="ghost">Add to shortlist</Button>
      <Button disabled variant="danger">Move to trash</Button>
    </div>
  );
}
