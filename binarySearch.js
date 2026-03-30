// src/logic/solver/binarySearch.js — Kenward CMS v2
// Pure, recursive binary search. ESM. No mutation.
// Finds the largest input value (e.g. loan amount) that keeps
// a scorer function (e.g. TDS ratio) at or below a target threshold.

// ─── Pure recursive core ──────────────────────────────────────────────────────

/**
 * @param {Function} scorer       — pure function: value → score
 * @param {number}   targetScore  — maximum permitted score
 * @param {number}   low          — current lower bound
 * @param {number}   high         — current upper bound
 * @param {number}   precision    — stop when (high - low) <= precision
 * @returns {number} largest value where scorer(value) <= targetScore
 */
const recursive_search = (scorer, targetScore, low, high, precision) => {
  if (high - low <= precision) return low;

  const mid      = low + (high - low) / 2;
  const midScore = scorer(mid);

  return midScore <= targetScore
    ? recursive_search(scorer, targetScore, mid, high, precision)
    : recursive_search(scorer, targetScore, low, mid, precision);
};

// ─── Public curried API ───────────────────────────────────────────────────────

/**
 * Curried entry point. Inject a scorer function, then call with search params.
 *
 * Usage:
 *   const findMax = findMaxPermittedValue(loanAmount => tdsRatio(loanAmount));
 *   const maxLoan = findMax({ targetScore: 0.44, low: 0, high: 2_000_000, precision: 100 });
 *
 * @param {Function} scorer
 * @returns {Function} ({ targetScore, low, high, precision }) => number
 */
export const findMaxPermittedValue = (scorer) =>
  ({ targetScore, low, high, precision }) => {
    if (scorer(low) > targetScore) {
      throw new Error(
        `[binarySearch] Initial low (${low}) already exceeds target score. Adjust low boundary.`
      );
    }
    if (low >= high) {
      throw new Error(
        `[binarySearch] Boundary error: low (${low}) must be less than high (${high}).`
      );
    }
    return recursive_search(scorer, targetScore, low, high, precision);
  };

export { recursive_search };
