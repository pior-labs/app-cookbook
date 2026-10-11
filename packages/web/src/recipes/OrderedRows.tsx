import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { Button, FieldError, FieldHint, FieldLabel, IconButton, Input, MenuItem, OverflowMenu, SectionHeading } from '@/components/ui';
import type { ErrorFields } from '../api/client.js';
import { describedBy, fieldError } from './fields.js';
import { draftGroups, moveSection } from './form-state.js';

// Ordered ingredient and instruction rows. Position comes from array order and
// is derived server-side, so reordering here only moves array entries.
//
// Every reorder control is a real button: pointer, touch, and keyboard users
// all get the same affordance rather than a drag-only interaction.

interface RowControlsProps {
  index: number;
  total: number;
  label: string;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
  position?: number;
  controlKey: string;
}

export function RowControls({
  index,
  total,
  label,
  onMove,
  onRemove,
  canRemove,
  position: displayPosition,
  controlKey,
}: RowControlsProps) {
  const position = `${label} ${displayPosition ?? index + 1}`;

  return (
    // Always a horizontal cluster. Stacked, three 44px buttons stand taller
    // than the fields they belong to and leave the row mostly dead space. On a
    // phone the row turns into a column and this sits under the fields; from
    // a sufficiently wide row it sits beside them, pushed down past the label.
    // Container width matters here: a desktop viewport can still have a narrow
    // writing surface after the sidebar and section padding take their share.
    <div className="flex shrink-0 justify-end gap-1.5 @min-[52rem]:self-start @min-[52rem]:pt-[26px]">
      <IconButton
        id={`${controlKey}-up`}
        onClick={() => onMove(index, index - 1)}
        disabled={index === 0}
        aria-label={`Move ${position} up`}
      >
        <ArrowUp aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
      </IconButton>
      <IconButton
        id={`${controlKey}-down`}
        onClick={() => onMove(index, index + 1)}
        disabled={index === total - 1}
        aria-label={`Move ${position} down`}
      >
        <ArrowDown aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
      </IconButton>
      <IconButton
        id={`${controlKey}-remove`}
        tone="danger"
        onClick={() => onRemove(index)}
        disabled={!canRemove}
        aria-label={`Remove ${position}`}
      >
        <X aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
      </IconButton>
    </div>
  );
}

interface RowListProps<T> {
  legend: string;
  hint?: string;
  error?: string | null;
  addLabel: string;
  sectionLabel: 'Ingredient' | 'Step';
  rows: T[];
  onChange: (rows: T[]) => void;
  createItem: () => T;
  isBlankItem: (row: T) => boolean;
  fields: ErrorFields;
  children: (row: T, index: number, autoFocus: boolean) => ReactNode;
}

