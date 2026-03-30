// src/logic/engine/ruleLoader.js
const fs = require('fs').promises;
const path = require('path');

// --- PURE CORE LOGIC ---

/**
 * Pure function to format and freeze the compiled ruleset.
 *
 * @param {Object} compiledRuleset - The validated ruleset object.
 * @returns {Object} The finalized, frozen ruleset object.
 */
const finalize_ruleset = compiledRuleset => {
    // Enforce immutability at runtime.
    return Object.freeze(compiledRuleset);
};

/**
 * Pure function to validate the compiled ruleset against the schema.
 *
 * @param {Ajv} validator - The configured AJV instance.
 * @param {Object} ruleset - The compiled ruleset data.
 * @param {string} schemaName - The name of the schema to validate against (e.g., 'RuleSetSchema').
 * @returns {Object} The validated ruleset object.
 * @throws {Error} If validation fails.
 */
const validate_ruleset = (validator, ruleset, schemaName) => {
    const validate = validator.getSchema(schemaName);

    if (!validate) {
        throw new Error(`CRITICAL VALIDATION ERROR: Schema '${schemaName}' not found in AJV instance.`);
    }

    const isValid = validate(ruleset);

    if (!isValid) {
        // Return a detailed error object suitable for logging/rejection
        const errors = validate.errors.map(err => ({
            dataPath: err.instancePath,
            message: err.message,
            schemaPath: err.schemaPath,
        }));
        throw new Error(`AIRLOCK BREACH: Compiled ruleset failed schema validation (${schemaName}).`, { cause: errors });
    }

    return ruleset;
};


// --- PUBLIC CURRIED API (Side-Effect Handler) ---

/**
 * Curried function to load, compile, and validate a ruleset from disk.
 *
 * @param {Object} dependencies - System dependencies ({ ajvValidator, briefCompiler, ruleSchemaName }).
 * @returns {Function} A function that takes the ruleset file path.
 */
const load_ruleset = dependencies => rulesetPath => {
    const { ajvValidator, briefCompiler, ruleSchemaName } = dependencies;
    const fullPath = path.join(process.cwd(), rulesetPath);

    console.log(`[RULELOADER] Attempting to load ruleset from: ${fullPath}`);

    // Functional Pipeline (Promise Chain)
    return fs.readFile(fullPath, 'utf8')
        .then(briefContent => {
            console.log(`[RULELOADER] Ruleset read successfully. Compiling...`);
            // Pure Step 1: Compile the DSL content
            return briefCompiler.compileBriefToJSON(briefContent);
        })
        .then(compiledRuleset => {
            console.log(`[RULELOADER] Compilation complete. Validating against ${ruleSchemaName}...`);
            // Pure Step 2: Validate the compiled output
            return validate_ruleset(ajvValidator, compiledRuleset, ruleSchemaName);
        })
        .then(validatedRuleset => {
            console.log(`[RULELOADER] Validation SUCCESS. Freezing ruleset.`);
            // Pure Step 3: Finalize and freeze the object
            return finalize_ruleset(validatedRuleset);
        })
        .catch(err => {
            // Log rejection and propagate error
            console.error(`[RULELOADER] FATAL FAILURE in pipeline for ${rulesetPath}:`, err.message);
            throw err;
        });
};


module.exports = {
    // Export the primary curried function using its public camelCase API name
    loadRuleset: load_ruleset,
    // Export pure helpers for composition/testing
    finalize_ruleset,
    validate_ruleset,
};
