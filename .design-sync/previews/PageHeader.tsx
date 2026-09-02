import { Button, ButtonLink, PageHeader } from '@cookbook/web';

export function WithActions() {
  return (
    <PageHeader
      actions={
        <>
          <Button variant="ghost">Import from a link</Button>
          <ButtonLink to="/recipes/new" variant="primary">New recipe</ButtonLink>
        </>
      }
      kicker="42 recipes, 6 cooked this month"
      lede="Everything the household has saved, newest first. Search finds a recipe by name, ingredient, or the note you left on it."
      title="The cookbook"
    />
  );
}

export function TitleOnly() {
  return <PageHeader title="Trash" />;
}

export function WithLede() {
  return (
    <PageHeader
      lede="Recipes stay here for thirty days after you delete them, then they go for good."
      title="Recently deleted"
    />
  );
}
