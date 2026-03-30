// src/logic/engine/ruleProcessor.js

// --- PURE CORE LOGIC: DATA TRANSFORMATION & STATE TRANSITION ---

/**
 * Pure helper function to transform the constants array (from the compiler/loader)
 * into a flat object map {NAME: VALUE} for efficient O(1) lookup during evaluation.
 *
 * @param {Array<{name: string, value: any}>} constants_array - Array of constant objects.
 * @returns {Object} A flat map of constants.
 */
const transform_constants_array_to_map = constants_array => {
    // Functional conversion using reduce (no mutation)
    return constants_array.reduce((acc, constant) => {
        // Ensure constant names are keys and values are the values
        acc[constant.name] = constant.value;
        return acc;
    }, {});
};


/**
 * Pure function that executes a single rule and generates the next immutable state.
 * This acts as the reducer function in the state machine pipeline.
 *
 * @param {Function} evaluate_formula - Injected pure function (formula, state) => result.
 * @param {Object} state - The current, immutable application state (client data + intermediate results).
 * @param {Object} rule - The rule object being executed.
 * @returns {Object} The new, immutable state object.
 * @throws {Error} If a 'Validation' rule fails, halting the pipeline.
 */
const execute_rule = evaluate_formula => (state, rule) => {
    // 1. Evaluate the rule's formula
    const result = evaluate_formula(rule.FORMULA, state);
    const rule_type = rule.TYPE.toUpperCase();
    const rule_name = rule.NAME;

    // 2. State Transition based on Rule Type
    if (rule_type === 'VALIDATION') {
        // Validation: If result is false (or falsy), throw an error, halting the reducer pipeline.
        if (!result) {
            const audit_entry = { rule: rule_name, status: 'REJECTED', message: rule.MESSAGE };
            const new_audit_trail = [...(state.auditTrail || []), audit_entry];
            
            // Throw an error carrying the final state and error details for external catching
            const final_rejected_state = { ...state, auditTrail: new_audit_trail };
            throw Object.assign(new Error(`Validation Failed: ${rule_name}`), { 
                ruleName: rule_name, 
                message: rule.MESSAGE,
                finalState: final_rejected_state
            });
        }
        // If valid, just merge a success message into the audit trail
        const audit_entry = { rule: rule_name, status: 'PASSED' };
        return { ...state, auditTrail: [...(state.auditTrail || []), audit_entry] };
    }

    if (rule_type === 'CALCULATION' || rule_type === 'SCORER') {
        // Calculation/Scorer: Merge the result into the state's results object.
        const new_results = { ...state.results, [rule_name]: result };
        const audit_entry = { rule: rule_name, status: 'COMPUTED', value: result };
        return { 
            ...state, 
            results: new_results, 
            auditTrail: [...(state.auditTrail || []), audit_entry] 
        };
    }
    
    // Default: If rule type is unknown or requires no state change, return the current state
    return state;
};

/**
 * Pure function that executes the entire ruleset pipeline against initial client data.
 *
 * @param {Function} rule_executor - The curried function (state, rule) => newState.
 * @param {Object} initial_client_data - The validated, raw input data.
 * @param {Object} ruleset - The validated, frozen ruleset object.
 * @returns {Object} The final state after all rules have been processed.
 */
const process_ruleset_pipeline = (rule_executor, initial_client_data, ruleset) => {
    // 1. Pure Transformation: Convert constants array to map for efficient lookup
    const constant_map = transform_constants_array_to_map(ruleset.constants);

    // 2. Prepare Initial State (Create immutable wrapper)
    const initial_state = Object.freeze({ 
        clientData: initial_client_data, 
        constants: constant_map, // <-- Now a flat map as required by the Formula Evaluator
        results: {}, 
        auditTrail: []
    });

    // 3. Sort rules by PRIORITY (lowest first) for sequential processing
    const sorted_rules = [...ruleset.rules].sort((a, b) => (a.PRIORITY || 999) - (b.PRIORITY || 999));

    // 4. Execute the Reducer Pipeline (Immutable State Machine)
    try {
        const final_state = sorted_rules.reduce(rule_executor, initial_state);
        return final_state;
    } catch (e) {
        // Re-throw the validation failure object
        throw e;
    }
};


// --- PUBLIC CURRIED API ---

/**
 * Curried function factory to create the Rule Processor entry point.
 *
 * @param {Function} formula_evaluator - The injected dependency: (formula, state) => result.
 * @returns {Function} A function that accepts the final execution parameters (ruleset, clientData).
 */
const create_rule_processor = formula_evaluator => (ruleset, clientData) => {
    // Partially apply the formula evaluator to the rule executor
    const rule_executor = execute_rule(formula_evaluator);
    
    // Execute the final processing pipeline
    return process_ruleset_pipeline(rule_executor, clientData, ruleset);
};

module.exports = {
    // Export the primary curried function using its public camelCase API name
    createRuleProcessor: create_rule_processor,
    // Export pure helpers for composition/testing
    transform_constants_array_to_map,
    execute_rule,
    process_ruleset_pipeline,
};
