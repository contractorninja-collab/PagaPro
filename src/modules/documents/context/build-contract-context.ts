import type { BuildContractContextParams } from "./types";
import { buildCoreOrganizationalContext } from "./build-core-context";
import { mergeDocumentMetadata } from "./merge-metadata";
import { buildContractRuntimePlaceholderMap } from "./contract-runtime-context";

/**
 * Back-compat façade: core org context + employment contract dates.
 */
export function buildContractPlaceholderContext(params: BuildContractContextParams): Record<string, string> {
  const locale = params.locale ?? "sq-AL";
  const core = buildCoreOrganizationalContext({
    employee: params.employee,
    company: params.company,
    settings: params.settings,
    locale,
  });
  const runtime = buildContractRuntimePlaceholderMap(params.contract, locale);
  return mergeDocumentMetadata(core, runtime);
}
