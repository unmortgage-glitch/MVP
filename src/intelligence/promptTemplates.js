// src/intelligence/promptTemplates.js — Kenward CMS v2
// Prompt templates for Gemini document extraction and authenticity assessment.
// All functions return plain strings. No I/O. No side effects.
//
// Each extraction prompt instructs Gemini to return JSON only:
//   { fieldName: { value: any, confidence: "high"|"medium"|"low"|"not_found" } }
//
// Authenticity prompts return:
//   { authenticity_score: number (0-1), expected_fields_present: boolean, flags: string[] }

// ─── Shared instruction preamble ──────────────────────────────────────────────

const JSON_ONLY_PREAMBLE = `
You are a mortgage document extraction engine.
OUTPUT RULES (strictly enforced):
- Return ONLY valid JSON. No markdown. No backticks. No explanations.
- Every field must use this exact shape: { "value": <extracted_value>, "confidence": "<level>" }
- confidence levels: "high" (clearly visible), "medium" (inferred/partially visible), "low" (uncertain), "not_found" (absent)
- If a field is not present in the document, use: { "value": null, "confidence": "not_found" }
- Do not add fields not listed in the schema.
- Convert dollar amounts to plain numbers (e.g. "$95,000" → 95000).
- Convert dates to ISO 8601 format (YYYY-MM-DD).
`.trim();

// ─── Extraction prompts (per doc type) ───────────────────────────────────────

/**
 * T4 — Statement of Remuneration Paid
 */
const t4Prompt = () => `
${JSON_ONLY_PREAMBLE}

DOCUMENT TYPE: T4 Slip (Canada Revenue Agency — Statement of Remuneration Paid)

Extract the following fields:
{
  "employer_name":        { "value": "string",  "confidence": "..." },
  "employment_income":    { "value": number,     "confidence": "..." },
  "tax_year":             { "value": number,     "confidence": "..." },
  "employee_sin_partial": { "value": "string",   "confidence": "..." },
  "ei_insurable_earnings":{ "value": number,     "confidence": "..." },
  "income_tax_deducted":  { "value": number,     "confidence": "..." }
}

Notes:
- employment_income is Box 14
- income_tax_deducted is Box 22
- ei_insurable_earnings is Box 24
- Return only the last 3 digits of SIN as employee_sin_partial for privacy
`.trim();

/**
 * NOA — Notice of Assessment (CRA)
 */
const noaPrompt = () => `
${JSON_ONLY_PREAMBLE}

DOCUMENT TYPE: Notice of Assessment (Canada Revenue Agency)

Extract the following fields:
{
  "total_income":         { "value": number,   "confidence": "..." },
  "net_income":           { "value": number,   "confidence": "..." },
  "taxable_income":       { "value": number,   "confidence": "..." },
  "tax_year":             { "value": number,   "confidence": "..." },
  "refund_or_balance":    { "value": number,   "confidence": "..." },
  "rrsp_deduction_limit": { "value": number,   "confidence": "..." }
}

Notes:
- total_income is line 15000
- net_income is line 23600
- taxable_income is line 26000
- A negative refund_or_balance means the taxpayer owes money
`.trim();

/**
 * Pay stub
 */
const paystubPrompt = () => `
${JSON_ONLY_PREAMBLE}

DOCUMENT TYPE: Pay Stub / Pay Statement

Extract the following fields:
{
  "employer_name":        { "value": "string", "confidence": "..." },
  "employee_name":        { "value": "string", "confidence": "..." },
  "pay_period_end":       { "value": "YYYY-MM-DD", "confidence": "..." },
  "gross_pay_period":     { "value": number,   "confidence": "..." },
  "gross_pay_ytd":        { "value": number,   "confidence": "..." },
  "pay_frequency":        { "value": "string", "confidence": "..." },
  "hourly_rate":          { "value": number,   "confidence": "..." },
  "overtime_ytd":         { "value": number,   "confidence": "..." },
  "bonus_ytd":            { "value": number,   "confidence": "..." }
}

Notes:
- pay_frequency should be one of: "weekly", "biweekly", "semi-monthly", "monthly"
- Annualize gross_pay_period based on pay_frequency if gross_pay_ytd is not present
- Use null for fields not visible (overtime, bonus if not applicable)
`.trim();

/**
 * T2 — Corporate Income Tax Return (Self-Employed)
 */
const t2Prompt = () => `
${JSON_ONLY_PREAMBLE}

DOCUMENT TYPE: T2 Corporate Income Tax Return (Canada)

Extract the following fields:
{
  "business_name":        { "value": "string", "confidence": "..." },
  "tax_year_end":         { "value": "YYYY-MM-DD", "confidence": "..." },
  "net_income_before_tax":{ "value": number,   "confidence": "..." },
  "total_revenue":        { "value": number,   "confidence": "..." },
  "total_salaries_wages": { "value": number,   "confidence": "..." },
  "retained_earnings":    { "value": number,   "confidence": "..." }
}

Notes:
- net_income_before_tax is Schedule 1, line 300
- This is a corporate return — income figures reflect the corporation, not the individual
`.trim();

