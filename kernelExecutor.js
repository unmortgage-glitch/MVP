// src/logic/engine/kernelExecutor.js — Kenward CMS v2
// Pure functional AST executor. ESM. No classes. No eval. No new Function.
//
// Execution pipeline:
//   1. Validate entity fields against input data
//   2. Load constants into resolution scope
//   3. Run CALCs in declaration order (each result available to subsequent blocks)
//   4. Run CHECKs — FAIL halts immediately, WARN is recorded and pipeline continues
//   5. Run DISPLAYs (only on PASS or WARN)
//
// Value resolution order: constants → calc results → entity data → literal number
//
// Result shape:
// {
//   success:  true | false,
//   status:   'PASS' | 'WARN' | 'FAIL',
//   results:  { [calcName]: value },
//   warnings: [ { check, message, value } ],
//   display:  { [displayName]: { [key]: value } },
//   audit:    [ { type, name, value|passed } ],
// }

// ─── Value resolution ─────────────────────────────────────────────────────────

/**
 * Resolve a name or literal through: constants → results → entity data → literal number.
 * Throws if value cannot be resolved.
 *
 * @param {string} token
 * @param {Map<string, number|string>} consts
 * @param {object} results
 * @param {object} data  — flattened entity input data
 * @returns {number|string|boolean}
 */
const resolve = (token, consts, results, data) => {
  // Boolean literals
  if (token === 'true')  return true;
  if (token === 'false') return false;

  // String literal (quoted)
  if (/^"[^"]*"$/.test(token) || /^'[^']*'$/.test(token)) {
    return token.slice(1, -1);
  }

  // JSON array literal (for IN operator)
  if (token.startsWith('[')) {
    try { return JSON.parse(token); } catch {}
  }

  // Constants (highest precedence)
  if (consts.has(token)) return consts.get(token);

  // CALC results
  if (Object.prototype.hasOwnProperty.call(results, token)) return results[token];

  // Entity data
  if (Object.prototype.hasOwnProperty.call(data, token)) return data[token];

  // Numeric literal
  const num = Number(token);
  if (Number.isFinite(num)) return num;

  throw new Error(`[kernelExecutor] Cannot resolve value: "${token}"`);
};

// ─── Frequency map for MORTGAGE_PAYMENT ──────────────────────────────────────

const FREQ_PPY = {
  annual:       1,
  semi_annual:  2,
  monthly:      12,
  semi_monthly: 24,
  biweekly:     26,
  daily:        365,
};

/**
 * Calculate periodic mortgage payment (Canadian standard by default).
 * Formula: EAR from compounding → period rate → standard amortisation PMT.
 *
 * @param {number} principal
 * @param {number} annual_rate  — decimal (e.g. 0.0525)
 * @param {number} amort_years
 * @param {string} payment_freq — default 'monthly'
 * @param {string} compound_freq — default 'semi_annual'
 * @returns {number}
 */
const mortgage_payment = (principal, annual_rate, amort_years, payment_freq = 'monthly', compound_freq = 'semi_annual') => {
  const compound_ppy = FREQ_PPY[compound_freq];
  const payment_ppy  = FREQ_PPY[payment_freq];

  if (!compound_ppy) throw new Error(`[kernelExecutor] Unknown compound frequency: "${compound_freq}"`);
  if (!payment_ppy)  throw new Error(`[kernelExecutor] Unknown payment frequency: "${payment_freq}"`);

  const ear = Math.pow(1 + annual_rate / compound_ppy, compound_ppy) - 1;
  const i   = Math.pow(1 + ear, 1 / payment_ppy) - 1;
  const n   = amort_years * payment_ppy;

  if (i === 0) return principal / n;

  return principal * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
};

// ─── OP dispatcher ────────────────────────────────────────────────────────────

/**
 * Execute a single CALC block OP.
 *
 * @param {{ op: string, raw: string }} calc
 * @param {Map} consts
 * @param {object} results
 * @param {object} data
 * @returns {number}
 */
