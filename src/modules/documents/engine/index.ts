export {
  DOCUMENT_CORE_PLACEHOLDER_KEYS,
  CONTRACT_PLACEHOLDER_KEYS,
  type DocumentCorePlaceholderKey,
  type ContractPlaceholderKey,
} from "./placeholders/constants";
export { parsePlaceholdersFromText, parsePlaceholdersFromTexts } from "./placeholders/parser";
export { detectPlaceholdersInDocxBuffer } from "./placeholders/docx-detect";
export {
  composePlaceholderRegistry,
  getRegistryForCategory,
  CANONICAL_PLACEHOLDER_REGISTRY,
  isCanonicalPlaceholderKey,
  type PlaceholderDefinition,
  type PlaceholderSource,
} from "./placeholders/registry";

export type { DocumentCategory } from "./types";

export type {
  EmployeeContractDto,
  CompanyContractDto,
  CompanySettingContractDto,
  ContractRuntimeDto,
  BuildContractContextParams,
} from "../context/types";
export { buildContractPlaceholderContext } from "../context/build-contract-context";
export { buildCoreOrganizationalContext } from "../context/build-core-context";
export { mergeDocumentMetadata } from "../context/merge-metadata";
export { buildContractRuntimePlaceholderMap } from "../context/contract-runtime-context";
export { buildLeavePlaceholderMap } from "../context/leave-context";
export { buildTerminationPlaceholderMap } from "../context/termination-context";
export { buildWarningPlaceholderMap } from "../context/warning-context";

export {
  validatePlaceholdersForRender,
  DocumentPlaceholderValidationError,
  ContractPlaceholderValidationError,
  type PlaceholderValidationPolicy,
} from "./validation/validate-placeholders";

export { renderDocxTemplate, type DocxRenderOptions } from "./render/docx-render";

export type { DocumentStorage, DocumentStoragePutOptions, ContractStorage, ContractStoragePutOptions } from "./storage/types";
export { LocalFsDocumentStorage, LocalFsContractStorage } from "./storage/local-fs-storage";
export {
  templateVersionSourceKey,
  generationArtifactDocxKey,
  generationArtifactPdfKey,
} from "./storage/path-keys";

export {
  generateDocumentFromTemplate,
  generateContractDocxDocument,
  mergeTemplateContext,
  mergeContractContext,
  analyzeDocxTemplatePlaceholders,
  type GenerateDocumentFromTemplateParams,
  type GenerateDocumentFromTemplateResult,
  type GenerateContractDocxParams,
  type GenerateContractDocxResult,
} from "./generate-document-from-template";