/**
 * Bank statement
 */
const bankStatementPrompt = () => `
${JSON_ONLY_PREAMBLE}

DOCUMENT TYPE: Bank Statement

Extract the following fields:
{
  "institution_name":     { "value": "string", "confidence": "..." },
  "account_holder_name":  { "value": "string", "confidence": "..." },
  "account_type":         { "value": "string", "confidence": "..." },
  "statement_start_date": { "value": "YYYY-MM-DD", "confidence": "..." },
  "statement_end_date":   { "value": "YYYY-MM-DD", "confidence": "..." },
  "opening_balance":      { "value": number,   "confidence": "..." },
  "closing_balance":      { "value": number,   "confidence": "..." },
  "average_balance":      { "value": number,   "confidence": "..." },
  "account_address":      { "value": "string", "confidence": "..." }
}

Notes:
- account_type should be one of: "chequing", "savings", "TFSA", "RRSP", "other"
- average_balance: compute as (opening + closing) / 2 if not shown
- account_address is the address shown on the statement for the account holder
`.trim();

/**
 * Government-issued photo ID
 */
const photoIdPrompt = () => `
${JSON_ONLY_PREAMBLE}

DOCUMENT TYPE: Government-Issued Photo ID (driver's licence or passport)

Extract the following fields:
{
  "full_name":            { "value": "string",      "confidence": "..." },
  "date_of_birth":        { "value": "YYYY-MM-DD",  "confidence": "..." },
  "expiry_date":          { "value": "YYYY-MM-DD",  "confidence": "..." },
  "id_type":              { "value": "string",      "confidence": "..." },
  "issuing_jurisdiction": { "value": "string",      "confidence": "..." },
  "address":              { "value": "string",      "confidence": "..." }
}

Notes:
- id_type should be "drivers_licence" or "passport"
- issuing_jurisdiction: province for licences (e.g. "BC"), country for passports (e.g. "Canada")
- address: may not be present on passport — use null if absent
- Do NOT extract or return the ID number or licence number
`.trim();

/**
 * Void cheque
 */
const voidChequePrompt = () => `
${JSON_ONLY_PREAMBLE}

DOCUMENT TYPE: Void Cheque

Extract the following fields:
{
  "institution_name":  { "value": "string", "confidence": "..." },
  "account_holder":    { "value": "string", "confidence": "..." },
  "transit_number":    { "value": "string", "confidence": "..." },
  "institution_number":{ "value": "string", "confidence": "..." },
  "account_number":    { "value": "string", "confidence": "..." }
}

Notes:
- The MICR line at the bottom contains: transit number (5 digits), institution number (3 digits), account number
- transit_number and institution_number together form the routing code
`.trim();

// ─── Authenticity prompts ─────────────────────────────────────────────────────

/**
 * Authenticity assessment prompt for any document type.
 * @param {string} docType — e.g. 't4', 'paystub'
 * @returns {string}
 */
export const getAuthenticityPrompt = (docType) => `
You are a mortgage document fraud detection engine.
OUTPUT RULES (strictly enforced):
- Return ONLY valid JSON. No markdown. No backticks. No explanations.

DOCUMENT TYPE: ${docType}

Assess the authenticity of this document and return:
{
  "authenticity_score":        <number between 0.0 and 1.0>,
  "expected_fields_present":   <true | false>,
  "flags": [
    "<description of any concern>"
  ]
}

Scoring guidance:
- 1.0 = clearly authentic, all expected fields present, no anomalies
- 0.8–0.99 = minor issues (low resolution, partial visibility) but likely authentic
- 0.5–0.79 = suspicious — inconsistent fonts, missing fields, unusual formatting
- 0.0–0.49 = likely fraudulent — clear signs of tampering, template mismatch, inconsistency

Assess for:
- Font consistency throughout the document
- Correct CRA / government logo and formatting (for T4, NOA)
- Presence of all fields expected for this document type
- Date consistency (dates should be internally consistent)
- Logo / watermark / security features appropriate for the document type
- Signs of digital manipulation (sharp cut edges, inconsistent alignment)
- Metadata visible in image (shadows, folding patterns suggest physical document — positive signal)

expected_fields_present: true only if all critical fields for ${docType} are clearly visible.
flags: list any specific concerns as short strings. Empty array if none.
`.trim();

// ─── Public router function ───────────────────────────────────────────────────

/**
 * Return the extraction prompt for a given document type.
 * @param {string} docType
 * @returns {string}
 * @throws if docType is unknown
 */
export const getPromptForDocType = (docType) => {
  const prompts = {
    t4:              t4Prompt,
    noa:             noaPrompt,
    paystub:         paystubPrompt,
    t2:              t2Prompt,
    bank_statement:  bankStatementPrompt,
    photo_id:        photoIdPrompt,
    void_cheque:     voidChequePrompt,
  };

  const fn = prompts[docType];
  if (!fn) throw new Error(`[promptTemplates] Unknown docType: "${docType}"`);
  return fn();
};
