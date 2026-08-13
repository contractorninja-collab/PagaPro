import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import crypto from "node:crypto";
const { provisionCompany } = await import("./src/modules/admin/services/company-provisioning.ts");
const p=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});
const stamp = String(process.env.STAMP ?? "X");
const res:any = await provisionCompany({ legalName: `WIZ4-${stamp} SH.P.K.` } as any);
const companyId = res.companyId ?? res.id ?? res.company?.id;
// Attach the existing dev user so we can log in as this tenant.
const dev = await p.user.findFirst({ where: { email: { contains: "@" } }, select: { id: true } });
await p.userCompanyMembership.create({ data: { userId: dev!.id, companyId, role: "OWNER", isActive: true } });
const token = crypto.randomBytes(32).toString("hex");
await p.session.create({ data: { userId: dev!.id, tokenHash: crypto.createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now()+864e5) } });
console.log(JSON.stringify({ companyId, token, templates: res.templatesSeeded, warnings: res.warnings }));
await p.$disconnect();
