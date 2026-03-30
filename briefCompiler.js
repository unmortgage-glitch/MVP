// src/logic/compiler/briefCompiler.js — Kenward CMS v2
// Pure functional .bas compiler. ESM. No classes. No mutation.
// Parses the full briefDSL block grammar into a frozen AST.
//
// Block order enforced: SCRIPT → ENTITY → CONST → CALC → CHECK → DISPLAY
// Exports: compileBas (primary), plus individual parsers for unit testing.

// ─── Constants ────────────────────────────────────────────────────────────────

const BLOCK_ORDER = ['SCRIPT', 'ENTITY', 'CONST', 'CALC', 'CHECK', 'DISPLAY'];

const BLOCK_OPENERS = new Set([
  'SCRIPT', 'ENTITY', 'CALC', 'CHECK', 'DISPLAY',
]);

const BLOCK_CLOSERS = new Set([
  'END SCRIPT', 'END ENTITY', 'END CALC', 'END CHECK', 'END DISPLAY',
]);

// ─── Line normalizer ──────────────────────────────────────────────────────────

/**
 * Strip inline comments and trim. Returns null for empty/comment-only lines.
 * @param {string} line
 * @returns {string|null}
 */
const normalize_line = (line) => {
  const idx = line.indexOf('//');
  const content = (idx !== -1 ? line.slice(0, idx) : line).trim();
  return content.length > 0 ? content : null;
};

// ─── Individual parsers ───────────────────────────────────────────────────────

/**
 * Parse a CONST line: `CONST NAME = value`
 * Value is coerced to number if possible, otherwise kept as string.
 * @param {string} line
 * @returns {{ name: string, value: number|string }}
 */
