// src/system/auditWriter.js — Kenward CMS v2
// Hash-chained append-only audit ledger.
// One JSON object per line (NDJSON) at data/tenants/{tenantId}/audit/ledger.ndjson
// Chain: each entry hashes the previous entry. Genesis prev_hash = 64 zeros.
// Signature: RSA-4096 sign of entry_hash using key at privateKeyPath.

import { readFile, appendFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { createHash, createSign, createVerify } from 'crypto';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_ROOT = path.join(__dirname, '..', '..', 'data', 'tenants');

const GENESIS_HASH = '0'.repeat(64);

// ─── Path helpers ─────────────────────────────────────────────────────────────

const ledgerPath = (tenantId) =>
  path.join(DATA_ROOT, tenantId, 'audit', 'ledger.ndjson');

const auditDir = (tenantId) =>
  path.join(DATA_ROOT, tenantId, 'audit');

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const sha256 = (str) =>
  createHash('sha256').update(str).digest('hex');

const signHash = (hash, privateKeyPem) => {
  const signer = createSign('RSA-SHA256');
  signer.update(hash);
  signer.end();
  return signer.sign(privateKeyPem, 'hex');
};

const verifySignature = (hash, signature, publicKeyPem) => {
  try {
    const verifier = createVerify('RSA-SHA256');
    verifier.update(hash);
    verifier.end();
    return verifier.verify(publicKeyPem, signature, 'hex');
  } catch {
    return false;
  }
};

// ─── Read last entry hash ─────────────────────────────────────────────────────

const getLastEntryHash = async (tenantId) => {
  const lp = ledgerPath(tenantId);
  if (!existsSync(lp)) return GENESIS_HASH;

  const raw = await readFile(lp, 'utf8');
  const lines = raw.trim().split('\n').filter(Boolean);
  if (lines.length === 0) return GENESIS_HASH;

  const last = JSON.parse(lines[lines.length - 1]);
  return last.entry_hash;
};

// ─── writeEntry ───────────────────────────────────────────────────────────────

/**
 * Append a signed, hash-chained entry to the tenant audit ledger.
 *
 * @param {string} tenantId
 * @param {object} payload — event data to record
 * @param {string} privateKeyPath — path to RSA-4096 private key PEM file
 * @returns {Promise<{ ok: boolean, data?: object, error?: string }>}
 */
export const writeEntry = async (tenantId, payload, privateKeyPath) => {
  try {
    // Ensure audit directory exists
    await mkdir(auditDir(tenantId), { recursive: true });

    // Read private key
    const privateKeyPem = await readFile(privateKeyPath, 'utf8');

    // Get previous hash (or genesis)
    const prev_hash = await getLastEntryHash(tenantId);

    // Build entry core (what gets hashed)
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const entryCore = { id, timestamp, prev_hash, payload };
    const entry_hash = sha256(JSON.stringify(entryCore));

    // Sign the entry hash
    const signature = signHash(entry_hash, privateKeyPem);

    // Full entry
    const entry = { ...entryCore, entry_hash, signature };

    // Append to ledger as single NDJSON line
    await appendFile(ledgerPath(tenantId), JSON.stringify(entry) + '\n', 'utf8');

    return { ok: true, data: entry };
  } catch (err) {
    console.error('[auditWriter.writeEntry]', err.message);
    return { ok: false, error: err.message };
  }
};

// ─── verifyLedger ─────────────────────────────────────────────────────────────

/**
 * Re-hash every entry in the ledger and confirm chain integrity.
 * Optionally verify signatures if publicKeyPath is provided.
 *
 * @param {string} tenantId
 * @param {string} [publicKeyPath] — path to RSA-4096 public key PEM file (optional)
 * @returns {Promise<{ valid: boolean, broken_at: string|null, entries: number }>}
 */
export const verifyLedger = async (tenantId, publicKeyPath = null) => {
  const lp = ledgerPath(tenantId);
  if (!existsSync(lp)) return { valid: true, broken_at: null, entries: 0 };

  const raw = await readFile(lp, 'utf8');
  const lines = raw.trim().split('\n').filter(Boolean);
  if (lines.length === 0) return { valid: true, broken_at: null, entries: 0 };

  let publicKeyPem = null;
  if (publicKeyPath) {
    publicKeyPem = await readFile(publicKeyPath, 'utf8');
  }

  let expectedPrevHash = GENESIS_HASH;

  for (const line of lines) {
    const entry = JSON.parse(line);
    const { id, timestamp, prev_hash, payload, entry_hash, signature } = entry;

    // Check chain link
    if (prev_hash !== expectedPrevHash) {
      return { valid: false, broken_at: id, entries: lines.length };
    }

    // Re-derive entry hash
    const derived = sha256(JSON.stringify({ id, timestamp, prev_hash, payload }));
    if (derived !== entry_hash) {
      return { valid: false, broken_at: id, entries: lines.length };
    }

    // Verify signature if public key provided
    if (publicKeyPem && !verifySignature(entry_hash, signature, publicKeyPem)) {
      return { valid: false, broken_at: id, entries: lines.length };
    }

    expectedPrevHash = entry_hash;
  }

  return { valid: true, broken_at: null, entries: lines.length };
};
