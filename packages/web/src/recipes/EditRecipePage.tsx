import type { RecipeImage } from '@cookbook/domain';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApiResource, useMutation } from '../api/hooks.js';
import { getRecipe, updateRecipe } from '../api/recipes.js';
import { PhotoField } from './PhotoField.jsx';
import { RecipeForm } from './RecipeForm.jsx';
import { draftFromRecipe, validateUpdate, type RecipeDraft } from './form-state.js';
import { ErrorState, FormErrorBanner, RecipeSkeleton } from './states.jsx';
import { useFieldErrors, useOrganization, useUnsavedChangesWarning } from './useRecipeEditor.js';

// Editing the full recipe aggregate. A version conflict never overwrites: the
// form explains that the recipe changed and offers reload or a fresh copy
// (technical design section 11.3).

export function EditRecipePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const recipeId = Number(id);

  const load = useCallback((signal: AbortSignal) => getRecipe(recipeId, signal), [recipeId]);
  const { data: recipe, error, loading, reload } = useApiResource(load, [recipeId]);

  const organization = useOrganization();
  const { fields, setFields, clear } = useFieldErrors();

  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [image, setImage] = useState<RecipeImage | null>(null);
  const [dirty, setDirty] = useState(false);
  const [conflict, setConflict] = useState(false);

  const save = useMutation(updateRecipe);

  // The loaded recipe seeds the form once. Reloading after a conflict replaces
  // the draft deliberately, which is the "discard mine" branch of that choice.
  useEffect(() => {
    if (!recipe) return;

    setDraft(draftFromRecipe(recipe));
    setVersion(recipe.version);
    setImage(recipe.image);
    setDirty(false);
    setConflict(false);
  }, [recipe]);

  useUnsavedChangesWarning(dirty);

  function handleChange(next: RecipeDraft) {
    setDraft(next);
    setDirty(true);
  }

  async function handleSubmit() {
    if (!draft || version == null) return;

    clear();
    setConflict(false);

    const validated = validateUpdate(draft, version);
    if (!validated.ok) {
      setFields(validated.fields);
      return;
    }

    const result = await save.run(recipeId, validated.input);
    if (!result.ok) {
      if (result.error.isVersionConflict) {
        setConflict(true);
      } else {
        setFields(result.error.fields);
      }
      return;
    }

    setDirty(false);
    navigate(`/recipes/${recipeId}`);
  }

  function handleCancel() {
    if (dirty && !window.confirm('Leave without saving your changes?')) return;
    navigate(`/recipes/${recipeId}`);
  }

  if (loading || (!draft && !error)) {
    return (
      <main className="rc-page rc-page--narrow">
        <RecipeSkeleton />
      </main>
    );
  }

  if (error || !draft || !recipe) {
    return (
      <main className="rc-page rc-page--narrow">
        <ErrorState error={error!} onRetry={reload}>
          <Link className="rc-button rc-button--ghost" to="/">
            Back to the cookbook
          </Link>
        </ErrorState>
      </main>
    );
  }

  return (
    <main className="rc-page rc-page--narrow">
      <nav className="rc-breadcrumb">
        <Link to={`/recipes/${recipeId}`}>← {recipe.name}</Link>
      </nav>

      <h1 className="rc-page__title">Edit recipe</h1>

      {conflict ? (
        <div className="rc-conflict" role="alert">
          <p className="rc-conflict__title">Someone else saved this recipe first.</p>
          <p className="rc-conflict__body">
            Your changes have not been saved, and nothing you typed has been lost. Reload to start
            from their version, or save yours as a separate recipe.
          </p>
          <div className="rc-state__actions">
            <button className="rc-button rc-button--primary" type="button" onClick={reload}>
              Reload their version
            </button>
            <Link className="rc-button rc-button--ghost" to="/recipes/new">
              Start a separate copy
            </Link>
          </div>
        </div>
      ) : null}

      {save.error && !save.error.isVersionConflict &&
      Object.keys(save.error.fields).length === 0 ? (
        <FormErrorBanner error={save.error} />
      ) : null}

      <RecipeForm
        draft={draft}
        onChange={handleChange}
        categories={organization.categories}
        tags={organization.tags}
        fields={fields}
        submitting={save.submitting}
        submitLabel="Save changes"
        onSubmit={() => void handleSubmit()}
        onCancel={handleCancel}
        onCreateTag={organization.addTag}
        photoSlot={<PhotoField recipeId={recipeId} image={image} onChange={setImage} />}
      />
    </main>
  );
}
