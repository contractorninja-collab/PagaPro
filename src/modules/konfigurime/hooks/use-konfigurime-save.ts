"use client";

import { useCallback, useState } from "react";
import type { SaveKonfigurimeResult } from "@/modules/konfigurime/actions/save-konfigurime";
import { saveKonfigurimeAction } from "@/modules/konfigurime/actions/save-konfigurime";

export function useKonfigurimeSave() {
  const [pending, setPending] = useState(false);

  const submit = useCallback(async (formData: FormData): Promise<SaveKonfigurimeResult> => {
    setPending(true);
    try {
      return await saveKonfigurimeAction(formData);
    } finally {
      setPending(false);
    }
  }, []);

  return { pending, submit };
}
