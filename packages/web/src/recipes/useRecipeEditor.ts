import type { CategorySummary, TagSummary } from '@cookbook/domain';
import { useCallback, useEffect, useState } from 'react';
import type { ErrorFields } from '../api/client.js';
import { useApiResource } from '../api/hooks.js';
import { createTag as createTagRequest, listCategories, listTags } from '../api/recipes.js';

// Shared plumbing for the create and edit screens: the pickers the form needs,
// dirty tracking, and the browser-level guard on leaving unsaved work
// (technical design section 11.2).

export interface Organization {
  categories: CategorySummary[];
  tags: TagSummary[];
  loading: boolean;
  reloadTags: () => void;
  addTag: (name: string) => Promise<TagSummary | null>;
}

export function useOrganization(): Organization {
  const loadCategories = useCallback((signal: AbortSignal) => listCategories(signal), []);
  const loadTags = useCallback((signal: AbortSignal) => listTags(signal), []);

  const categories = useApiResource(loadCategories, []);
  const tags = useApiResource(loadTags, []);

  // Newly created tags are appended locally rather than refetching the list, so
  // the checkbox the cook just created does not flicker away and back.
  const [created, setCreated] = useState<TagSummary[]>([]);

  const addTag = useCallback(async (name: string): Promise<TagSummary | null> => {
    try {
      const tag = await createTagRequest(name);
      const summary: TagSummary = {
        ...tag,
        activeRecipeCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setCreated((existing) => [...existing, summary]);
      return summary;
    } catch {
      return null;
    }
  }, []);

  const all = [...(tags.data ?? []), ...created].sort((a, b) => a.name.localeCompare(b.name));

  return {
    categories: categories.data ?? [],
    tags: all,
    loading: categories.loading || tags.loading,
    reloadTags: tags.reload,
    addTag,
  };
}

// The browser confirmation for a reload or tab close. In-app navigation is
// guarded separately, because React Router owns those transitions.
export function useUnsavedChangesWarning(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;

    function handler(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
}

// Server field errors and client validation errors share one shape, so a screen
// can show whichever arrived last without branching.
export function useFieldErrors() {
  const [fields, setFields] = useState<ErrorFields>({});

  const clear = useCallback(() => setFields({}), []);

  return { fields, setFields, clear };
}
