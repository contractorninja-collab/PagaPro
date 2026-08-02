import type { Metadata } from "next";
import {
  getFinancesForAdmin,
  listBillingPlansForAdmin,
} from "@/modules/admin/services/admin-billing-service";
import { FinancatClient } from "./financat-client";

export const metadata: Metadata = {
  title: "Financat — PagaPRO Admin",
};

export const dynamic = "force-dynamic";

export default async function FinancatPage() {
  const [finances, plans] = await Promise.all([getFinancesForAdmin(), listBillingPlansForAdmin()]);
  return <FinancatClient finances={finances} plans={plans} />;
}
