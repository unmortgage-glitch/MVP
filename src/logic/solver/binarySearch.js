// src/logic/solver/binarySearch.js

// --- PURE CORE LOGIC ---

/**
 * Pure, recursive core of the binary search algorithm.
 *
 * @param {Function} scorer - Function that takes a value and returns a score (e.g., loanAmount => TDS_Ratio).
 * @param {number} targetScore - The maximum permitted score (e.g., max TDS).
 * @param {number} low - The current lower bound of the search range.
 * @param {number} high - The current upper bound of the search range.
 * @param {number} precision - The minimum difference between high and low to continue searching.
 * @returns {number} The largest value found that satisfies the target score.
 */
const recursive_search = (scorer, targetScore, low, high, precision) => {
    // Termination Condition: If the range is smaller than the precision, stop and return the best low value found.
    if (high - low <= precision) {
        // Return low as it is the largest safe value found so far.
        return low;
    }

    // Functional Guess: Calculate the midpoint (new guess)
    const mid = low + (high - low) / 2;

    // Functional Decision: Calculate the score for the guess (Pure function call)
    const midScore = scorer(mid);

    // Functional State Update (Tail Recursion)
    if (midScore <= targetScore) {
        // Search Upper Half: mid becomes the new low (found a valid candidate)
        return recursive_search(scorer, targetScore, mid, high, precision);
    } else {
        // Search Lower Half: mid becomes the new high (mid was too high)
        return recursive_search(scorer, targetScore, low, mid, precision);
    }
};


// --- PUBLIC CURRIED API ---

/**
 * Curried function to find the maximum input value (e.g., loan amount) that results
 * in an output score less than or equal to the target.
 *
 * @param {Function} scorer - The pure function (value => score) to be injected.
 * @returns {Function} A function that takes the search parameters.
 */
const find_max_permitted_value = scorer => ({ targetScore, low, high, precision }) => {
    // Initial validation check
    if (scorer(low) > targetScore) {
        throw new Error("Initial 'low' value already exceeds the target score. Adjust 'low' boundary.");
    }
    if (low >= high) {
        throw new Error("Search boundary error: 'low' must be less than 'high'.");
    }

    // Call the pure, recursive core search
    return recursive_search(scorer, targetScore, low, high, precision);
};

module.exports = {
    // Export the primary function using the camelCase public API name
    findMaxPermittedValue: find_max_permitted_value,
    // Export the recursive core for advanced testing/composition
    recursive_search,
};