const execute_op = (calc, consts, results, data) => {
  const r = (token) => resolve(token, consts, results, data);
  const { op, raw } = calc;

  switch (op) {

    case 'ADD': {
      const args = raw.split(',').map(s => r(s.trim()));
      return args.reduce((sum, v) => sum + v, 0);
    }

    case 'SUBTRACT': {
      const m = raw.match(/^(.+?)\s+BY\s+(.+)$/);
      if (!m) throw new Error(`[kernelExecutor] SUBTRACT syntax error: "${raw}"`);
      return r(m[1].trim()) - r(m[2].trim());
    }

    case 'MULTIPLY': {
      const m = raw.match(/^(.+?)\s+BY\s+(.+)$/);
      if (!m) throw new Error(`[kernelExecutor] MULTIPLY syntax error: "${raw}"`);
      return r(m[1].trim()) * r(m[2].trim());
    }

    case 'DIVIDE': {
      const m = raw.match(/^(.+?)\s+BY\s+(.+)$/);
      if (!m) throw new Error(`[kernelExecutor] DIVIDE syntax error: "${raw}"`);
      const divisor = r(m[2].trim());
      if (divisor === 0) throw new Error(`[kernelExecutor] DIVIDE by zero in calc "${calc.name}"`);
      return r(m[1].trim()) / divisor;
    }

    case 'POWER': {
      const m = raw.match(/^(.+?)\s+BY\s+(.+)$/);
      if (!m) throw new Error(`[kernelExecutor] POWER syntax error: "${raw}"`);
      return Math.pow(r(m[1].trim()), r(m[2].trim()));
    }

    case 'ROUND': {
      const m = raw.match(/^(.+?)\s+BY\s+(\d+)$/);
      if (!m) throw new Error(`[kernelExecutor] ROUND syntax error: "${raw}"`);
      const decimals = parseInt(m[2], 10);
      return Math.round(r(m[1].trim()) * Math.pow(10, decimals)) / Math.pow(10, decimals);
    }

    case 'MIN': {
      const m = raw.match(/^(.+?)\s+BY\s+(.+)$/);
      if (!m) throw new Error(`[kernelExecutor] MIN syntax error: "${raw}"`);
      return Math.min(r(m[1].trim()), r(m[2].trim()));
    }

    case 'MAX': {
      const m = raw.match(/^(.+?)\s+BY\s+(.+)$/);
      if (!m) throw new Error(`[kernelExecutor] MAX syntax error: "${raw}"`);
      return Math.max(r(m[1].trim()), r(m[2].trim()));
    }

    case 'ABS': {
      return Math.abs(r(raw.trim()));
    }

    case 'PERCENT_OF': {
      const m = raw.match(/^(.+?)\s+BY\s+(.+)$/);
      if (!m) throw new Error(`[kernelExecutor] PERCENT_OF syntax error: "${raw}"`);
      return r(m[1].trim()) * (r(m[2].trim()) / 100);
    }

    case 'MORTGAGE_PAYMENT': {
      // Syntax: principal AT rate OVER amort [FREQUENCY freq] [COMPOUND compound]
      const m = raw.match(
        /^(.+?)\s+AT\s+(.+?)\s+OVER\s+(.+?)(?:\s+FREQUENCY\s+(\w+))?(?:\s+COMPOUND\s+(\w+))?$/
      );
      if (!m) throw new Error(`[kernelExecutor] MORTGAGE_PAYMENT syntax error: "${raw}"`);

      const principal    = r(m[1].trim());
      const annual_rate  = r(m[2].trim());
      const amort_years  = r(m[3].trim());
      const pay_freq_raw = m[4] ? r(m[4].trim()) : 'monthly';
      const cmp_freq_raw = m[5] ? r(m[5].trim()) : 'semi_annual';

      return mortgage_payment(principal, annual_rate, amort_years, pay_freq_raw, cmp_freq_raw);
    }

    default:
      throw new Error(`[kernelExecutor] Unknown OP: "${op}"`);
  }
};

// ─── CHECK evaluator ─────────────────────────────────────────────────────────

/**
 * Evaluate a CHECK VERIFY condition.
 *
 * @param {{ left: string, operator: string, right: string }} verify
 * @param {Map} consts
 * @param {object} results
 * @param {object} data
 * @returns {boolean} — true if the condition PASSES (no violation)
 */
const evaluate_verify = (verify, consts, results, data) => {
  const r = (token) => resolve(token, consts, results, data);
  const lv = r(verify.left);
  const rv = r(verify.right);

  switch (verify.operator) {
    case '<=': return lv <= rv;
    case '>=': return lv >= rv;
    case '<':  return lv < rv;
    case '>':  return lv > rv;
    case '==': return lv == rv;  // eslint-disable-line eqeqeq
    case '!=': return lv != rv;  // eslint-disable-line eqeqeq
    case 'IN': return Array.isArray(rv) && rv.includes(lv);
    default:
      throw new Error(`[kernelExecutor] Unknown operator: "${verify.operator}"`);
  }
};

// ─── Entity validation ───────────────────────────────────────────────────────

