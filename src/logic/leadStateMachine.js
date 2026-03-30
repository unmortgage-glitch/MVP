// src/logic/leadStateMachine.js — Kenward CMS v2
// Pure functional lead lifecycle state machine. ESM. No classes. No DB calls.
// All functions take a lead object in and return a new lead object out.
//
// Stage order:
//   CALCULATOR → BOOKING → PRE_QUESTIONNAIRE → DOC_REQUEST →
//   DOC_UPLOAD → ASSEMBLY → SELF_ASSESSMENT → CONFIRMED

import { randomUUID } from 'crypto';

// ─── Stage definitions ────────────────────────────────────────────────────────

export const STAGES = [
  'CALCULATOR',
  'BOOKING',
  'PRE_QUESTIONNAIRE',
  'DOC_REQUEST',
  'DOC_UPLOAD',
  'ASSEMBLY',
  'SELF_ASSESSMENT',
  'CONFIRMED',
];

// Required fields that must be present before a stage transition is accepted.
// These guard against partial submissions advancing the pipeline prematurely.
const STAGE_REQUIRED_FIELDS = {
  BOOKING: ['borrowerName', 'email', 'preferredDate', 'preferredTime'],
  PRE_QUESTIONNAIRE: ['employmentType', 'propertyUse', 'bankruptcyHistory'],
  DOC_REQUEST: ['docList', 'uploadToken', 'uploadUrl'],
  DOC_UPLOAD: [],          // validated by upload route directly
  ASSEMBLY: [],            // triggered by system, not borrower
  SELF_ASSESSMENT: ['ratePreference', 'timeline'],
  CONFIRMED: [],
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Returns the numeric index of a stage in STAGES, or -1 if unknown.
 */
const stage_index = (stage) => STAGES.indexOf(stage);

/**
 * Returns true if toStage is a valid forward move from fromStage.
 * CALCULATOR has no predecessor — any fromStage of null or '' is valid.
 */
export const isValidTransition = (fromStage, toStage) => {
  const to   = stage_index(toStage);
  const from = fromStage ? stage_index(fromStage) : -1;
  return to !== -1 && to > from;
};

/**
 * Returns uncleared warnings on a lead.
 */
export const pendingWarns = (lead) =>
  (lead.warns ?? []).filter(w => !w.cleared);

/**
 * Returns true if the lead has no pending (uncleared) warnings.
 */
export const isWarnClear = (lead) => pendingWarns(lead).length === 0;

/**
 * Check that all required fields for the target stage are present in the
 * merged payload. Returns array of missing field names.
 */
const missing_fields = (toStage, data) => {
  const required = STAGE_REQUIRED_FIELDS[toStage] ?? [];
  return required.filter(f => data[f] === undefined || data[f] === null || data[f] === '');
};

// ─── createLead ───────────────────────────────────────────────────────────────

/**
 * Initialise a new lead record at CALCULATOR stage.
 *
 * @param {{
 *   tenantId:        string,
 *   annualIncome?:   number,
 *   downPayment?:    number,
 *   purchasePrice?:  number,
 *   monthlyDebts?:   number,
 *   employmentStatus?: string,
 *   isFirstTimeBuyer?: boolean,
 *   province?:       string,
 *   kernelResults?:  object,
 * }} data
 * @returns {object} lead
 */
export const createLead = (data) => {
  const now = new Date().toISOString();
  return Object.freeze({
    id:               randomUUID(),
    tenantId:         data.tenantId,
    stage:            'CALCULATOR',
    status:           'ACTIVE',
    warns:            [],
    history:          [{ stage: 'CALCULATOR', at: now }],
    createdAt:        now,
    updatedAt:        now,

    // Calculator inputs
    annualIncome:     data.annualIncome     ?? null,
    downPayment:      data.downPayment      ?? null,
    purchasePrice:    data.purchasePrice    ?? null,
    monthlyDebts:     data.monthlyDebts     ?? null,
    employmentStatus: data.employmentStatus ?? null,
    isFirstTimeBuyer: data.isFirstTimeBuyer ?? null,
    province:         data.province         ?? null,

    // Kernel results populated at CALCULATOR stage
    kernelResults:    data.kernelResults    ?? null,

    // Populated by later stages
    borrowerName:     null,
    email:            null,
    phone:            null,
    docs:             [],
  });
};

// ─── transitionLead ───────────────────────────────────────────────────────────

/**
 * Attempt to advance a lead to a new stage, merging in stage payload data.
 * Returns { ok: true, lead } or { ok: false, error, detail? }.
 *
 * Rules enforced:
 *   1. toStage must be a valid forward move.
 *   2. All pending WARNs must be cleared before advancing.
 *   3. Required fields for toStage must be present in the merged payload.
 *
 * @param {object} lead     — current immutable lead record
 * @param {string} toStage  — target stage name
 * @param {object} payload  — field data to merge into the lead
 * @returns {{ ok: boolean, lead?: object, error?: string, detail?: any }}
 */
export const transitionLead = (lead, toStage, payload = {}) => {
  if (!isValidTransition(lead.stage, toStage)) {
    return {
      ok:    false,
      error: `Invalid stage transition: ${lead.stage} → ${toStage}`,
    };
  }

  const pending = pendingWarns(lead);
  if (pending.length > 0) {
    return {
      ok:     false,
      error:  'Lead has uncleared warnings. Broker must attest before advancing.',
      detail: pending,
    };
  }

  const missing = missing_fields(toStage, { ...lead, ...payload });
  if (missing.length > 0) {
    return {
      ok:     false,
      error:  `Missing required fields for stage ${toStage}`,
      detail: missing,
    };
  }

  const now = new Date().toISOString();
  const updated = Object.freeze({
    ...lead,
    ...payload,
    stage:     toStage,
    status:    'ACTIVE',
    updatedAt: now,
    history:   [...lead.history, { stage: toStage, at: now }],
  });

  return { ok: true, lead: updated };
};

// ─── setWarn ──────────────────────────────────────────────────────────────────

/**
 * Add a warning to a lead and set status to WARN.
 *
 * @param {object} lead
 * @param {{ check: string, message: string, value?: any, source?: string, docType?: string }} warnEntry
 * @returns {object} updated lead
 */
export const setWarn = (lead, warnEntry) => {
  const now = new Date().toISOString();
  const warn = Object.freeze({
    id:        randomUUID(),
    message:   warnEntry.message,
    check:     warnEntry.check     ?? null,
    source:    warnEntry.source    ?? null,
    docType:   warnEntry.docType   ?? null,
    value:     warnEntry.value     ?? null,
    cleared:   false,
    createdAt: now,
  });

  return Object.freeze({
    ...lead,
    warns:     [...(lead.warns ?? []), warn],
    status:    'WARN',
    updatedAt: now,
  });
};

// ─── clearWarn ────────────────────────────────────────────────────────────────

/**
 * Mark a specific warning as cleared by a broker.
 * Returns { ok: true, lead, allCleared } or { ok: false, error }.
 *
 * @param {object} lead
 * @param {string} warnId
 * @param {string} brokerId
 * @returns {{ ok: boolean, lead?: object, allCleared?: boolean, error?: string }}
 */
export const clearWarn = (lead, warnId, brokerId) => {
  const warn = (lead.warns ?? []).find(w => w.id === warnId);

  if (!warn)        return { ok: false, error: 'Warning not found' };
  if (warn.cleared) return { ok: false, error: 'Warning already cleared' };

  const now = new Date().toISOString();
  const updated_warns = lead.warns.map(w =>
    w.id === warnId
      ? Object.freeze({ ...w, cleared: true, clearedBy: brokerId, clearedAt: now })
      : w
  );

  const all_cleared = updated_warns.every(w => w.cleared);

  const updated = Object.freeze({
    ...lead,
    warns:     updated_warns,
    status:    all_cleared ? 'ACTIVE' : 'WARN',
    updatedAt: now,
  });

  return { ok: true, lead: updated, allCleared: all_cleared };
};

// ─── isStageComplete ──────────────────────────────────────────────────────────

/**
 * Check whether all required fields for a given stage are populated on the lead.
 *
 * @param {object} lead
 * @param {string} stage
 * @returns {boolean}
 */
export const isStageComplete = (lead, stage) =>
  missing_fields(stage, lead).length === 0;
