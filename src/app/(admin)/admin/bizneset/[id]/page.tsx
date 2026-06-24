import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCompanyDetailForAdmin } from "@/modules/admin/services/admin-service";
import { BiznesDetailClient } from "./biznes-detail-client";

export const metadata: Metadata = {
  title: "Detajet e biznesit — PagaPRO Admin",
};

export const dynamic = "force-dynamic";

export default async function BiznesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await getCompanyDetailForAdmin(id);
  if (!company) notFound();

  return <BiznesDetailClient company={company} />;
}
