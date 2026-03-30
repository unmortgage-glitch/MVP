// src/intelligence/docExtractor.js — Kenward CMS v2
// Wraps aiGateway.js for mortgage document extraction.
// Two Gemini passes per document: (1) field extraction, (2) authenticity assessment.
// Results are merged and returned as a single structured object.
//
// Returns:
// {
//   fields: {
//     fieldName: { value: any, confidence: "high"|"medium"|"low"|"not_found" },
//     ...
//     authenticity_score:      { value: number, confidence: "high" },
//     expected_fields_present: { value: boolean, confidence: "high" },
//   },
//   authenticityScore:        number,
//   expectedFieldsPresent:    boolean,
//   authenticityFlags:        string[],
//   raw: { extraction: object, authenticity: object },
// }

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getPromptForDocType, getAuthenticityPrompt } from './promptTemplates.js';

// ─── Gemini client ────────────────────────────────────────────────────────────

const get_model = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('[docExtractor] GEMINI_API_KEY is not set');
  const genai = new GoogleGenerativeAI(key);
  return genai.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  });
};

// ─── Mime type normalizer ─────────────────────────────────────────────────────

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const normalize_mime = (mimeType) => {
  const m = (mimeType ?? '').toLowerCase().trim();
  if (m === 'image/jpg') return 'image/jpeg';
  if (!SUPPORTED_MIME_TYPES.has(m)) {
    throw new Error(`[docExtractor] Unsupported mime type: "${mimeType}"`);
  }
  return m;
};

// ─── JSON cleaner ─────────────────────────────────────────────────────────────

const clean_json = (text) =>
  text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/,      '')
    .replace(/\s*```$/,      '')
    .trim();

// ─── Single Gemini pass ───────────────────────────────────────────────────────

/**
 * Send a buffer + prompt to Gemini and return parsed JSON.
 *
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @param {string} prompt
 * @returns {Promise<object>}
 */
const gemini_pass = async (buffer, mimeType, prompt) => {
  const model      = get_model();
  const base64Data = buffer.toString('base64');

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: normalize_mime(mimeType),
        data:     base64Data,
      },
    },
    { text: prompt },
  ]);

  const raw_text = result.response.text();
  return JSON.parse(clean_json(raw_text));
};

// ─── extractDoc ───────────────────────────────────────────────────────────────

/**
 * Extract fields and assess authenticity for a mortgage document.
 * Makes two Gemini passes: one for extraction, one for authenticity.
 * Authenticity results are merged into the fields object.
 *
 * @param {Buffer} buffer    — raw file buffer
 * @param {string} mimeType  — e.g. 'application/pdf', 'image/jpeg'
 * @param {string} docType   — e.g. 't4', 'paystub', 'photo_id'
 * @returns {Promise<{
 *   fields:                 object,
 *   authenticityScore:      number,
 *   expectedFieldsPresent:  boolean,
 *   authenticityFlags:      string[],
 *   raw:                    { extraction: object, authenticity: object },
 * }>}
 */
export const extractDoc = async (buffer, mimeType, docType) => {
  // ── Pass 1: Field extraction ──────────────────────────────────────────────
  let extraction = {};
  let extraction_error = null;

  try {
    const extraction_prompt = getPromptForDocType(docType);
    extraction = await gemini_pass(buffer, mimeType, extraction_prompt);
  } catch (err) {
    console.error(`[docExtractor] Extraction pass failed (${docType}):`, err.message);
    extraction_error = err.message;
    extraction = {};
  }

  // ── Pass 2: Authenticity assessment ──────────────────────────────────────
  let authenticity = {};
  let authenticity_error = null;

  try {
    const auth_prompt = getAuthenticityPrompt(docType);
    authenticity = await gemini_pass(buffer, mimeType, auth_prompt);
  } catch (err) {
    console.error(`[docExtractor] Authenticity pass failed (${docType}):`, err.message);
    authenticity_error = err.message;
    // Graceful fallback: assume low authenticity if assessment fails
    authenticity = {
      authenticity_score:      0.5,
      expected_fields_present: false,
      flags: [authenticity_error ? `Authenticity check failed: ${authenticity_error}` : 'Assessment unavailable'],
    };
  }

  const authenticity_score     = typeof authenticity.authenticity_score === 'number'
    ? Math.max(0, Math.min(1, authenticity.authenticity_score))
    : 0.5;

  const expected_fields_present = authenticity.expected_fields_present === true;
  const flags                   = Array.isArray(authenticity.flags) ? authenticity.flags : [];

  // ── Merge authenticity into fields ────────────────────────────────────────
  const merged_fields = {
    ...extraction,
    authenticity_score:      { value: authenticity_score,     confidence: 'high' },
    expected_fields_present: { value: expected_fields_present, confidence: 'high' },
  };

  return {
    fields:                merged_fields,
    authenticityScore:     authenticity_score,
    expectedFieldsPresent: expected_fields_present,
    authenticityFlags:     flags,
    raw: {
      extraction,
      authenticity,
      ...(extraction_error   ? { extraction_error }   : {}),
      ...(authenticity_error ? { authenticity_error } : {}),
    },
  };
};
