import { FieldLabel, Select } from '@cookbook/web';

export function Default() {
  return (
    <div className="flex max-w-100 flex-col gap-1.5">
      <FieldLabel htmlFor="sel-cat">Category</FieldLabel>
      <Select defaultValue="weeknight" id="sel-cat">
        <option value="weeknight">Weeknight</option>
        <option value="slow">Slow weekend</option>
        <option value="baking">Baking</option>
        <option value="basics">Basics</option>
      </Select>
    </div>
  );
}

export function Disabled() {
  return (
    <div className="flex max-w-100 flex-col gap-1.5">
      <FieldLabel htmlFor="sel-dis">Category</FieldLabel>
      <Select defaultValue="weeknight" disabled id="sel-dis">
        <option value="weeknight">Weeknight</option>
      </Select>
    </div>
  );
}
