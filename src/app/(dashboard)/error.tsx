"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/patterns/error-state";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="Gabim në faqe"
      description={error.message || "Ju lutemi rifreskoni faqen ose provoni përsëri."}
      retryLabel="Provo përsëri"
      onRetry={reset}
    />
  );
}
