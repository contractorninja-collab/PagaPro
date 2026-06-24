import type {

  CalculationBreakdownPayload,

  EmployerPrimacy,

  LegislationSnapshot,

  PayrollFormulaLine,

  PayrollHrTransparency,

  PitBreakdown,

  PremiumRules,

} from "./types";

import { D } from "./money/decimal";

import { roundMoneyEUR } from "./money/rounding";



function formulaLine(label: string, formula: string, substitution: string, result: string): PayrollFormulaLine {

  return { label, formula, substitution, result };

}



function pitWithheldFromBreakdown(pit: PitBreakdown): string {

  return pit.pitWithheld;

}



function describePit(pit: PitBreakdown): string {

  switch (pit.atkRegime) {

    case "PRIMARY_PROGRESSIVE":

      return `Tatimi në të ardhura (PRIMARY): progresiv sipas shiritave në breakdown.pit.bracketSlices (baza tatimore sipas motorit ATK për periudhën).`;

    case "SECONDARY_FLAT_10":

      return `Tatimi dytësor: ${pit.pitBaseAmount} EUR × ${pit.flatRate} (baza: ${pit.pitBaseKind}).`;

    case "CONTRACTOR_EXEMPT":

      return `Kontraktor — përjashtim nga tatimi në këtë degë.`;

    default:

      return `Tatimi: ${JSON.stringify(pit)}`;

  }

}



