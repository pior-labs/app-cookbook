import { Panel, ThemeSwitcher } from '@cookbook/web';

export function InAMenu() {
  return (
    <Panel className="inline-block w-72">
      <ThemeSwitcher />
    </Panel>
  );
}

export function Bare() {
  return (
    <div className="inline-block w-72">
      <ThemeSwitcher />
    </div>
  );
}
