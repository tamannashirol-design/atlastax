// The mock reader's FAKE values (no Node imports, so dev fixtures in the browser can
// use them too: Review's ?review= states). SSN-like values only from the allowed list.
import type { FormType } from '../../src/extraction.config.ts'

// Fake values per form, keyed by field (src/extraction.config.ts). null = not on the form.
export const FAKE: Record<FormType, Record<string, string | null>> = {
  // FAKE, but realistic for an OPT student: wages, federal and state withholding, state NY
  'W-2': { employeeTaxId: '123-45-6789', employeeAddress: '123 Sample St Apt 4B, New York, NY 10001', employerName: 'Sample Employer Inc. (FAKE)', employerEin: '12-3456789', wages: '38450.00', federalWithheld: '3186.00', state: 'NY', stateWages: '38450.00', stateWithheld: '1893.00' },
  '1042-S': { withholdingAgent: 'Sample University', incomeCode: '16', grossIncome: '12000.00', exemptionCode: '04', taxRate: '00.00', federalWithheld: '0.00', recipientCountry: 'Sample Country' },
  '1099-INT': { payerName: 'Sample Bank', interest: '42.17', federalWithheld: '0.00' },
  '1099-NEC': { payerName: 'Sample Client LLC', payerTin: '98-7654321', compensation: '3500.00', federalWithheld: '0.00' },
  '1099-DIV': { payerName: 'Sample Brokerage', ordinaryDividends: '118.40', federalWithheld: '17.76' },
  '1099-B': { payerName: 'Sample Brokerage', proceeds: '5200.00', costBasis: '4950.00', federalWithheld: '0.00' },
  Passport: { firstName: 'SAMPLE', lastName: 'PERSON', passportNumber: 'X1234567', country: 'Sample Country', dateOfBirth: '2000-01-01', expires: '2031-01-01' },
  'I-94': { admissionNumber: '12345678901', classOfAdmission: 'F1', mostRecentEntry: '2025-08-15' },
  'State ID': { fullName: 'SAMPLE PERSON', state: 'CA', expires: '2030-01-01' },
  'Previous return': { taxYear: '2024', totalIncome: '18000.00', totalTax: '1700.00' },
}
/** In the normal results, these come back as "Please check" */
export const NORMALLY_LOW = new Set(['federalWithheld', 'exemptionCode', 'expires'])

