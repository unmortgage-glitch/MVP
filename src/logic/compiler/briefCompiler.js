// src/logic/compiler/briefCompiler.js

// --- PURE CORE LOGIC: DSL PARSERS ---

/**
 * Pure function to normalize a single line of text: trim, remove comments, and skip empty lines.
 *
 * @param {string} line - A single line from the brief file.
 * @returns {string|null} The normalized line, or null if it's empty/commented.
 */
const normalize_line = line => {
    const trimmedLine = line.trim();
    const commentIndex = trimmedLine.indexOf('//');
    
    // Remove comments
    const content = commentIndex !== -1 ? trimmedLine.substring(0, commentIndex).trim() : trimmedLine;

    // Return content only if it's not empty
    return content.length > 0 ? content : null;
};

/**
 * Pure function to parse a line into a key-value pair.
 *
 * @param {string} line - The normalized line.
 * @returns {{key: string, value: string}|null} The parsed key/value object.
 */
const parse_key_value = line => {
    const parts = line.split(/:\s*|\s*=\s*/).map(s => s.trim());
    
    if (parts.length >= 2) {
        return { 
            key: parts[0].toUpperCase(), 
            value: parts.slice(1).join('').trim().replace(/^'|'$/g, '') 
        };
    }
    return null;
};

/**
 * Pure, recursive function to process a block of rule lines, collecting properties.
 * Stops when it encounters a closing brace '}'.
 *
 * @param {Array<string>} lines - Remaining lines of the file.
 * @param {Object} currentRule - The rule object being built.
 * @returns {{lines: Array<string>, rule: Object}} The remaining lines and the completed rule object.
 */
const process_rule_block = (lines, currentRule) => {
    // Functional termination via recursion base case
    if (lines.length === 0) {
        return { lines: [], rule: currentRule };
    }
    
    const [head, ...tail] = lines;
    
    if (head === '}') {
        return { lines: tail, rule: currentRule };
    }
    
    const parsedKV = parse_key_value(head);
    
    if (parsedKV) {
        // Functional update: create a new rule object with the new property
        const newRule = { ...currentRule, [parsedKV.key]: parsedKV.value };
        return process_rule_block(tail, newRule);
    }
    
    // Skip unparsable line and continue processing the rest of the block
    return process_rule_block(tail, currentRule);
};


// --- MAIN PURE COMPILER (Tail Recursive Processor - Immutable) ---

/**
 * Pure, tail-recursive function to iterate over all lines and build the compilation state.
 *
 * @param {Array<string>} lines - The remaining normalized lines to process.
 * @param {Object} accumulator - The current compilation state ({ name, constants, rules }).
 * @returns {Object} The final accumulator state.
 */
const process_all_lines = (lines, accumulator) => {
    // Base Case: If there are no more lines, return the final accumulator (Tail-end)
    if (lines.length === 0) {
        return accumulator;
    }

    const [head, ...tail] = lines; // Immutable destructuring
    const parsedKV = parse_key_value(head);

    // Functional State Transition via immediate return of the next recursive call

    // Handle Header
    if (parsedKV && parsedKV.key === 'RULESET') {
        const nextAccumulator = { ...accumulator, name: parsedKV.value };
        return process_all_lines(tail, nextAccumulator); // Recursive call
    }
    
    // Handle Constant
    if (head.match(/^([A-Z0-9_]+)\s*=\s*/)) {
        if (parsedKV) {
            const newConstant = { name: parsedKV.key, value: parsedKV.value };
            const nextAccumulator = { ...accumulator, constants: [...accumulator.constants, newConstant] };
            return process_all_lines(tail, nextAccumulator); // Recursive call
        }
    }

    // Handle Rule Block Start
    if (head.match(/^RULE:\s*([A-Z0-9_]+)\s*{/)) {
        const ruleNameMatch = head.match(/^RULE:\s*([A-Z0-9_]+)\s*{/);
        const ruleName = ruleNameMatch ? ruleNameMatch[1] : `Rule_${accumulator.rules.length + 1}`;
        
        // Process the block recursively and get the new rule and remaining lines
        const ruleBlockResult = process_rule_block(tail, { name: ruleName });

        const nextAccumulator = {
            ...accumulator,
            rules: [...accumulator.rules, ruleBlockResult.rule],
        };
        const remainingLines = ruleBlockResult.lines; // The rest of the file after the block

        return process_all_lines(remainingLines, nextAccumulator); // Recursive call
    }
    
    // Default: Skip the current line and move to the next
    return process_all_lines(tail, accumulator);
};

/**
 * Pure function to compile the raw .brief DSL content into a structured JSON object.
 * This is the main exported function.
 *
 * @param {string} briefContent - The entire raw content of the .brief file.
 * @returns {Object} The compiled JSON structure.
 */
const compile_brief_to_json = briefContent => {
    // 1. Normalize and filter out empty lines
    const normalizedLines = briefContent
        .split('\n')
        .map(normalize_line)
        .filter(line => line !== null);

    // Initial state for the recursive process
    const initialState = {
        name: null,
        constants: [],
        rules: [],
    };

    // 2. Execute the tail-recursive process
    const finalState = process_all_lines(normalizedLines, initialState);

    // 3. Final Output (Map to required schema)
    return {
        name: finalState.name || 'UNNAMED_RULESET',
        constants: finalState.constants,
        rules: finalState.rules,
    };
};

module.exports = {
    // Export the primary compiler function using the camelCase public API name
    compileBriefToJSON: compile_brief_to_json,
    // Export pure helpers for testing/composition
    normalize_line,
    parse_key_value,
};
