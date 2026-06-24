import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import {
  generationArtifactDocxKey,
  generationArtifactPdfKey,
  templateVersionSourceKey,
} from "../engine/storage/path-keys";
import type { DocumentStorage } from "../engine/storage/types";

export function getDocumentStorage(): DocumentStorage {
  return getCompanyAssetStorage();
}

export {
  templateVersionSourceKey,
  generationArtifactDocxKey,
  generationArtifactPdfKey,
};

export type { DocumentStorage };
