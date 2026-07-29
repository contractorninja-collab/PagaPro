import type { Metadata } from "next";
import { listCompaniesForAdmin } from "@/modules/admin/services/admin-service";
import { listBrandGroupsForAdmin } from "@/modules/admin/services/company-brand-group-service";
import { BiznesetClient } from "./bizneset-client";

export const metadata: Metadata = {
  title: "Bizneset — PagaPRO Admin",
};

export const dynamic = "force-dynamic";

export default async function BiznesetPage() {
  const [companies, brandGroups] = await Promise.all([
    listCompaniesForAdmin(),
    listBrandGroupsForAdmin(),
  ]);
  return <BiznesetClient companies={companies} brandGroups={brandGroups} />;
}
