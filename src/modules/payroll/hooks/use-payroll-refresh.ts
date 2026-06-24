"use client";

import { useRouter } from "next/navigation";

/** Prefer server actions calling `revalidatePath`; use this after optimistic UI if needed. */
export function usePayrollRouterRefresh() {
  const router = useRouter();
  return () => router.refresh();
}
