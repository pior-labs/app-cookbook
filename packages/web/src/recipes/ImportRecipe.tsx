import { IMPORT_IMAGE_MAX_BYTES, type RecipeImportDraft } from '@cookbook/domain';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input, Panel, SectionHeading } from '@/components/ui';
import { apiSend, apiUpload } from '../api/client.js';
import { Field } from './fields.js';

export function ImportRecipe({
  onPreview,
  onManual,
}: {
  onPreview: (draft: RecipeImportDraft, sourceImage: File | null) => void;
  onManual: () => void;
}) {
  const [method, setMethod] = useState<'url' | 'image'>('url');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ignore late responses after switching to manual entry or navigating away.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function preview() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (
        method === 'image' &&
        (!file ||
          file.size > IMPORT_IMAGE_MAX_BYTES ||
          !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
      )
        throw new Error('Choose a JPEG, PNG or WebP image smaller than 10 MB.');
      const result =
        method === 'url'
          ? await apiSend<RecipeImportDraft>('/api/recipe-imports', 'POST', { method, url })
          : await apiUpload<RecipeImportDraft>('/api/recipe-imports/image', 'image', file!);
      if (mounted.current) onPreview(result, method === 'image' ? file : null);
    } catch (failure) {
      if (mounted.current)
        setError(
          failure instanceof Error
            ? failure.message
            : 'This recipe could not be imported. Try again or enter it manually.',
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <Panel>
      <SectionHeading sub="Bring a recipe you found into your household cookbook.">
        Start with a recipe
      </SectionHeading>
      <div className="my-5 flex flex-wrap gap-2" aria-label="Import method">
        <Button
          disabled={busy}
          aria-pressed={method === 'url'}
          variant={method === 'url' ? 'primary' : 'quiet'}
          onClick={() => {
            setMethod('url');
            setError(null);
          }}
        >
          Import from link
        </Button>
        <Button
          disabled={busy}
          aria-pressed={method === 'image'}
          variant={method === 'image' ? 'primary' : 'quiet'}
          onClick={() => {
            setMethod('image');
            setError(null);
          }}
        >
          Import from image
        </Button>
      </div>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void preview();
        }}
      >
        {method === 'url' ? (
          <Field
            id="import-url"
            label="Recipe link"
            hint="Use a public recipe page. You’ll review everything before saving."
          >
            <Input
              id="import-url"
              type="url"
              required
              maxLength={2048}
              placeholder="https://"
              value={url}
              disabled={busy}
              onChange={(event) => setUrl(event.target.value)}
            />
          </Field>
        ) : (
          <Field
            id="import-image"
            label="Recipe screenshot"
            hint="One recipe in a JPEG, PNG or WebP image, up to 10 MB. The screenshot is used for extraction and is not saved."
          >
            <Input
              id="import-image"
              type="file"
              required
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </Field>
        )}
        {error ? (
          <p role="alert" className="text-sm text-accent">
            {error}
          </p>
        ) : null}
        {busy ? (
          <p role="status" className="text-sm text-ink-2">
            Reading the recipe… this can take a little while.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Preparing preview…' : 'Preview recipe'}
          </Button>
          <Button variant="quiet" onClick={onManual}>
            Enter manually
          </Button>
        </div>
      </form>
    </Panel>
  );
}

export function ImportReview({
  preview,
  sourceImage,
  photo,
  onRemovePhoto,
}: {
  preview: RecipeImportDraft;
  sourceImage: File | null;
  photo: string | null;
  onRemovePhoto: () => void;
}) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!sourceImage) return;
    const url = URL.createObjectURL(sourceImage);
    setSourceUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [sourceImage]);
  return (
    <Panel>
      <SectionHeading sub="Check amounts and servings against the source, choose a category, then save below.">
        Review your import
      </SectionHeading>
      {preview.sourceUrl ? (
        <a
          className="mt-3 block break-all text-sm text-accent underline"
          href={preview.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open original recipe
        </a>
      ) : null}
      {sourceUrl ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-accent">
            Compare with your screenshot
          </summary>
          <img
            className="mt-3 max-h-[32rem] max-w-full rounded-xl object-contain"
            src={sourceUrl}
            alt="Original recipe screenshot"
          />
        </details>
      ) : null}
      {photo ? (
        <div className="mt-4 flex items-center gap-4">
          <img
            className="h-28 w-28 rounded-xl object-cover"
            src={photo}
            alt="Imported recipe photo"
          />
          <Button onClick={onRemovePhoto} variant="quiet">
            Remove photo
          </Button>
        </div>
      ) : null}
      {preview.warnings.length ? (
        <div className="mt-4 rounded-xl border border-accent/30 p-4">
          <p className="text-sm font-medium">Check against the source</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
            {preview.warnings.map((warning, index) => (
              <li key={index}>{warning.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {preview.duplicates.length ? (
        <div className="mt-4 rounded-xl border border-accent/30 p-4">
          <p className="text-sm font-medium">This might already be in your cookbook</p>
          <ul className="mt-2 space-y-1 text-sm">
            {preview.duplicates.map((recipe) => (
              <li key={recipe.id}>
                <Link
                  className="text-accent underline"
                  to={`/recipes/${recipe.id}`}
                  target="_blank"
                >
                  {recipe.name}
                </Link>{' '}
                — {recipe.reason === 'url' ? 'same source link' : 'similar name'}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-ink-2">You can still save a separate copy.</p>
        </div>
      ) : null}
    </Panel>
  );
}
