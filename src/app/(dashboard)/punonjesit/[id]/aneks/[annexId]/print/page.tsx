import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCompanyContextPage } from "@/server/company-context";
import { buildAnnexData } from "@/modules/annex/documents/render-annex-document";
import { AnnexPrintControls } from "@/modules/annex/components/annex-print-button";

export const metadata: Metadata = { title: "Aneks Kontratë" };

type Props = { params: Promise<{ id: string; annexId: string }> };

/** Print-friendly HTML of one annex — mirrors the DOCX content so it prints without Word/PDF. */
export default async function AnnexPrintPage({ params }: Props) {
  const { companyId } = await requireCompanyContextPage();
  const { annexId } = await params;

  const built = await buildAnnexData(companyId, annexId);
  if (!built.ok) notFound();
  const { flat, changes } = built.data;

  const v = (k: string) => flat[k] ?? "";

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: 32,
        background: "#fff",
        color: "#0f172a",
        fontFamily: "Calibri, Arial, sans-serif",
        fontSize: 15,
        lineHeight: 1.6,
      }}
    >
      <style>{`@media print { .no-print { display: none !important; } body { background: #fff; } }`}</style>
      <AnnexPrintControls />

      <p style={{ fontWeight: 700, fontSize: 20, margin: 0 }}>{v("company_name")}</p>
      <p style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>{v("company_address")}</p>

      <h1 style={{ textAlign: "center", fontSize: 20, margin: "28px 0" }}>
        ANEKS NR. {v("annex_number")} I KONTRATËS SË PUNËS
      </h1>

      <p>
        Në bazë të neneve 10, 11, 17, 18 dhe 19 të Ligjit Nr. 03/L-212 të Punës, si dhe Kontratës
        së Punës të lidhur me datën {v("original_contract_date")}, palët nënshkruese lidhin këtë
        aneks të kontratës së punës:
      </p>
      <p>
        1. Punëdhënësi: {v("company_name")}, me seli në {v("company_address")}, numri i biznesit{" "}
        {v("company_nrb")}, i përfaqësuar nga {v("authorized_person_name")} (
        {v("authorized_person_position")}); dhe
      </p>
      <p>
        2. I punësuari: {v("employee_name")}, numri personal {v("employee_personal_number")}, me
        vendbanim {v("employee_address")}.
      </p>

      <p style={{ fontWeight: 700, marginTop: 20 }}>Neni 1 — Objekti i aneksit</p>
      <p>Me këtë aneks, palët pajtohen që kushtet e kontratës së punës të ndryshohen si në vijim:</p>
      <ul style={{ marginTop: 0 }}>
        {changes.map((c, i) => (
          <li key={i}>
            {c.label}: nga “{c.from}” në “{c.to}”.
          </li>
        ))}
      </ul>

      <p style={{ fontWeight: 700, marginTop: 20 }}>Neni 2 — Hyrja në fuqi</p>
      <p>
        Ndryshimet e përcaktuara me këtë aneks hyjnë në fuqi nga data {v("annex_effective_date")}.
      </p>

      <p style={{ fontWeight: 700, marginTop: 20 }}>Neni 3 — Dispozitat përfundimtare</p>
      <p>
        Të gjitha dispozitat e tjera të kontratës së punës të datës {v("original_contract_date")}{" "}
        mbeten të pandryshuara dhe në fuqi. Ky aneks është pjesë përbërëse e kontratës së punës dhe
        përpilohet në dy (2) kopje, nga një për secilën palë.
      </p>

      <p style={{ marginTop: 28 }}>
        {v("document_place")}, më {v("document_date")}
      </p>

      <table style={{ width: "100%", marginTop: 48, borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={{ textAlign: "center", fontWeight: 700 }}>Punëdhënësi</td>
            <td style={{ textAlign: "center", fontWeight: 700 }}>I punësuari</td>
          </tr>
          <tr>
            <td style={{ textAlign: "center", paddingTop: 28 }}>________________________</td>
            <td style={{ textAlign: "center", paddingTop: 28 }}>________________________</td>
          </tr>
          <tr>
            <td style={{ textAlign: "center" }}>{v("authorized_person_name")}</td>
            <td style={{ textAlign: "center" }}>{v("employee_name")}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