export const parse_const = (line) => {
  const match = line.match(/^CONST\s+([A-Z0-9_]+)\s*=\s*(.+)$/);
  if (!match) throw new Error(`[briefCompiler] Invalid CONST line: "${line}"`);
  const raw = match[2].trim().replace(/^["']|["']$/g, '');
  const numeric = Number(raw);
  return {
    name:  match[1],
    value: Number.isFinite(numeric) ? numeric : raw,
  };
};

/**
 * Parse an ENTITY FIELD line: `FIELD name : TYPE`
 * @param {string} line
 * @returns {{ name: string, type: string }}
 */
export const parse_field = (line) => {
  const match = line.match(/^FIELD\s+([a-z_][a-z0-9_]*)\s*:\s*([A-Z]+)$/i);
  if (!match) throw new Error(`[briefCompiler] Invalid FIELD line: "${line}"`);
  return { name: match[1], type: match[2].toUpperCase() };
};

/**
 * Parse a CALC OP line: `OP OPERATION arg [BY|AT|OVER|INTO] arg ...`
 * Captures op name and the raw remainder for the executor to interpret.
 * @param {string} line
 * @returns {{ op: string, raw: string }}
 */
export const parse_op = (line) => {
  const match = line.match(/^OP\s+([A-Z_]+)\s*(.*)$/);
  if (!match) throw new Error(`[briefCompiler] Invalid OP line: "${line}"`);
  return { op: match[1], raw: match[2].trim() };
};

/**
 * Parse a CHECK VERIFY line: `VERIFY left op right`
 * Supports: <=, >=, <, >, ==, !=, IN
 * @param {string} line
 * @returns {{ left: string, operator: string, right: string }}
 */
export const parse_verify = (line) => {
  // IN operator — right side is a JSON array literal
  const inMatch = line.match(/^VERIFY\s+(.+?)\s+IN\s+(\[.+\])$/);
  if (inMatch) {
    return { left: inMatch[1].trim(), operator: 'IN', right: inMatch[2].trim() };
  }
  const match = line.match(/^VERIFY\s+(.+?)\s*(<=|>=|<|>|==|!=)\s*(.+)$/);
  if (!match) throw new Error(`[briefCompiler] Invalid VERIFY line: "${line}"`);
  return {
    left:     match[1].trim(),
    operator: match[2].trim(),
    right:    match[3].trim(),
  };
};

/**
 * Parse a DISPLAY PLUG line: `PLUG source INTO target.key`
 * @param {string} line
 * @returns {{ source: string, target: string, key: string }}
 */
export const parse_plug = (line) => {
  const match = line.match(/^PLUG\s+([a-z_][a-z0-9_]*)\s+INTO\s+([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)$/i);
  if (!match) throw new Error(`[briefCompiler] Invalid PLUG line: "${line}"`);
  return { source: match[1], target: match[2], key: match[3] };
};

// ─── Block parsers ────────────────────────────────────────────────────────────

/**
 * Parse the SCRIPT block lines (key-value metadata).
 * @param {string[]} lines
 * @returns {object}
 */
const parse_script_block = (lines) =>
  lines.reduce((acc, line) => {
    const match = line.match(/^([A-Z]+)\s+(.+)$/);
    return match ? { ...acc, [match[1].toLowerCase()]: match[2].trim() } : acc;
  }, {});

/**
 * Parse an ENTITY block: name from opener, fields from body lines.
 * @param {string} name
 * @param {string[]} lines
 * @returns {{ name: string, fields: Array<{ name: string, type: string }> }}
 */
const parse_entity_block = (name, lines) => ({
  name,
  fields: lines
    .filter(l => l.startsWith('FIELD'))
    .map(parse_field),
});

/**
 * Parse a CALC block: name from opener, single OP line from body.
 * @param {string} name
 * @param {string[]} lines
 * @returns {{ name: string, op: string, raw: string }}
 */
const parse_calc_block = (name, lines) => {
  const op_line = lines.find(l => l.startsWith('OP'));
  if (!op_line) throw new Error(`[briefCompiler] CALC "${name}" has no OP line`);
  return { name, ...parse_op(op_line) };
};

/**
 * Parse a CHECK block: name, verify, and FAIL or WARN with message.
 * @param {string} name
 * @param {string[]} lines
 * @returns {{ name: string, verify: object, outcome: 'FAIL'|'WARN', message: string }}
 */
const parse_check_block = (name, lines) => {
  const verify_line = lines.find(l => l.startsWith('VERIFY'));
  if (!verify_line) throw new Error(`[briefCompiler] CHECK "${name}" has no VERIFY line`);

  const fail_line = lines.find(l => l.startsWith('FAIL'));
  const warn_line = lines.find(l => l.startsWith('WARN'));

  if (!fail_line && !warn_line) {
    throw new Error(`[briefCompiler] CHECK "${name}" must have FAIL or WARN`);
  }
  if (fail_line && warn_line) {
    throw new Error(`[briefCompiler] CHECK "${name}" cannot have both FAIL and WARN`);
  }

  const outcome_line = fail_line || warn_line;
  const msg_match = outcome_line.match(/^(?:FAIL|WARN)\s+"(.+)"$/);
  if (!msg_match) throw new Error(`[briefCompiler] Invalid FAIL/WARN line in CHECK "${name}": ${outcome_line}`);

  return {
    name,
    verify:  parse_verify(verify_line),
    outcome: fail_line ? 'FAIL' : 'WARN',
    message: msg_match[1],
  };
};

/**
 * Parse a DISPLAY block: name from opener, PLUG lines from body.
 * @param {string} name
 * @param {string[]} lines
 * @returns {{ name: string, plugs: Array<{ source, target, key }> }}
 */
const parse_display_block = (name, lines) => ({
  name,
  plugs: lines
    .filter(l => l.startsWith('PLUG'))
    .map(parse_plug),
});

// ─── Main compiler ────────────────────────────────────────────────────────────

/**
 * Compile raw .bas content into a frozen AST.
 *
 * @param {string} source — raw .bas file content
 * @returns {Readonly<{
 *   script:   object,
 *   entities: Array,
 *   consts:   Array,
 *   calcs:    Array,
 *   checks:   Array,
 *   displays: Array,
 * }>}
 */
export const compileBas = (source) => {
  const lines = source
    .split('\n')
    .map(normalize_line)
    .filter(Boolean);

  const ast = {
    script:   {},
    entities: [],
    consts:   [],
    calcs:    [],
    checks:   [],
    displays: [],
  };

  let current_block_type = null;  // 'SCRIPT' | 'ENTITY' | 'CALC' | 'CHECK' | 'DISPLAY' | null
  let current_block_name = null;
  let current_block_lines = [];
  let last_block_index = -1;

  const flush_block = () => {
    if (!current_block_type) return;

    switch (current_block_type) {
      case 'SCRIPT':
        ast.script = parse_script_block(current_block_lines);
        break;
      case 'ENTITY':
        ast.entities.push(parse_entity_block(current_block_name, current_block_lines));
        break;
      case 'CALC':
        ast.calcs.push(parse_calc_block(current_block_name, current_block_lines));
        break;
      case 'CHECK':
        ast.checks.push(parse_check_block(current_block_name, current_block_lines));
        break;
      case 'DISPLAY':
        ast.displays.push(parse_display_block(current_block_name, current_block_lines));
        break;
    }

    current_block_type  = null;
    current_block_name  = null;
    current_block_lines = [];
  };

  for (const line of lines) {
    // ── CONST (single-line, no END keyword) ──────────────────────────────────
    if (line.startsWith('CONST ') && current_block_type === null) {
      // Enforce block order: CONST must come after ENTITY, before CALC
      const idx = BLOCK_ORDER.indexOf('CONST');
      if (idx <= last_block_index && last_block_index >= BLOCK_ORDER.indexOf('CALC')) {
        throw new Error(`[briefCompiler] Block order violation: CONST after CALC`);
      }
      last_block_index = Math.max(last_block_index, idx);
      ast.consts.push(parse_const(line));
      continue;
    }

    // ── Block CLOSER ─────────────────────────────────────────────────────────
    if (BLOCK_CLOSERS.has(line)) {
      flush_block();
      continue;
    }

    // ── Block OPENER ─────────────────────────────────────────────────────────
    // Matches: SCRIPT, ENTITY name, CALC name, CHECK name, DISPLAY name
    const opener_match = line.match(/^(SCRIPT|ENTITY|CALC|CHECK|DISPLAY)(?:\s+([a-z_][a-z0-9_]*))?$/i);
    if (opener_match) {
      const block_type = opener_match[1].toUpperCase();

      if (!BLOCK_OPENERS.has(block_type)) {
        throw new Error(`[briefCompiler] Unknown block type: ${block_type}`);
      }

      const idx = BLOCK_ORDER.indexOf(block_type);

      // ENTITY can repeat, CALC can repeat, CHECK can repeat, DISPLAY can repeat
      // But none can come BEFORE a block that appeared later in the order
      if (idx < last_block_index && block_type !== 'ENTITY' && block_type !== 'CALC' && block_type !== 'CHECK' && block_type !== 'DISPLAY') {
        throw new Error(
          `[briefCompiler] Block order violation: ${block_type} after ${BLOCK_ORDER[last_block_index]}`
        );
      }
      // Only advance last_block_index for first appearances of each unique block type
      if (idx > last_block_index) last_block_index = idx;

      flush_block(); // flush any previously open block (shouldn't happen in valid .bas, but safe)

      current_block_type  = block_type;
      current_block_name  = opener_match[2] ?? null;
      current_block_lines = [];
      continue;
    }

    // ── Body line ─────────────────────────────────────────────────────────────
    if (current_block_type) {
      current_block_lines.push(line);
    }
  }

  // Flush any unclosed block (compiler error)
  if (current_block_type) {
    throw new Error(`[briefCompiler] Unclosed block: ${current_block_type} ${current_block_name ?? ''}`);
  }

  return Object.freeze(ast);
};
