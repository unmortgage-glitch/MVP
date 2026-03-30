// src/logic/engine/formula_evaluator.js

// --- PURE CORE LOGIC ---

/**
 * Pure function to retrieve a value by traversing a path on a source object.
 *
 * @param {Object} source - The object to search within (e.g., state.clientData).
 * @param {string} variablePath - The dot-separated path.
 * @returns {any} The value of the variable, or undefined if not found.
 */
const traverse_path = (source, variablePath) => {
    // If the source object is null/undefined, or the path is empty, stop.
    if (!source || !variablePath) return undefined;

    const pathParts = variablePath.split('.');
    
    // Functional reduce to traverse the object path
    return pathParts.reduce((obj, key) => {
        // Continue only if obj is valid and has the key
        if (obj && obj.hasOwnProperty(key)) {
            return obj[key];
        }
        return undefined; // Stop traversal
    }, source);
};


/**
 * Pure function to safely retrieve a variable value from the deeply nested state object.
 * Enforces strict Order of Precedence: 1. Constants, 2. Results, 3. Client Data.
 * Assumes state.constants is a flat object map {NAME: VALUE}.
 *
 * @param {Object} state - The current, immutable state object.
 * @param {string} variablePath - The dot-separated path or direct variable name (e.g., 'credit_score' or 'MAX_TDS_RATIO').
 * @returns {any} The value of the variable.
 * @throws {Error} If the variable is not found.
 */
const get_variable_value = (state, variablePath) => {
    // 1. Check Constants (Highest Precedence - O(1) lookup)
    if (state.constants.hasOwnProperty(variablePath)) {
        return state.constants[variablePath];
    }
    
    // 2. Check Results (Computed Values - Next Precedence)
    const resultValue = traverse_path(state.results, variablePath);
    if (resultValue !== undefined && resultValue !== null) {
        return resultValue;
    }
    
    // 3. Check Client Data (Raw Input - Lowest Precedence)
    const clientDataValue = traverse_path(state.clientData, variablePath);
    if (clientDataValue !== undefined && clientDataValue !== null) {
        return clientDataValue;
    }
    
    // Critical failure: Variable not found
    throw new Error(`Formula Execution Error: Variable [${variablePath}] not found in state.`);
};

/**
 * Pure function to inject actual values into the formula string using a regex replace.
 *
 * @param {Object} state - The current state object.
 * @param {string} formula - The raw formula string with [BRACKETED_VARS].
 * @returns {string} The formula string with values substituted.
 */
const substitute_values = (state, formula) => {
    // Regex to find all bracketed variables: [VARIABLE_NAME] or [nested.path]
    const regex = /\[([a-zA-Z0-9_.]+)\]/g; 

    // Functional replacement using String.prototype.replace with a replacement function
    const substitutedFormula = formula.replace(regex, (match, variablePath) => {
        const value = get_variable_value(state, variablePath.trim());
        
        // Safety: Ensure strings are quoted for safe execution, numbers/booleans are left raw
        if (typeof value === 'string') {
            const escapedValue = value.replace(/'/g, "\\'"); 
            return `'${escapedValue}'`;
        }
        
        // Safety: Prevent null/undefined from being inserted into the expression
        if (value === null || value === undefined) {
             throw new Error(`Formula Execution Error: Variable [${variablePath}] resolved to null/undefined.`);
        }
        
        // Return number or boolean as-is
        return value;
    });

    return substitutedFormula;
};


// --- PUBLIC CURRIED API ---

/**
 * Curried function to create the Formula Evaluator.
 *
 * @returns {Function} A function that takes the formula string and the current state.
 */
const evaluate_formula = () => (formula, state) => {
    // 1. Substitute variables with actual values (Pure)
    const executableFormula = substitute_values(state, formula);

    // 2. Safely execute the resulting string
    try {
        const evaluator = new Function(`return (${executableFormula})`);
        return evaluator();
    } catch (e) {
        // Re-throws the exception without logging (Pure)
        throw new Error(`Formula execution failed: ${e.message}`, { cause: executableFormula });
    }
};

module.exports = {
    // Export the primary curried function using its public camelCase API name
    evaluateFormula: evaluate_formula,
    // Export pure helpers for composition/testing
    get_variable_value,
    substitute_values,
};
