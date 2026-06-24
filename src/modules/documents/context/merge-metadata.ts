/**
 * Shallow merge for document-specific placeholder slices (category adapters).
 * Later keys win.
 */
export function mergeDocumentMetadata(
  base: Record<string, string>,
  metadata: Record<string, string>,
): Record<string, string> {
  return { ...base, ...metadata };
}
