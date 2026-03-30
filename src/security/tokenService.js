// src/security/tokenService.js — Kenward CMS v2
// JWT handling for two token types: session (broker) and upload (borrower).
// Secret from process.env.JWT_SECRET.
// Pure functions — no side effects beyond signing/verifying.

import jwt from 'jsonwebtoken';

const SESSION_EXPIRY = '8h';
const UPLOAD_EXPIRY  = '48h';

const secret = () => {
  if (!process.env.JWT_SECRET) throw new Error('[tokenService] JWT_SECRET is not set');
  return process.env.JWT_SECRET;
};

// ─── Session token (broker login) ─────────────────────────────────────────────

/**
 * Issue a session token for a broker.
 * @param {string} brokerId
 * @param {string} tenantId
 * @param {string} [role='broker']
 * @returns {string} signed JWT
 */
export const issueSessionToken = (brokerId, tenantId, role = 'broker') =>
  jwt.sign(
    { brokerId, tenantId, role, type: 'session' },
    secret(),
    { expiresIn: SESSION_EXPIRY }
  );

// Alias used by create-tenant.js
export const generateSessionToken = ({ brokerId, tenantId }) =>
  issueSessionToken(brokerId, tenantId, 'broker');

/**
 * Verify a session token.
 * @param {string} token
 * @returns {{ valid: boolean, tenantId?: string, brokerId?: string, role?: string }}
 */
export const verifySessionToken = (token) => {
  try {
    const decoded = jwt.verify(token, secret());
    if (decoded.type !== 'session') return { valid: false };
    return {
      valid: true,
      tenantId: decoded.tenantId,
      brokerId: decoded.brokerId,
      role:     decoded.role,
    };
  } catch {
    return { valid: false };
  }
};

// ─── Upload token (borrower doc portal) ───────────────────────────────────────

/**
 * Issue an upload token scoped to a lead and doc list.
 * @param {string} leadId
 * @param {string} tenantId
 * @param {string[]} docList — array of required doc type strings
 * @returns {string} signed JWT
 */
export const issueUploadToken = (leadId, tenantId, docList) =>
  jwt.sign(
    { leadId, tenantId, docList, type: 'upload' },
    secret(),
    { expiresIn: UPLOAD_EXPIRY }
  );

/**
 * Verify an upload token and confirm it matches the expected leadId.
 * @param {string} token
 * @param {string} leadId — expected lead ID to match against token payload
 * @returns {{ valid: boolean, tenantId?: string, leadId?: string, docList?: string[] }}
 */
export const verifyUploadToken = (token, leadId) => {
  try {
    const decoded = jwt.verify(token, secret());
    if (decoded.type !== 'upload') return { valid: false };
    if (decoded.leadId !== leadId) return { valid: false };
    return {
      valid:    true,
      tenantId: decoded.tenantId,
      leadId:   decoded.leadId,
      docList:  decoded.docList,
    };
  } catch {
    return { valid: false };
  }
};

/**
 * Generic token verifier — returns decoded payload or throws.
 * Used by route middleware that needs raw payload access.
 * @param {string} token
 * @returns {object} decoded JWT payload
 * @throws if invalid or expired
 */
export const verifyToken = (token) => jwt.verify(token, secret());
