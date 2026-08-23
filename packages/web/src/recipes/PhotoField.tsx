import type { RecipeImage } from '@cookbook/domain';
import { useRef, useState } from 'react';
import { ApiRequestError } from '../api/client.js';
import { deleteRecipePhoto, uploadRecipePhoto } from '../api/recipes.js';

// Photo upload is a separate request from the recipe JSON, so an upload failure
// never discards the rest of the form (technical design section 7.4). The
// recipe must exist first, which is why creation offers this only after saving.

const ACCEPTED = 'image/jpeg,image/png,image/webp';

interface PhotoFieldProps {
  recipeId: number | null;
  image: RecipeImage | null;
  onChange: (image: RecipeImage | null) => void;
}

export function PhotoField({ recipeId, image, onChange }: PhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cache-busts the preview after a replacement: the URL is stable per recipe,
  // so only a changing query string forces the browser to refetch.
  const [version, setVersion] = useState(0);

  if (recipeId == null) {
    return (
      <p className="rc-field__hint">
        Save the recipe first, then you can add a photo.
      </p>
    );
  }

  async function handleFile(file: File | undefined) {
    if (!file || recipeId == null) return;

    setBusy(true);
    setError(null);

    try {
      onChange(await uploadRecipePhoto(recipeId, file));
      setVersion((value) => value + 1);
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError
          ? (caught.fields.photo?.[0] ?? caught.message)
          : 'That photo could not be uploaded.',
      );
    } finally {
      setBusy(false);
      // Clearing lets the same file be chosen again after a failure.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleRemove() {
    if (recipeId == null) return;

    setBusy(true);
    setError(null);

    try {
      await deleteRecipePhoto(recipeId);
      onChange(null);
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : 'That photo could not be removed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rc-photo">
      {image ? (
        <img
          className="rc-photo__preview"
          src={`${image.cardUrl}?v=${version}`}
          width={image.cardWidth}
          height={image.cardHeight}
          alt="Current recipe photo"
        />
      ) : (
        <div className="rc-photo__empty" aria-hidden="true">
          <span>No photo yet</span>
        </div>
      )}

      <div className="rc-photo__actions">
        <label className="rc-button rc-button--ghost" htmlFor="recipe-photo">
          {image ? 'Replace photo' : 'Add photo'}
        </label>
        <input
          className="rc-visually-hidden"
          id="recipe-photo"
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          disabled={busy}
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />

        {image ? (
          <button
            className="rc-button rc-button--ghost"
            type="button"
            onClick={() => void handleRemove()}
            disabled={busy}
          >
            Remove photo
          </button>
        ) : null}

        {busy ? <span className="rc-photo__busy">Working…</span> : null}
      </div>

      <p className="rc-field__hint">JPEG, PNG, or WebP, up to 10 MB.</p>

      {error ? (
        <p className="rc-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
