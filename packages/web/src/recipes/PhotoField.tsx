import type { RecipeImage } from '@cookbook/domain';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { ApiRequestError } from '../api/client.js';
import { deleteRecipePhoto, uploadRecipePhoto } from '../api/recipes.js';
import { Button, FieldError, FieldHint, buttonClass } from '@/components/ui';

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
    return <FieldHint>Save the recipe first, then you can add a photo.</FieldHint>;
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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      {image ? (
        <img
          className="aspect-[4/3] w-full shrink-0 rounded-[22px] border border-frost/80 object-cover shadow-[0_12px_32px_-14px_color-mix(in_srgb,var(--ink)_35%,transparent)] sm:w-56"
          src={`${image.cardUrl}?v=${version}`}
          width={image.cardWidth}
          height={image.cardHeight}
          alt="Current recipe photo"
        />
      ) : (
        <div
          className="tone-card-3 grid aspect-[4/3] w-full shrink-0 place-items-center rounded-[22px] border border-dashed border-ink/20 sm:w-56"
          aria-hidden="true"
        >
          <span className="font-serif text-[15px] italic text-ink-2">No photo yet</span>
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <label className={buttonClass(image ? 'ghost' : 'primary')} htmlFor="recipe-photo">
            <ImagePlus aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
            {image ? 'Replace photo' : 'Add photo'}
          </label>
          <input
            className="sr-only"
            id="recipe-photo"
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            disabled={busy}
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />

          {image ? (
            <Button variant="quiet" onClick={() => void handleRemove()} disabled={busy}>
              <Trash2 aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
              Remove photo
            </Button>
          ) : null}

          {busy ? (
            <span className="font-serif text-[14px] italic text-ink-2" role="status">
              Working…
            </span>
          ) : null}
        </div>

        <FieldHint>JPEG, PNG, or WebP, up to 10 MB.</FieldHint>

        {error ? <FieldError>{error}</FieldError> : null}
      </div>
    </div>
  );
}
