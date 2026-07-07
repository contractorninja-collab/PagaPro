-- Add combined payslip bundle kind for mass printing
ALTER TYPE "PayrollDocumentKind" ADD VALUE IF NOT EXISTS 'PAYSLIPS_PRINT_BUNDLE';
