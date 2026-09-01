import { Breadcrumb, PageHeader } from '@cookbook/web';

export function Default() {
  return <Breadcrumb to="/recipes">The cookbook</Breadcrumb>;
}

export function AboveAPageHeader() {
  return (
    <div className="flex flex-col gap-3">
      <Breadcrumb to="/recipes">The cookbook</Breadcrumb>
      <PageHeader kicker="Weeknight" title="Lemon and dill orzo" />
    </div>
  );
}
