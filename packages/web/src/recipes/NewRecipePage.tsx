import type { RecipeImage } from '@cookbook/domain';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '../api/hooks.js';
import { createRecipe } from '../api/recipes.js';
import { Breadcrumb, ButtonLink, PageHeader, Panel } from '@/components/ui';
import { PhotoField } from './PhotoField.jsx';
import { RecipeForm } from './RecipeForm.jsx';
import { emptyDraft, validateCreate, type RecipeDraft } from './form-state.js';
import { FormErrorBanner } from './states.jsx';
import { useFieldErrors, useOrganization, useUnsavedChangesWarning } from './useRecipeEditor.js';

// Recipe creation. The recipe is saved first and the photo attached afterwards,
// because the upload endpoint needs a recipe to attach to and a failed upload
// must not cost the cook the whole form (technical design section 7.4).

export function NewRecipePage() {
  const navigate = useNavigate();
  const organization = useOrganization();
  const { fields, setFields, clear } = useFieldErrors();

  const [draft, setDraft] = useState<RecipeDraft>(emptyDraft);
  const [dirty, setDirty] = useState(false);
  // Set once the recipe exists, which is what unlocks the photo step.
  const [savedId, setSavedId] = useState<number | null>(null);
  const [image, setImage] = useState<RecipeImage | null>(null);

  const save = useMutation(createRecipe);

  useUnsavedChangesWarning(dirty && savedId == null);

  function handleChange(next: RecipeDraft) {
    setDraft(next);
    setDirty(true);
  }

  async function handleSubmit() {
    clear();

    const validated = validateCreate(draft);
    if (!validated.ok) {
      setFields(validated.fields);
      return;
    }

    const result = await save.run(validated.input);
    if (!result.ok) {
      // The API is authoritative: its field errors replace whatever the client
      // checked, and the entered values stay exactly as they were.
      setFields(result.error.fields);
      return;
    }

    setDirty(false);
    setSavedId(result.data.id);
  }

  function handleCancel() {
    if (dirty && savedId == null && !window.confirm('Leave without saving this recipe?')) return;
    navigate('/');
  }

  if (savedId != null) {
    return (
      <div className="cb-rise flex min-w-0 max-w-3xl flex-col gap-7">
        <PageHeader
          title={
            <>
              Recipe <em className="font-light text-accent">saved</em>
            </>
          }
          lede="Add a photo now, or go straight to the recipe."
        />

        <Panel>
          <PhotoField recipeId={savedId} image={image} onChange={setImage} />
        </Panel>

        <div className="flex flex-wrap gap-2.5">
          <ButtonLink to={`/recipes/${savedId}`} variant="primary">
            View recipe
          </ButtonLink>
          <ButtonLink to="/recipes/new">Add another</ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="cb-rise flex min-w-0 max-w-3xl flex-col gap-6">
      <Breadcrumb to="/">Cookbook</Breadcrumb>

      <PageHeader title="Add a recipe" lede="Write it down once and this house has it for good." />

      {save.error && Object.keys(save.error.fields).length === 0 ? (
        <FormErrorBanner error={save.error} />
      ) : null}

      <RecipeForm
        draft={draft}
        onChange={handleChange}
        categories={organization.categories}
        tags={organization.tags}
        fields={fields}
        submitting={save.submitting}
        submitLabel="Save recipe"
        onSubmit={() => void handleSubmit()}
        onCancel={handleCancel}
        onCreateTag={organization.addTag}
      />
    </div>
  );
}
