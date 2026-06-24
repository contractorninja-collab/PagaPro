export function parsePlaceholdersFromText(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)) {
    found.add(m[1]!);
  }
  return [...found].sort();
}

export function parsePlaceholdersFromTexts(parts: string[]): string[] {
  const merged = new Set<string>();
  for (const p of parts) {
    for (const key of parsePlaceholdersFromText(p)) {
      merged.add(key);
    }
  }
  return [...merged].sort();
}
