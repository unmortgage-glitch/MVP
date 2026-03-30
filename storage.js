// src/system/storage.js — Kenward CMS v2
// Tenant-scoped file I/O. Pure async functions. No classes.
// All paths prefixed: data/tenants/{tenantId}/

import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_ROOT = path.join(__dirname, '..', '..', 'data', 'tenants');

// ─── Path helpers ─────────────────────────────────────────────────────────────

const leadPath = (tenantId, leadId) =>
  path.join(DATA_ROOT, tenantId, 'leads', `${leadId}.json`);

const leadsDir = (tenantId) =>
  path.join(DATA_ROOT, tenantId, 'leads');

const docPath = (tenantId, leadId, docType) =>
  path.join(DATA_ROOT, tenantId, 'docs', leadId, docType);

const docDir = (tenantId, leadId) =>
  path.join(DATA_ROOT, tenantId, 'docs', leadId);

// ─── Lead I/O ─────────────────────────────────────────────────────────────────

/**
 * Write a lead record to disk.
 * Creates the leads directory if it doesn't exist.
 * @returns {Promise<{ ok: boolean, data?: object, error?: string }>}
 */
export const saveLead = async (tenantId, lead) => {
  try {
    const dir = leadsDir(tenantId);
    await mkdir(dir, { recursive: true });
    await writeFile(leadPath(tenantId, lead.id), JSON.stringify(lead, null, 2), 'utf8');
    return { ok: true, data: lead };
  } catch (err) {
    console.error('[storage.saveLead]', err.message);
    return { ok: false, error: err.message };
  }
};

/**
 * Read a single lead by ID.
 * @returns {Promise<{ ok: boolean, data?: object, error?: string }>}
 */
export const readLead = async (tenantId, leadId) => {
  try {
    const raw = await readFile(leadPath(tenantId, leadId), 'utf8');
    return { ok: true, data: JSON.parse(raw) };
  } catch (err) {
    if (err.code === 'ENOENT') return { ok: false, error: 'Lead not found' };
    console.error('[storage.readLead]', err.message);
    return { ok: false, error: err.message };
  }
};

/**
 * List all leads for a tenant.
 * Returns empty array if directory doesn't exist yet.
 * @returns {Promise<{ ok: boolean, data?: object[], error?: string }>}
 */
export const readLeads = async (tenantId) => {
  try {
    const dir = leadsDir(tenantId);
    if (!existsSync(dir)) return { ok: true, data: [] };

    const files = await readdir(dir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    const leads = await Promise.all(
      jsonFiles.map(async (file) => {
        const raw = await readFile(path.join(dir, file), 'utf8');
        return JSON.parse(raw);
      })
    );

    // Sort newest first by createdAt
    leads.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return { ok: true, data: leads };
  } catch (err) {
    console.error('[storage.readLeads]', err.message);
    return { ok: false, error: err.message };
  }
};

// ─── Document I/O ─────────────────────────────────────────────────────────────

/**
 * Write a raw document buffer to tenant doc storage.
 * Path: data/tenants/{tenantId}/docs/{leadId}/{docType}
 * @returns {Promise<{ ok: boolean, data?: string, error?: string }>}
 */
export const saveDoc = async (tenantId, leadId, docType, buffer) => {
  try {
    const dir = docDir(tenantId, leadId);
    await mkdir(dir, { recursive: true });
    const filePath = docPath(tenantId, leadId, docType);
    await writeFile(filePath, buffer);
    return { ok: true, data: filePath };
  } catch (err) {
    console.error('[storage.saveDoc]', err.message);
    return { ok: false, error: err.message };
  }
};

/**
 * Read a raw document buffer from tenant doc storage.
 * @returns {Promise<{ ok: boolean, data?: Buffer, error?: string }>}
 */
export const readDoc = async (tenantId, leadId, docType) => {
  try {
    const buffer = await readFile(docPath(tenantId, leadId, docType));
    return { ok: true, data: buffer };
  } catch (err) {
    if (err.code === 'ENOENT') return { ok: false, error: 'Document not found' };
    console.error('[storage.readDoc]', err.message);
    return { ok: false, error: err.message };
  }
};
