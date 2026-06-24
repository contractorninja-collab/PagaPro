import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DOCUMENT_CATEGORY_LABELS } from "@/modules/documents/components/document-labels";
import { getDocumentTemplateDetail } from "@/modules/documents/services/document-queries";
import { resolveActiveCompanyId } from "@/server/company-scope";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const companyId = await resolveActiveCompanyId();
  if (!companyId) notFound();

  const { id } = await params;
  const template = await getDocumentTemplateDetail(companyId, id);
  if (!template) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{template.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {DOCUMENT_CATEGORY_LABELS[template.documentCategory]}
            {template.templateSubtype ? ` · ${template.templateSubtype}` : ""}
          </p>
        </div>
        <Button variant="secondary" asChild>
          <Link href="/dokumentet/templates">Shabllonet</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Versionet</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Versioni</TableHead>
                <TableHead>Detektimi</TableHead>
                <TableHead>Mapuar</TableHead>
                <TableHead>Publikuar</TableHead>
                <TableHead className="text-right">Veprime</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {template.versions.map((v) => {
                const blankCount = Array.isArray(v.detectedBlankFields)
                  ? v.detectedBlankFields.length
                  : 0;
                return (
                  <TableRow key={v.id}>
                    <TableCell>v{v.versionNumber}</TableCell>
                    <TableCell className="text-sm">
                      {v.detectionMode ?? "—"}
                      <span className="block text-xs text-muted-foreground">
                        {blankCount} bosh ·{" "}
                        {Array.isArray(v.detectedPlaceholders) ? v.detectedPlaceholders.length : 0}{" "}
                        tags
                      </span>
                    </TableCell>
                    <TableCell>{v.isMapped ? "Po" : "Jo"}</TableCell>
                    <TableCell>{v.isPublished ? "Po" : "Jo"}</TableCell>
                    <TableCell className="text-right">
                      {blankCount > 0 || v.detectionMode === "MIXED" ? (
                        <Button variant="secondary" size="sm" asChild>
                          <Link href={`/dokumentet/templates/${template.id}/mapping?versionId=${v.id}`}>
                            Mapo fushat
                          </Link>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
