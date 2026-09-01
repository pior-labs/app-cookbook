import { AppShell, Eyebrow, PageHeader, Panel, Route, Routes, SectionHeading } from '@cookbook/web';

function Screen() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        kicker="42 recipes, 6 cooked this month"
        lede="Everything the household has saved, newest first."
        title="The cookbook"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Panel>
          <Eyebrow>Weeknight</Eyebrow>
          <SectionHeading sub="Serves 4, ready in 35 minutes">Lemon and dill orzo</SectionHeading>
        </Panel>
        <Panel>
          <Eyebrow>Baking</Eyebrow>
          <SectionHeading sub="Makes one loaf, overnight prove">Seeded rye</SectionHeading>
        </Panel>
      </div>
    </div>
  );
}

export function Frame() {
  return (
    <Routes>
      <Route element={<AppShell />} path="/">
        <Route element={<Screen />} index />
      </Route>
    </Routes>
  );
}
