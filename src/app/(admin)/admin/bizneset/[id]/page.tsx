import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getCompanyDetailForAdmin } from "@/modules/admin/services/admin-service";
import {
  backfillCompanyMembershipsFromGroup,
  listBrandGroupSiblings,
  listUngroupedCompaniesForAdmin,
} from "@/modules/admin/services/company-brand-group-service";
import { listTimeClockDevices } from "@/modules/timeclock/services/timeclock-device-service";
import {
  getCompanyBillingForAdmin,
  listBillingPlansForAdmin,
} from "@/modules/admin/services/admin-billing-service";
import { prisma } from "@/lib/prisma";
import { BiznesDetailClient } from "./biznes-detail-client";

export const metadata: Metadata = {
  title: "Detajet e biznesit — PagaPRO Admin",
};

export const dynamic = "force-dynamic";

export default async function BiznesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Self-heal for grouped companies with zero users (created before sibling
  // creation started copying memberships automatically) — a no-op otherwise.
  // Runs before the detail fetch so the users table shows the healed state.
  try {
    await backfillCompanyMembershipsFromGroup(id);
  } catch (err) {
    console.error("[admin] membership backfill failed — page continues", err);
  }

  const company = await getCompanyDetailForAdmin(id);
  if (!company) notFound();

  const [devices, brandGroupSiblings, ungroupedCompanies, billing, billingPlans, brandGroupBilling] =
    await Promise.all([
      company.timeClockEnabled ? listTimeClockDevices(company.id) : Promise.resolve([]),
      listBrandGroupSiblings(company.id),
      listUngroupedCompaniesForAdmin(company.id),
      getCompanyBillingForAdmin(company.id),
      listBillingPlansForAdmin(),
      company.brandGroupId
        ? prisma.companyBrandGroup.findUnique({
            where: { id: company.brandGroupId },
            select: { id: true, name: true, discountPercent: true, discountAmountEur: true },
          })
        : Promise.resolve(null),
    ]);

  // The kiosk lives on the client's own tenant host when they have one, so the
  // pairing link we hand over opens the right company's screen.
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "";
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const appOrigin = company.tenantUrl ?? (host ? `${proto}://${host}` : "");

  return (
    <BiznesDetailClient
      company={company}
      timeClockDevices={devices}
      appOrigin={appOrigin}
      brandGroupSiblings={brandGroupSiblings}
      ungroupedCompanies={ungroupedCompanies}
      billing={billing}
      billingPlans={billingPlans}
      brandGroupBilling={
        brandGroupBilling
          ? {
              id: brandGroupBilling.id,
              name: brandGroupBilling.name,
              discountPercent: brandGroupBilling.discountPercent?.toFixed(2) ?? null,
              discountAmountEur: brandGroupBilling.discountAmountEur?.toFixed(2) ?? null,
            }
          : null
      }
    />
  );
}
