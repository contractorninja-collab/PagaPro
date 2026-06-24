import type { PlaceholderDefinition } from "../placeholders/registry";
import { isCanonicalPlaceholderKey } from "../placeholders/registry";

export class DocumentPlaceholderValidationError extends Error {
  readonly missingKeys: string[];

  constructor(missingKeys: string[]) {
    super(
      missingKeys.length
        ? `Missing placeholder values: ${missingKeys.join(", ")}`
        : "Placeholder validation failed",
    );
    this.name = "DocumentPlaceholderValidationError";
    this.missingKeys = missingKeys;
  }
}

/** @deprecated Use DocumentPlaceholderValidationError */
export const ContractPlaceholderValidationError = DocumentPlaceholderValidationError;

function isNonEmpty(value: string | undefined): boolean {
  return value !== undefined && value.trim().length > 0;
}

export interface PlaceholderValidationPolicy {
  /** If true, unknown template keys must also be non-empty in merged map */
  treatUnknownKeysAsRequired: boolean;
}

const defaultPolicy: PlaceholderValidationPolicy = {
  treatUnknownKeysAsRequired: true,
};

/**
 * Ensures every detected placeholder has a renderable value after merges,
 * using the merged registry for required/default semantics.
 */
export function validatePlaceholdersForRender(
  detectedKeys: string[],
  mergedContext: Record<string, string>,
  registry: Record<string, PlaceholderDefinition>,
  policy: PlaceholderValidationPolicy = defaultPolicy,
): void {
  const missing: string[] = [];

  for (const key of detectedKeys) {
    const val = mergedContext[key];

    if (isCanonicalPlaceholderKey(key, registry)) {
      const def = registry[key]!;
      if (def.requiredByDefault && !isNonEmpty(val)) {
        missing.push(key);
      }
      continue;
    }

    if (policy.treatUnknownKeysAsRequired && !isNonEmpty(val)) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new DocumentPlaceholderValidationError(missing);
  }
}
