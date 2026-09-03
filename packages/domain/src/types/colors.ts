// The colours a tag can be given. A closed palette rather than a colour wheel:
// a household's tags are read as a group - on a recipe, in the browse filters -
// and seven hues that were chosen together read as a set, where seven picked
// one at a time do not.
//
// Stored as hex so the column can hold a colour outside this list later without
// a migration. The web app renders every one of them through `color-mix`
// against the active theme's ink and surface, so a tag reads the same way in
// whichever theme the household is using rather than only in the one it was
// picked in.

export interface TagColor {
  value: string;
  name: string;
}

export const TAG_COLORS: readonly TagColor[] = [
  { value: '#c96442', name: 'Paprika' },
  { value: '#d4a55a', name: 'Honey' },
  { value: '#5b8a5a', name: 'Basil' },
  { value: '#7ec1c1', name: 'Sea salt' },
  { value: '#6b8db5', name: 'Blueberry' },
  { value: '#a87cc4', name: 'Plum' },
  { value: '#e2738a', name: 'Rhubarb' },
] as const;

// A tag with no colour is the ordinary case, and renders as the neutral chip
// every other pill in the app uses.
export function tagColorName(value: string | null): string {
  return TAG_COLORS.find((color) => color.value.toLowerCase() === value?.toLowerCase())?.name ?? 'No colour';
}