const TYPE_VALIDATORS = {
  NUMBER:     (v) => typeof v === 'number' && Number.isFinite(v),
  CURRENCY:   (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0,
  STRING:     (v) => typeof v === 'string',
  BOOLEAN:    (v) => typeof v === 'boolean',
  DATE:       (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v),
  PERCENTAGE: (v) => typeof v === 'number' && v >= 0 && v <= 100,
};

/**
 * Validate all declared entity fields are present in input data with correct types.
 * Returns array of validation error strings. Empty array = valid.
 *
 * @param {Array<{ name: string, fields: Array<{ name: string, type: string }> }>} entities
 * @param {object} data
 * @returns {string[]}
 */
const validate_entities = (entities, data) => {
  const errors = [];
  for (const entity of entities) {
    for (const field of entity.fields) {
      if (!Object.prototype.hasOwnProperty.call(data, field.name)) {
        errors.push(`Missing required field: "${field.name}" (${field.type})`);
        continue;
      }
      const validator = TYPE_VALIDATORS[field.type];
      if (validator && !validator(data[field.name])) {
        errors.push(
          `Field "${field.name}" expected type ${field.type}, got: ${JSON.stringify(data[field.name])}`
        );
      }
    }
  }
  return errors;
};

// ─── Main executor ────────────────────────────────────────────────────────────

/**
 * Execute a compiled .bas AST against entity input data.
 *
 * @param {Readonly<object>} compiled — output of compileBas()
 * @param {object} entityData — flat object of input field values
 * @returns {{
 *   success: boolean,
 *   status: 'PASS'|'WARN'|'FAIL',
 *   results: object,
 *   warnings: Array,
 *   display: object,
 *   audit: Array,
 * }}
 */
export const runScript = (compiled, entityData) => {
  const data     = { ...entityData };
  const results  = {};
  const warnings = [];
  const audit    = [];

  // ── 1. Build constant map ─────────────────────────────────────────────────
  const consts = new Map(
    (compiled.consts ?? []).map(c => [c.name, c.value])
  );

  // ── 2. Validate entity fields ─────────────────────────────────────────────
  const validation_errors = validate_entities(compiled.entities ?? [], data);
  if (validation_errors.length > 0) {
    return {
      success:  false,
      status:   'FAIL',
      results:  {},
      warnings: [],
      display:  {},
      audit:    [{ type: 'VALIDATION', errors: validation_errors }],
    };
  }

  // ── 3. Execute CALCs in declaration order ─────────────────────────────────
  for (const calc of (compiled.calcs ?? [])) {
    try {
      const value = execute_op(calc, consts, results, data);
      results[calc.name] = value;
      audit.push({ type: 'CALC', name: calc.name, value });
    } catch (err) {
      return {
        success:  false,
        status:   'FAIL',
        results,
        warnings: [],
        display:  {},
        audit:    [...audit, { type: 'CALC_ERROR', name: calc.name, error: err.message }],
      };
    }
  }

  // ── 4. Run CHECKs ─────────────────────────────────────────────────────────
  for (const check of (compiled.checks ?? [])) {
    let passed;
    try {
      passed = evaluate_verify(check.verify, consts, results, data);
    } catch (err) {
      return {
        success:  false,
        status:   'FAIL',
        results,
        warnings,
        display:  {},
        audit:    [...audit, { type: 'CHECK_ERROR', name: check.name, error: err.message }],
      };
    }

    if (!passed) {
      // Interpolate {field_name} tokens in the message
      const triggering_value = (() => {
        try { return resolve(check.verify.left, consts, results, data); } catch { return null; }
      })();

      const message = check.message.replace(/\{([^}]+)\}/g, (_, token) => {
        try { return String(resolve(token, consts, results, data)); } catch { return token; }
      });

      if (check.outcome === 'FAIL') {
        audit.push({ type: 'CHECK', name: check.name, passed: false, outcome: 'FAIL' });
        return {
          success:       false,
          status:        'FAIL',
          failed_check:  check.name,
          message,
          results,
          warnings,
          display:       {},
          audit,
        };
      }

      // WARN — record and continue
      warnings.push({ check: check.name, message, value: triggering_value });
      audit.push({ type: 'CHECK', name: check.name, passed: false, outcome: 'WARN' });
    } else {
      audit.push({ type: 'CHECK', name: check.name, passed: true });
    }
  }

  // ── 5. Build DISPLAY outputs ──────────────────────────────────────────────
  const display = {};
  for (const disp of (compiled.displays ?? [])) {
    display[disp.name] = {};
    for (const plug of disp.plugs) {
      try {
        display[disp.name][plug.key] = resolve(plug.source, consts, results, data);
      } catch {
        display[disp.name][plug.key] = null;
      }
    }
  }

  return {
    success:  true,
    status:   warnings.length > 0 ? 'WARN' : 'PASS',
    results,
    warnings,
    display,
    audit,
  };
};
