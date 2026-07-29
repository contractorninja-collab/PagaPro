import type { Metadata } from "next";
import { listCompaniesForAdmin } from "@/modules/admin/services/admin-service";
import { BiznesetClient } from "./bizneset-client";

export const metadata: Metadata = {
  title: "Bizneset — PagaPRO Admin",
};

export const dynamic = "force-dynamic";

export default async function BiznesetPage() {
  const companies = await listCompaniesForAdmin();
  return <BiznesetClient companies={companies} />;
}
