import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveEmploymentWindow, countWorkingDaysInWindow } from "./src/modules/payroll/calculation/employment-window.ts";
const p=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});
const empId="cmravhbkj00013cuwpckjl0hg";

// Stage exactly the audited scenario: left 2026-08-14, returns 2026-11-02.
await p.employmentPeriod.deleteMany({where:{employeeId:empId}});
await p.employmentPeriod.createMany({data:[
  {companyId:"cmp1jvkmj00008cuwxrgqqn1u",employeeId:empId,startedAt:new Date(Date.UTC(2026,6,7)),endedAt:new Date(Date.UTC(2026,7,14)),reason:"HIRE"},
  {companyId:"cmp1jvkmj00008cuwxrgqqn1u",employeeId:empId,startedAt:new Date(Date.UTC(2026,10,2)),endedAt:null,reason:"REHIRE"},
]});
const e=await p.employee.findUnique({where:{id:empId},select:{hireDate:true,terminationDate:true,status:true}});
const periods=await p.employmentPeriod.findMany({where:{employeeId:empId},select:{startedAt:true,endedAt:true}});
console.log("row says:", JSON.stringify({...e}), "(terminationDate null, hireDate old — the columns hide the gap)");
for (const [label,y,m] of [["Aug 2026 (left mid-month)",2026,8],["Sep 2026 GAP",2026,9],["Oct 2026 GAP",2026,10],["Nov 2026 (returned on the 2nd)",2026,11]] as const) {
  const w=resolveEmploymentWindow({periods,hireDate:e!.hireDate,terminationDate:e!.terminationDate,monthStart:new Date(Date.UTC(y,m-1,1)),monthEnd:new Date(Date.UTC(y,m,0))});
  console.log(`${label}: employed=${w.employed} partial=${w.partial} workingDays=${countWorkingDaysInWindow(w,new Set())}`);
}
await p.$disconnect();