export function buildPayrollHrTransparency(params: {

  employerPrimacy: EmployerPrimacy;

  compensationBasis: "GROSS_MONTHLY" | "TARGET_NET_MONTHLY";

  baseSalaryMonthly?: string;

  targetNetMonthly?: string | null;

  snapshot: LegislationSnapshot;

  calendar: PayrollHrTransparency["calendar"];

  buckets: {

    actualRegularHours: string;

    paidLeaveHours: string;

    sickLeaveHours: string;

    unpaidLeaveHours: string;

    overtimeHours: string;

    weekendHours: string;

    holidayHours: string;

    nightHours: string;

  };

  sickLeavePayPercent: string;

  premiumRules: PremiumRules;

  hourlyRate: string;

  amounts: {

    regularPay: string;

    paidLeavePay: string;

    sickLeavePay: string;

    unpaidLeaveDeduction: string;

    overtimeAmount: string;

    weekendAmount: string;

    holidayAmount: string;

    nightAmount: string;

    bonuses: string;

    grossSalary: string;

    employerTotalCost: string;

    netPay: string;

  };

  statutoryBreakdown: CalculationBreakdownPayload;

  /** Kur rrjedh nga spreadsheet-i: për ndarjen neto para pas tatimit vs pagesë finale (kol. ~23 vs ~25). */

  spreadsheetDeductions?: {

    otherDeductionsExAdvance: string;

    salaryAdvanceDeduction: string;

  };

}): PayrollHrTransparency {

  const ot = params.premiumRules.overtimeHourMultiplier ?? "1";

  const we = params.premiumRules.weekendHourMultiplier ?? "1";

  const ho = params.premiumRules.holidayHourMultiplier ?? "1";

  const nw = params.premiumRules.nightHourMultiplier ?? "1";



  const penE = params.snapshot.pensionEmployeeRate;

  const penEr = params.snapshot.pensionEmployerRate;



  const grossSubject = params.amounts.grossSalary;

  const penEmpAmt = params.statutoryBreakdown.pension.pensionEmployee;

  const penErAmt = params.statutoryBreakdown.pension.pensionEmployer;

  const taxableAmt = params.statutoryBreakdown.taxableIncome;

  const pitAmt = pitWithheldFromBreakdown(params.statutoryBreakdown.pit);



  const premiumSumDec = roundMoneyEUR(

    D(params.amounts.overtimeAmount)

      .plus(D(params.amounts.weekendAmount))

      .plus(D(params.amounts.holidayAmount))

      .plus(D(params.amounts.nightAmount)),

  );

  const premiumSumStr = premiumSumDec.toFixed(2);



  const hourlyDesc =

    params.compensationBasis === "TARGET_NET_MONTHLY"

      ? `Bruto mujore ekuivalente (nga netoja e synuar ${params.targetNetMonthly ?? "—"} EUR, primacy ${params.employerPrimacy}) ÷ ${params.calendar.expectedRegularHours} orë të pritura. Norma mbetet me presicion të plotë para shumëzimit me orë; rrumbullakimi në cent aplikohet vetëm te shumat e linjës së pagës.`

      : `Paga mujore bruto (${params.baseSalaryMonthly ?? "—"} EUR) ÷ ${params.calendar.expectedRegularHours} orë të pritura. Norma mbetet me presicion të plotë para shumëzimit me orë; rrumbullakimi në cent aplikohet vetëm te shumat e linjës së pagës.`;



  const rulesSummary = [

    `Për përputhje të renditur me një fletë klasike pagash, përdorni referenceSheetSteps dhe grossBuild në këtë objekt JSON.`,

    `Norma orare për motorin e spreadsheet-it: bruto ÷ orët e pritura, pa rrumbullakim në cent para shumëzimit me orët (logjika kol. 6 × kol. 7); çdo linjë pagë në EUR rrumbullakohet më pas në 2 dhjetore.`,

    `Orët e pritura mujore = ditët e punës (hën–pj, pa festat publike të përfshira në kalendar) × ${params.calendar.hoursPerWorkingDay} orë/ditë nga PayrollSettings.`,

    `Parashikimi mujor i overtime tejkalon pragun për sinjal kur është më i madh se ~${params.calendar.overtimeWarningWeeklyHours} orë/javë × 4.5 (konfigurueshëm).`,

    `Norma javore për përshkrimin ligjor të overtime në sistem: ${params.calendar.standardWeeklyHours} orë/javë (overtimeWeeklyThresholdHours).`,

    `Grupi «J» në fleta shpesh bashkon jashtë orarit dhe natën — në motor janë dy kolona: overtime × ${ot} dhe natë × ${nw} (normë_orare × orë × shumëzues).`,

    `Grupi «F» (festë / fundjavë) — në motor: fundjavë × ${we}, festë × ${ho}.`,

    `${params.calendar.weekendDefinition}`,

    `${params.calendar.holidayDefinition}`,

    `Natë (${params.calendar.nightWindowDescription}): shuma = normë_orare × orë_natë × ${nw}.`,

    `Pushimi i paguar (p.sh. vjetor nga leave requests të miratuara): pagë = normë_orare × orë_pushimi.`,

    `Pushimi pa pagë: zbritje = normë_orare × orë_papaguara.`,

    `Pushimi mjekësor: pagë = normë_orare × orë × ${params.sickLeavePayPercent} (sickLeavePayPercent në PayrollSettings).`,

  ];



  const grossExpansion = `${params.amounts.regularPay} + ${params.amounts.paidLeavePay} + ${params.amounts.sickLeavePay} + ${premiumSumStr} + ${params.amounts.bonuses} − ${params.amounts.unpaidLeaveDeduction}`;



  const reducesTaxBase = params.snapshot.pitRules.employeePensionReducesTaxableBase;

  const taxableSubstitution = reducesTaxBase

    ? `baza_tatimore = bruto_subjekt − pension_punonjës = ${grossSubject} − ${penEmpAmt}`

    : `baza_tatimore = bruto_subjekt (${grossSubject} EUR) — pensioni i punonjësit NUK zbritet nga baza sipas rregullave të periudhës`;



  const knownGapsVersusClassicSheet = [

    "Kolona K (kujdestari / on-call, +20%): nuk ekziston fushë ore në databazë ose në motor; premiumët janë vetëm overtime, fundjavë, festë dhe natë.",

    "Në Excel kolona 23 (netoja pas tatimit) dhe 25 (pagesë finale pas avansit) janë të ndara; në PagaPRO vlera `netPay` e ruajtur në breakdown është netoja finale pas tatimit dhe pas zbritjes së avansit dhe zbritjeve të tjera në para (një hap i kombinuar pas tatimit).",

    "Pushimet (të paguar / sëmurë / pa pagë) dhe bonuset përfshihen në ndërtimin e brutos përpara kontributeve tatimore; një fletë referuese mund t’i grupojë në nëntotal të ndryshëm — detajet janë te `grossBuild`, `leave` dhe `premiums`.",

  ];



  const referenceSheetSteps = [

    `1. Normë orare (bazë për kolonat me orë): llogaritet si në hourlyRate — rezultat ${params.hourlyRate} EUR/orë.`,

    `2. Bruto për orë të rregullta (~kol. 8): ${params.hourlyRate} × ${params.buckets.actualRegularHours} orë = ${params.amounts.regularPay} EUR.`,

    `3. Pushimi i paguar dhe mjekësori hyjnë në bruto para statutorit: ${params.amounts.paidLeavePay} EUR dhe ${params.amounts.sickLeavePay} EUR (shih leave.paid dhe leave.sick).`,

    `4. Paga bruto shtesë nga premiumët (~kol. 15): mbledhje additive overtime (${params.amounts.overtimeAmount} EUR, ×${ot}) + fundjavë (${params.amounts.weekendAmount} EUR, ×${we}) + festë (${params.amounts.holidayAmount} EUR, ×${ho}) + natë (${params.amounts.nightAmount} EUR, ×${nw}) = ${premiumSumStr} EUR.`,

    `5. Bonuset: +${params.amounts.bonuses} EUR.`,

    `6. Pushimi pa pagë: −${params.amounts.unpaidLeaveDeduction} EUR nga subjekti i brutos (shih unpaidLeaveAdjustment).`,

    `7. TOTALI bruto subjekt (~kol. 16): ${grossExpansion} = ${grossSubject} EUR (pas përjashtimit të ndryshimeve manuale të brutos nëse ka).`,

    `8. Pension punonjës (~kol. 17–19 në referencë): ${grossSubject} EUR × normë ${penE} = ${penEmpAmt} EUR.`,

    `9. Pension punëdhënës (~kol. 18–20 në referencë): ${grossSubject} EUR × normë ${penEr} = ${penErAmt} EUR.`,

    `10. Baza tatimore (~kol. 21): ${taxableSubstitution} → ${taxableAmt} EUR.`,

    `11. Tatimi (~kol. 22): ${pitAmt} EUR — ${describePit(params.statutoryBreakdown.pit)}`,

  ];



  let netAfterTaxAndPensionEmployee: PayrollFormulaLine | undefined;

  let postTaxCashDeductions: PayrollFormulaLine | undefined;



  if (params.spreadsheetDeductions) {

    const { otherDeductionsExAdvance, salaryAdvanceDeduction } = params.spreadsheetDeductions;

    const midNetDec = roundMoneyEUR(

      D(params.amounts.netPay).plus(D(otherDeductionsExAdvance)).plus(D(salaryAdvanceDeduction)),

    );

    const midNetStr = midNetDec.toFixed(2);



    referenceSheetSteps.push(

      `12. Netoja pas pensionit të punonjësit dhe tatimit, para zbritjeve në para (afërsisht kol. 23 në Excel): ${midNetStr} EUR (= neto_finale ${params.amounts.netPay} + zbritje_të_tjera ${otherDeductionsExAdvance} + avans ${salaryAdvanceDeduction}).`,

      `13. Zbritjet në para pas tatimit dhe netoja për pagesë (~kol. 24–25): − ${otherDeductionsExAdvance} EUR (të tjera) − ${salaryAdvanceDeduction} EUR (avans) → netoja finale ${params.amounts.netPay} EUR.`,

    );



    netAfterTaxAndPensionEmployee = formulaLine(

      "Neto pas tatimit dhe pensionit të punonjësit (para avansit)",

      "net_mid = net_pay_final + other_deductions_ex_advance + salary_advance",

      `${params.amounts.netPay} + ${otherDeductionsExAdvance} + ${salaryAdvanceDeduction}`,

      `${midNetStr} EUR`,

    );



    postTaxCashDeductions = formulaLine(

      "Zbritje pas tatimit dhe netoja finale",

      "net_pay_final = net_mid − other_deductions_ex_advance − salary_advance",

      `${midNetStr} − ${otherDeductionsExAdvance} − ${salaryAdvanceDeduction}`,

      `${params.amounts.netPay} EUR`,

    );

  } else {

    referenceSheetSteps.push(

      `12. Netoja për pagesë (pas pensionit të punonjësit, tatimit dhe zbritjeve në para të përfshira në motor): ${params.amounts.netPay} EUR.`,

    );

  }



  const netFormula = params.spreadsheetDeductions

    ? "net_pay_final = gross_subject − pension_employee − pit − other_deductions − salary_advance"

    : "net_pay pas pensionit të punonjësit dhe tatimit (shih breakdown.pit)";



  const netSubstitution = params.spreadsheetDeductions

    ? `Statutor: nga ${grossSubject} EUR deri në ${params.amounts.netPay} EUR (me zbritje në para të përfshira).`

    : `Motor statutor ATK — rezultat i aplicuar për këtë rresht.`;



  return {

    rulesSummary,

    referenceSheetSteps,

    grossBuild: {

      regularGross: formulaLine(

        "Bruto orë të rregullta (~kol. 8)",

        "regular_gross = hourly_rate × actual_regular_hours",

        `${params.hourlyRate} × ${params.buckets.actualRegularHours}`,

        `${params.amounts.regularPay} EUR`,

      ),

      premiumGrossTotal: formulaLine(

        "Paga bruto shtesë nga premiumët (~kol. 15)",

        "premium_total = overtime_pay + weekend_pay + holiday_pay + night_pay",

        `${params.amounts.overtimeAmount} + ${params.amounts.weekendAmount} + ${params.amounts.holidayAmount} + ${params.amounts.nightAmount}`,

        `${premiumSumStr} EUR`,

      ),

      bonuses: formulaLine(

        "Bonuse",

        "bonuses (EUR, shtesa në bruto subjekt)",

        params.amounts.bonuses,

        `${params.amounts.bonuses} EUR`,

      ),

      unpaidLeaveAdjustment: formulaLine(

        "Pushim pa pagë (zbritje)",

        "unpaid_leave_reduces_subject = hourly_rate × unpaid_leave_hours",

        `−${params.amounts.unpaidLeaveDeduction} EUR nga subjekti i brutos`,

        `${params.amounts.unpaidLeaveDeduction} EUR`,

      ),

      totalGrossSubject: formulaLine(

        "TOTALI subjekt bruto (~kol. 16)",

        "subject = regular + paid_leave + sick_leave + premium_total + bonuses − unpaid_leave",

        grossExpansion,

        `${grossSubject} EUR`,

      ),

    },

    taxableIncomeLine: formulaLine(

      "Paga që tatohet (~kol. 21)",

      reducesTaxBase

        ? "taxable_income = gross_subject − pension_employee"

        : "taxable_income = gross_subject (sipas pitRules të periudhës)",

      taxableSubstitution,

      `${taxableAmt} EUR`,

    ),

    pitLine: formulaLine(

      "Tatimi në të ardhura (~kol. 22)",

      "pit_withheld nga motori ATK për bazën tatimore",

      describePit(params.statutoryBreakdown.pit),

      `${pitAmt} EUR`,

    ),

    netAfterTaxAndPensionEmployee,

    postTaxCashDeductions,

    hourlyRate: formulaLine(

      "Normë orare",

      params.compensationBasis === "TARGET_NET_MONTHLY"

        ? "hourly_rate = equivalent_monthly_gross ÷ expected_regular_hours (presicion i plotë për shumëzim; linjat EUR me 2 dhjetore)"

        : "hourly_rate = monthly_gross ÷ expected_regular_hours (presicion i plotë për shumëzim; linjat EUR me 2 dhjetore)",

      hourlyDesc,

      `${params.hourlyRate} EUR/orë`,

    ),

    premiums: {

      overtime: formulaLine(

        "Overtime",

        "overtime_amount = hourly_rate × overtime_hours × overtime_multiplier",

        `(${params.hourlyRate}) × (${params.buckets.overtimeHours}) × (${ot})`,

        `${params.amounts.overtimeAmount} EUR`,

      ),

      weekend: formulaLine(

        "Fundjavë",

        "weekend_amount = hourly_rate × weekend_hours × weekend_multiplier",

        `(${params.hourlyRate}) × (${params.buckets.weekendHours}) × (${we})`,

        `${params.amounts.weekendAmount} EUR`,

      ),

      holiday: formulaLine(

        "Festë",

        "holiday_amount = hourly_rate × holiday_hours × holiday_multiplier",

        `(${params.hourlyRate}) × (${params.buckets.holidayHours}) × (${ho})`,

        `${params.amounts.holidayAmount} EUR`,

      ),

      night: formulaLine(

        "Natë",

        "night_amount = hourly_rate × night_hours × night_multiplier",

        `(${params.hourlyRate}) × (${params.buckets.nightHours}) × (${nw})`,

        `${params.amounts.nightAmount} EUR`,

      ),

    },

    leave: {

      paid: formulaLine(

        "Pushim i paguar",

        "paid_leave_pay = hourly_rate × paid_leave_hours",

        `(${params.hourlyRate}) × (${params.buckets.paidLeaveHours})`,

        `${params.amounts.paidLeavePay} EUR`,

      ),

      sick: formulaLine(

        "Pushim mjekësor",

        "sick_leave_pay = hourly_rate × sick_leave_hours × sick_leave_pay_percent",

        `(${params.hourlyRate}) × (${params.buckets.sickLeaveHours}) × (${params.sickLeavePayPercent})`,

        `${params.amounts.sickLeavePay} EUR`,

      ),

      unpaid: formulaLine(

        "Pushim pa pagë",

        "unpaid_leave_deduction = hourly_rate × unpaid_leave_hours",

        `(${params.hourlyRate}) × (${params.buckets.unpaidLeaveHours})`,

        `${params.amounts.unpaidLeaveDeduction} EUR`,

      ),

    },

    pensionEmployee: formulaLine(

      "Pension punonjës",

      "pension_employee = gross_subject × pension_employee_rate",

      `${grossSubject} EUR × ${penE}`,

      penEmpAmt,

    ),

    pensionEmployer: formulaLine(

      "Pension punëdhënës",

      "pension_employer = gross_subject × pension_employer_rate",

      `${grossSubject} EUR × ${penEr}`,

      penErAmt,

    ),

    pitNarrative: describePit(params.statutoryBreakdown.pit),

    netPay: formulaLine("Neto për pagesë", netFormula, netSubstitution, `${params.amounts.netPay} EUR`),

    employerTotalCost: formulaLine(

      "Kost total punëdhënës",

      "employer_total_cost ≈ gross_payroll_subject + pension_employer",

      `${params.amounts.grossSalary} EUR + ${params.statutoryBreakdown.pension.pensionEmployer} EUR`,

      `${params.amounts.employerTotalCost} EUR`,

    ),

    knownGapsVersusClassicSheet,

    calendar: params.calendar,

  };

}


