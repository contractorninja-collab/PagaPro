-- CreateEnum
CREATE TYPE "ReportType" AS ENUM (
  'LISTA_PUNONJESVE',
  'PUNONJES_AKTIVE',
  'PUNONJES_TE_LARGUAR',
  'KONTRAKTORE',
  'PUNONJES_SIPAS_DEPARTAMENTIT',
  'PUNONJES_ME_DOKUMENTE_QE_MUNGOJNE',
  'RAPORT_PAGAVE_MUJORE',
  'LISTA_PAGAVE_ME_SUMA',
  'LISTA_PER_NENSHKRIM_PA_SUMA',
  'FINANCE_PAYROLL_WORKBOOK',
  'ATK_EXPORT_WORKBOOK',
  'TRUSTI_DHE_TATIMI',
  'EMPLOYER_TOTAL_COST',
  'SALARY_ADVANCE_DEDUCTIONS',
  'PUSHIMET_SIPAS_PUNONJESIT',
  'PUSHIMET_VJETORE_TE_SHFRYTEZUARA',
  'PUSHIMET_NE_PRITJE',
  'PUSHIMET_MJEKESORE',
  'PUSHIMET_PA_PAGESE',
  'BALANCA_E_PUSHIMEVE',
  'CARRY_OVER_LEAVE',
  'DOKUMENTET_E_GJENERUARA',
  'KONTRATA_AKTIVE',
  'KONTRATA_AFER_SKADIMIT',
  'DOKUMENTET_SIPAS_PUNONJESIT',
  'TEMPLATES_TE_PERDORURA',
  'LARGIMET_SIPAS_MUAJIT',
  'LARGIMET_SIPAS_ARSYEVE',
  'FINAL_PAYROLL_REPORTS',
  'DOKUMENTET_E_LARGIMIT'
);

-- CreateEnum
CREATE TYPE "ReportExportAction" AS ENUM (
  'GENERATED',
  'DOWNLOADED',
  'REGENERATED',
  'ARCHIVED',
  'PREVIEWED'
);

-- CreateTable
CREATE TABLE "generated_reports" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "report_type" "ReportType" NOT NULL,
    "title" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_format" "ReportOutputFormat" NOT NULL,
    "filters_json" JSONB NOT NULL,
    "generated_by" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "rowCount" INTEGER,
    "previewTruncated" BOOLEAN NOT NULL DEFAULT false,
    "filter_payroll_id" TEXT,
    "filter_year" INTEGER,
    "filter_month" INTEGER,
    "filter_department_id" TEXT,
    "filter_employee_id" TEXT,

    CONSTRAINT "generated_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_export_logs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "generated_report_id" TEXT NOT NULL,
    "action" "ReportExportAction" NOT NULL,
    "performed_by" TEXT,
    "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata_json" JSONB,

    CONSTRAINT "report_export_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "generated_reports_company_id_idx" ON "generated_reports"("company_id");

-- CreateIndex
CREATE INDEX "generated_reports_company_id_report_type_idx" ON "generated_reports"("company_id", "report_type");

-- CreateIndex
CREATE INDEX "generated_reports_company_id_generated_at_idx" ON "generated_reports"("company_id", "generated_at");

-- CreateIndex
CREATE INDEX "generated_reports_file_format_idx" ON "generated_reports"("file_format");

-- CreateIndex
CREATE INDEX "generated_reports_company_id_is_archived_idx" ON "generated_reports"("company_id", "is_archived");

-- CreateIndex
CREATE INDEX "generated_reports_company_id_filter_payroll_id_idx" ON "generated_reports"("company_id", "filter_payroll_id");

-- CreateIndex
CREATE INDEX "generated_reports_company_id_filter_year_filter_month_idx" ON "generated_reports"("company_id", "filter_year", "filter_month");

-- CreateIndex
CREATE INDEX "report_export_logs_company_id_idx" ON "report_export_logs"("company_id");

-- CreateIndex
CREATE INDEX "report_export_logs_company_id_generated_report_id_performed_at_idx" ON "report_export_logs"("company_id", "generated_report_id", "performed_at");

-- AddForeignKey
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_export_logs" ADD CONSTRAINT "report_export_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_export_logs" ADD CONSTRAINT "report_export_logs_generated_report_id_fkey" FOREIGN KEY ("generated_report_id") REFERENCES "generated_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_export_logs" ADD CONSTRAINT "report_export_logs_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
