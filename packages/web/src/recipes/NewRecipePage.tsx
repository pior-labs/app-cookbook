import type { RecipeImage, RecipeImportDraft } from '@cookbook/domain';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '../api/hooks.js';
import { apiUpload } from '../api/client.js';
import { ImportRecipe, ImportReview } from './ImportRecipe.js';
import { createRecipe } from '../api/recipes.js';
import { Breadcrumb, Button, ButtonLink, PageHeader, Panel } from '@/components/ui';
import { PhotoField } from './PhotoField.jsx';
import { RecipeForm } from './RecipeForm.jsx';
import { emptyDraft, draftFromImport, validateCreate, type RecipeDraft } from './form-state.js';
import { FormErrorBanner } from './states.jsx';
import { useFieldErrors, useOrganization, useUnsavedChangesWarning } from './useRecipeEditor.js';

// Recipe creation. The recipe is saved first and the photo attached afterwards,
// because the upload endpoint needs a recipe to attach to and a failed upload
// must not cost the cook the whole form.

export function NewRecipePage() {
  const navigate = useNavigate();
  const organization = useOrganization();
  const { fields, setFields, clear } = useFieldErrors();

  const [draft, setDraft] = useState<RecipeDraft>(emptyDraft);
  const [entry, setEntry] = useState<'import' | 'editor'>('import');
  const [preview, setPreview] = useState<RecipeImportDraft | null>(null);
  const [sourceImage, setSourceImage] = useState<File | null>(null);
  const [importedPhoto, setImportedPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [attachingPhoto, setAttachingPhoto] = useState(false);
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
    if (importedPhoto) {
      setAttachingPhoto(true);
      try {
        const bytes = Uint8Array.from(atob(importedPhoto.split(',')[1]), (character) =>
          character.charCodeAt(0),
        );
        const file = new File([bytes], 'recipe.webp', { type: 'image/webp' });
        setImage(
          await apiUpload<RecipeImage>(`/api/recipes/${result.data.id}/photo`, 'photo', file),
        );
      } catch {
        setPhotoError('Your recipe was saved, but its photo could not be attached. Add it below.');
      } finally {
        setAttachingPhoto(false);
      }
    }
  }

  function reset() {
    setDraft(emptyDraft());
    setEntry('import');
    setPreview(null);
    setSourceImage(null);
    setImportedPhoto(null);
    setPhotoError(null);
    setImage(null);
    setSavedId(null);
    setDirty(false);
    clear();
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
          lede={
            image
              ? 'Your recipe and photo are ready.'
              : 'Add a photo now, or go straight to the recipe.'
          }
        />

        <Panel>
          {attachingPhoto ? (
            <p role="status">Attaching recipe photo…</p>
          ) : (
            <>
              {photoError ? <p role="alert">{photoError}</p> : null}
              <PhotoField recipeId={savedId} image={image} onChange={setImage} />
            </>
          )}
        </Panel>

        <div className="flex flex-wrap gap-2.5">
          <ButtonLink to={`/recipes/${savedId}`} variant="primary">
            View recipe
          </ButtonLink>
          <Button onClick={reset} disabled={attachingPhoto}>
            Add another
          </Button>
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

      {entry === 'import' ? (
        <ImportRecipe
          onManual={() => setEntry('editor')}
          onPreview={(result, source) => {
            setPreview(result);
            setSourceImage(source);
            setImportedPhoto(result.photoDataUrl);
            setDraft(draftFromImport(result));
            setDirty(true);
            setEntry('editor');
            clear();
          }}
        />
      ) : (
        <>
          {preview ? (
            <ImportReview
              preview={preview}
              sourceImage={sourceImage}
              photo={importedPhoto}
              onRemovePhoto={() => setImportedPhoto(null)}
            />
          ) : null}
          <RecipeForm
            draft={draft}
            onChange={handleChange}
            categories={organization.categories}
            tags={organization.tags}
            fields={{
              ...(preview
                ? Object.fromEntries([
                    ...(!draft.baseServings
                      ? [['baseServings', ['Enter the servings from the source.']]]
                      : []),
                    ...draft.ingredients.flatMap((row, index) =>
                      !row.quantity.trim()
                        ? [
                            [
                              `ingredients.${index}.quantity`,
                              ['Check this missing amount against the source.'],
                            ],
                          ]
                        : [],
                    ),
                    ...(!draft.instructions.some((row) => row.body.trim())
                      ? [['instructions', ['Add the missing instructions.']]]
                      : []),
                  ])
                : {}),
              ...fields,
            }}
            submitting={save.submitting}
            submitLabel="Save recipe"
            onSubmit={() => void handleSubmit()}
            onCancel={handleCancel}
            onCreateTag={organization.addTag}
          />
        </>
      )}
    </div>
  );
}
