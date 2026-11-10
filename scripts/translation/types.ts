export interface TranslationSegment {
  id: string;
  text: string;
  context: string;
}

export type Translations = ReadonlyMap<string, string>;

/** Require exactly the collected IDs; callers cannot add fields or array entries. */
export function validateTranslations(segments: readonly TranslationSegment[], translations: Translations): void {
  const ids = new Set(segments.map(segment => segment.id));
  for (const id of translations.keys()) {
    if (!ids.has(id)) throw new Error(`Extra or protected translation ID: ${id}`);
  }
  for (const { id } of segments) {
    if (!translations.has(id)) throw new Error(`Missing translation ID: ${id}`);
    const value = translations.get(id);
    if (typeof value !== 'string' || !value.trim()) throw new Error(`Blank or invalid translation: ${id}`);
  }
}
