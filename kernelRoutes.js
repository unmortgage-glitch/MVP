// src/routes/kernelRoutes.js — Kenward CMS v2
// Loads all .bas scripts from scripts/mortgage/ on startup.
// Compiled ASTs cached in script_cache Map — shared with uploadRoutes via server.js.
//
// Routes (mounted at /api/v2 in server.js):
//   POST /api/v2/run            — run any cached script by scriptId
//   POST /api/v2/affordability  — binary-search max qualifying amount
//   POST /api/v2/reload         — reload scripts from disk (Gitea webhook)

import express   from 'express';
import { readdir, readFile } from 'fs/promises';
import path      from 'path';
import { fileURLToPath } from 'url';

import { compileBas }             from '../logic/compiler/briefCompiler.js';
import { runScript }              from '../logic/engine/kernelExecutor.js';
import { findMaxPermittedValue }  from '../logic/solver/binarySearch.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const SCRIPTS_DIR = path.join(__dirname, '..', '..', 'scripts', 'mortgage');

// ─── Script cache ─────────────────────────────────────────────────────────────
// Exported so server.js can pass it to createUploadRouter(script_cache).

export const script_cache = new Map();

// ─── Loader ───────────────────────────────────────────────────────────────────

/**
 * Read, compile, and cache all .bas files in SCRIPTS_DIR.
 * Logs any files that fail to compile without halting the server.
 */
const load_scripts = async () => {
  try {
    const files = (await readdir(SCRIPTS_DIR)).filter(f => f.endsWith('.bas'));

    await Promise.all(files.map(async (file) => {
      const script_id = file.replace(/\.bas$/, '');
      try {
        const source   = await readFile(path.join(SCRIPTS_DIR, file), 'utf8');
        const compiled = compileBas(source);
        script_cache.set(script_id, compiled);
        console.log(`[kernelRoutes] Loaded script: ${script_id}`);
      } catch (err) {
        console.error(`[kernelRoutes] Failed to compile ${file}: ${err.message}`);
      }
    }));

    console.log(`[kernelRoutes] ${script_cache.size} script(s) cached.`);
  } catch (err) {
    // SCRIPTS_DIR may not exist yet — not fatal
    if (err.code !== 'ENOENT') {
      console.error('[kernelRoutes] Script load error:', err.message);
    } else {
      console.warn(`[kernelRoutes] scripts/mortgage/ not found — no scripts loaded.`);
    }
  }
};

// Load immediately on module import (server startup)
await load_scripts();

// ─── Router ───────────────────────────────────────────────────────────────────

const router = express.Router();

// ── POST /api/v2/run ──────────────────────────────────────────────────────────
// Run any compiled script by ID against supplied entity data.
// Body: { scriptId: string, entityData: object }
router.post('/run', (req, res) => {
  const { scriptId, entityData } = req.body;

  if (!scriptId)    return res.status(400).json({ error: 'scriptId is required' });
  if (!entityData)  return res.status(400).json({ error: 'entityData is required' });

  const compiled = script_cache.get(scriptId);
  if (!compiled) {
    return res.status(404).json({
      error: `Script not found: "${scriptId}"`,
      available: [...script_cache.keys()],
    });
  }

  try {
    const result = runScript(compiled, entityData);
    res.json({ ok: true, scriptId, result });
  } catch (err) {
    console.error(`[POST /run] scriptId=${scriptId}`, err);
    res.status(500).json({ error: 'Script execution failed', detail: err.message });
  }
});

// ── POST /api/v2/affordability ────────────────────────────────────────────────
// Binary-search the maximum qualifying loan amount constrained by GDS and TDS.
//
// Body: {
//   annual_income:      number,
//   monthly_debts:      number,
//   monthly_heat:       number,
//   monthly_taxes:      number,   (optional, default 300)
//   monthly_condo_fee:  number,   (optional, default 0)
//   interest_rate:      number,   (decimal, e.g. 0.0525)
//   amortization_years: number,   (default 25)
// }
//
// Returns: { maxMortgage, monthlyPayment, gds, tds, qualifyingRate, status }
router.post('/affordability', (req, res) => {
  const {
    annual_income,
    monthly_debts     = 0,
    monthly_heat      = 150,
    monthly_taxes     = 300,
    monthly_condo_fee = 0,
    interest_rate,
    amortization_years = 25,
  } = req.body;

  if (!annual_income || !interest_rate) {
    return res.status(400).json({ error: 'annual_income and interest_rate are required' });
  }

  const gds_script = script_cache.get('gds_tds');
  if (!gds_script) {
    return res.status(503).json({
      error: 'GDS/TDS script not loaded. Ensure scripts/mortgage/gds_tds.bas exists.',
    });
  }

  try {
    const monthly_income = annual_income / 12;

    // Canadian stress test: max(contract + 2%, 5.25%)
    const qualifying_rate = Math.max(interest_rate + 0.02, 0.0525);

    // Scorer: given a loan amount, return the binding ratio (max of GDS, TDS)
    const scorer = (loan_amount) => {
      const result = runScript(gds_script, {
        annual_income,
        loan_amount,
        monthly_debts,
        monthly_heat,
        monthly_taxes,
        monthly_condo_fee,
        contract_rate: interest_rate,
        amortization_years,
      });

      // If the script errors, return a high ratio to exclude this loan amount
      if (!result.success && result.status === 'FAIL' &&
          result.failed_check !== 'gds_within_limit' &&
          result.failed_check !== 'tds_within_limit') {
        return 999;
      }

      // Use computed ratios from results, falling back to a live calculation
      const gds = result.results.gds_ratio ?? 1;
      const tds = result.results.tds_ratio ?? 1;
      return Math.max(gds, tds);
    };

    // Search up to 3× annual income (generous upper bound)
    const find_max = findMaxPermittedValue(scorer);
    const max_mortgage = find_max({
      targetScore: 0.44,   // TDS limit (binding constraint)
      low:         0,
      high:        annual_income * 3,
      precision:   100,
    });

    // Run one final clean pass at the found max for display values
    const final_result = runScript(gds_script, {
      annual_income,
      loan_amount:        max_mortgage,
      monthly_debts,
      monthly_heat,
      monthly_taxes,
      monthly_condo_fee,
      contract_rate:      interest_rate,
      amortization_years,
    });

    const monthly_payment = final_result.results.monthly_payment ?? null;
    const gds = final_result.results.gds_ratio ?? null;
    const tds = final_result.results.tds_ratio ?? null;

    res.json({
      ok:             true,
      maxMortgage:    Math.round(max_mortgage / 100) * 100,
      monthlyPayment: monthly_payment ? Math.round(monthly_payment) : null,
      gds:            gds    ? Math.round(gds * 10000) / 100 : null,
      tds:            tds    ? Math.round(tds * 10000) / 100 : null,
      qualifyingRate: Math.round(qualifying_rate * 10000) / 100,
      status:         final_result.status,
      warnings:       final_result.warnings,
    });

  } catch (err) {
    console.error('[POST /affordability]', err);
    res.status(500).json({ error: 'Affordability calculation failed', detail: err.message });
  }
});

// ── POST /api/v2/reload ───────────────────────────────────────────────────────
// Reload all scripts from disk. Called by Gitea webhook on push to main.
// No auth — restrict at nginx level if needed.
router.post('/reload', async (req, res) => {
  script_cache.clear();
  await load_scripts();
  res.json({ ok: true, loaded: [...script_cache.keys()] });
});

export default router;
