// src/logic/docListResolver.js — Kenward CMS v2
// Pure function. Derives the required document list from questionnaire answers.
// No side effects. No I/O. Takes answers in, returns string[] out.
//
// Rules:
//   All borrowers:          photo_id, void_cheque, noa
//   Salaried / Contract:    + t4, paystub
//   Self-Employed:          + t2, bank_statement
//   Retired:                + noa (already included), t4 (pension T4)
//   Co-borrower:            + co_t4 or co_t2 depending on co_employment_type
//   Existing rental props:  + lease_agreement (if existing_properties > 0 and property_use includes rental)

/**
 * Resolve the required document list from questionnaire answers.
 *
 * @param {{
 *   employment_type:     'Salaried' | 'Self-Employed' | 'Contract' | 'Retired' | string,
 *   property_use?:       string,
 *   has_co_borrower?:    boolean,
 *   co_employment_type?: string,
 *   existing_properties?: number,
 * }} answers
 * @returns {string[]} ordered array of required doc type strings
 */
export const resolveDocList = (answers) => {
  const {
    employment_type,
    property_use       = '',
    has_co_borrower    = false,
    co_employment_type = null,
    existing_properties = 0,
  } = answers;

  // ── Base docs — every borrower ────────────────────────────────────────────
  const base = ['photo_id', 'void_cheque', 'noa'];

  // ── Primary income docs ───────────────────────────────────────────────────
  const income_docs = (() => {
    const et = (employment_type ?? '').trim();
    if (et === 'Salaried' || et === 'Contract') return ['t4', 'paystub'];
    if (et === 'Self-Employed')                  return ['t2', 'bank_statement'];
    if (et === 'Retired')                        return ['t4'];  // pension T4
    return [];
  })();

  // ── Co-borrower docs ──────────────────────────────────────────────────────
  const co_docs = (() => {
    if (!has_co_borrower) return [];
    const co = (co_employment_type ?? '').trim();
    if (co === 'Salaried' || co === 'Contract') return ['co_t4', 'co_paystub'];
    if (co === 'Self-Employed')                 return ['co_t2', 'co_bank_statement'];
    return ['co_t4'];  // default for unknown co-borrower type
  })();

  // ── Rental/existing property docs ─────────────────────────────────────────
  const rental_docs = (() => {
    const pu = (property_use ?? '').toLowerCase();
    const is_rental = pu.includes('rental') || pu.includes('investment');
    if (existing_properties > 0 && is_rental) return ['lease_agreement'];
    return [];
  })();

  // ── Deduplicate while preserving order ────────────────────────────────────
  const all = [...base, ...income_docs, ...co_docs, ...rental_docs];
  return [...new Set(all)];
};
