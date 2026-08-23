import type { RecipeImage } from '@cookbook/domain';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '../api/hooks.js';
import { createRecipe } from '../api/recipes.js';
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
      <main className="rc-page rc-page--narrow">
        <h1 className="rc-page__title">Recipe saved</h1>
        <p className="rc-page__lede">Add a photo now, or go straight to the recipe.</p>

        <PhotoField recipeId={savedId} image={image} onChange={setImage} />

        <div className="rc-form__actions">
          <Link className="rc-button rc-button--primary" to={`/recipes/${savedId}`}>
            View recipe
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="rc-page rc-page--narrow">
      <nav className="rc-breadcrumb">
        <Link to="/">← Cookbook</Link>
      </nav>

      <h1 className="rc-page__title">Add a recipe</h1>

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
    </main>
  );
}