export function RowList<T extends { key: string; isSection?: boolean; section?: string | null }>({
  legend, hint, error, addLabel, sectionLabel, rows, onChange, createItem, isBlankItem, fields, children,
}: RowListProps<T>) {
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const holder = useRef<HTMLFieldSetElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const groups = draftGroups(rows);
  const named = groups.filter(group => group.heading != null);
  // "Main" is a visual home for unheaded items, not a heading to persist. Only
  // the explicit name action changes those items into a saved named section.
  const mainLabel = sectionLabel === 'Ingredient' ? 'Main ingredients' : 'Main steps';
  const list = sectionLabel === 'Ingredient' ? 'ingredients' : 'instructions';
  const noun = sectionLabel === 'Ingredient' ? 'ingredient' : 'step';

  // Crossing a container boundary reparents a row in React. Restore its arrow
  // focus after that move so keyboard users can keep moving the same item, not
  // fall back to the document body. Menu actions return to a surviving heading.
  useLayoutEffect(() => {
    const id = pendingFocus.current;
    pendingFocus.current = null;
    if (!id) return;
    const target = document.getElementById(id);
    if (target && holder.current?.contains(target)) {
      if (target instanceof HTMLButtonElement && target.disabled) {
        target.closest('li')?.querySelector<HTMLElement>('input, textarea')?.focus();
      } else target.focus();
    }
  }, [rows]);

  function addSection() {
    const heading = { ...createItem(), isSection: true, section: '' };
    setFocusKey(heading.key);
    // Create somewhere to write, not a loose boundary awaiting a second action.
    // Previous items are untouched and stay visibly inside their original group.
    // A fresh form's untouched placeholder is not an existing ingredient or
    // step. Reuse it in the new group instead of leaving a hidden required
    // blank in Main that would unexpectedly block the first save.
    onChange(rows.length === 1 && isBlankItem(rows[0])
      ? [heading, rows[0]] : [...rows, heading, createItem()]);
  }

  return (
    <fieldset ref={holder} className="m-0 min-w-0 border-0 p-0"
      onClickCapture={event => {
        const target = event.target as HTMLElement;
        pendingFocus.current = target.closest('button[id]')?.id || null;
      }}>
      <legend className="mb-3 p-0">
        <SectionHeading sub={hint}>{legend}</SectionHeading>
      </legend>
      {/* The hint is rendered inside the legend above for sighted readers; an
          error is separate so it can carry its own alert role. */}
      {error ? <FieldError>{error}</FieldError> : null}
      <div className="flex flex-col gap-5">
        {groups.map((group, groupIndex) => {
          const heading = group.heading;
          if (!heading && !group.items.length && named.length) return null;
          const position = named.findIndex(item => item.key === group.key) + 1;
          const name = heading?.section?.trim() || (heading ? `New ${noun} section` : mainLabel);
          const id = `${list}-section-${group.key}`;
          const sectionError = heading ? fieldError(fields, `${list}.${group.headingIndex}.section`) : null;
          const previousGroup = groups[groupIndex - 1];
          const previous = previousGroup?.heading
            ? previousGroup.heading.section?.trim() || 'the section above' : mainLabel;

          return (
            <div key={group.key} role="group" aria-label={name}
              className={`rounded-[22px] border border-ink/12 border-l-[3px] bg-[rgba(var(--surface-rgb),0.2)] ${heading ? 'border-l-accent/65' : 'border-l-ink/20'}`}>
              <div className={`rounded-t-[20px] border-b border-ink/10 p-4 sm:p-5 ${heading ? 'bg-accent/5' : 'flex flex-wrap items-start gap-3 bg-ink/3'}`}>
                {heading ? (
                  <>
                    {/* Section actions belong beside the label, not in a column
                        competing with the name. One non-wrapping toolbar keeps
                        the popup on-screen and the writing surface full-width. */}
                    <div className="flex items-center justify-between gap-3">
                      <FieldLabel htmlFor={id} className="min-w-0">{sectionLabel} section {position}</FieldLabel>
                      <div className="shrink-0">
                        <OverflowMenu label={`${sectionLabel} section ${position} options`} quiet>
                          <MenuItem disabled={position === 1} onSelect={() => {
                            pendingFocus.current = id;
                            onChange(moveSection(rows, group.headingIndex!, -1));
                          }}>Move section up</MenuItem>
                          <MenuItem disabled={position === named.length} onSelect={() => {
                            pendingFocus.current = id;
                            onChange(moveSection(rows, group.headingIndex!, 1));
                          }}>Move section down</MenuItem>
                          <MenuItem onSelect={() => {
                            const nextGroup = groups[groupIndex + 1];
                            if (previousGroup?.heading) pendingFocus.current = `${list}-section-${previousGroup.key}`;
                            else if (previousGroup?.items.length || group.items.length || !nextGroup) pendingFocus.current = `${list}-main-title`;
                            else pendingFocus.current = `${list}-section-${nextGroup.key}`;
                            onChange(rows.filter(row => row.key !== heading.key));
                          }}>
                            Remove heading
                            <span className="mt-1 block text-xs text-ink-3">Items join {previous}.</span>
                          </MenuItem>
                        </OverflowMenu>
                      </div>
                    </div>
                    <Input id={id} value={heading.section ?? ''} maxLength={80}
                      autoFocus={heading.key === focusKey}
                      placeholder={sectionLabel === 'Ingredient' ? 'For the sauce' : 'Mix & bake'}
                      className="mt-2 font-serif text-[20px]"
                      aria-invalid={sectionError ? true : undefined}
                      aria-describedby={describedBy(id, undefined, sectionError)}
                      onChange={event => onChange(rows.map(row => row.key === heading.key ? { ...row, section: event.target.value } : row))} />
                    {sectionError ? <div className="mt-2"><FieldError id={`${id}-error`}>{sectionError}</FieldError></div> : null}
                    <p className="mt-2 mb-0 text-[13px] text-ink-3">
                      {group.items.length} {noun}{group.items.length === 1 ? '' : 's'} in this section
                    </p>
                  </>
                ) : (
                  <>
                    <div className="min-w-0 flex-1 basis-48">
                      <h3 id={`${list}-main-title`} tabIndex={-1} className="m-0 font-serif text-[20px] font-normal text-ink">{mainLabel}</h3>
                      <p className="mt-2 mb-0 text-[13px] text-ink-3">
                        {group.items.length} {noun}{group.items.length === 1 ? '' : 's'} without a heading
                      </p>
                    </div>
                    <Button variant="quiet" size="small" onClick={() => {
                      const newHeading = { ...createItem(), isSection: true, section: '' };
                      setFocusKey(newHeading.key);
                      onChange([newHeading, ...rows]);
                    }}>Name this group</Button>
                  </>
                )}
              </div>
              <div className="@container p-4 sm:p-5">
                {group.items.length ? (
                  <ol className="m-0 flex list-none flex-col gap-5 p-0">
                    {group.items.map(({ row, index }) => children(row, index, row.key === focusKey))}
                  </ol>
                ) : <FieldHint>Add an item here before saving this section.</FieldHint>}
                <div className="mt-4 border-t border-dashed border-ink/15 pt-4">
                  <Button className="w-full sm:w-auto" onClick={() => {
                    const item = createItem();
                    setFocusKey(item.key);
                    onChange([...rows.slice(0, group.end), item, ...rows.slice(group.end)]);
                  }}>
                    <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.3} />
                    {addLabel}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5">
        <Button className="w-full sm:w-auto" variant="quiet" onClick={addSection}>
          <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.3} />
          Add section
        </Button>
        <p className="mt-2 mb-0 text-[13px] text-ink-3">Starts a separate group below. Existing {noun}s stay where they are.</p>
      </div>
    </fieldset>
  );
}
