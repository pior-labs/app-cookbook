import { SectionHeading, ThemePicker } from '@cookbook/web';

export function Default() {
  return <ThemePicker />;
}

export function OnThePreferencesScreen() {
  return (
    <div className="flex max-w-100 flex-col items-start gap-4">
      <SectionHeading sub="Applies to everyone in the household">Appearance</SectionHeading>
      <ThemePicker />
    </div>
  );
}
