// src/processors/calculationExecutor.js
const fs = require('fs');
const path = require('path');

// --- Helper Functions (Functional Style) ---

/**
 * Gets a value from a nested object path (e.g., 'capacity.annualIncome').
 */
const getNestedValue = (obj, keyPath) => {
    return keyPath.split('.').reduce((o, k) => (o && o[k] !== undefined) ? o[k] : undefined, obj);
};

/**
 * Sets a value in a nested object path.
 */
const setNestedValue = (obj, keyPath, value) => {
    const keys = keyPath.split('.');
    let current = obj;
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (i === keys.length - 1) {
            current[key] = value;
        } else {
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
    }
    return obj;
};

// --- Core Executor ---

/**
 * Executes a pipeline defined in a Logic as Data JSON file on a Lead object.
 * @param {object} leadData - The mutable Lead object being processed.
 * @returns {object} The updated Lead object.
 */
const executePipeline = (leadData) => {
    // 1. Load the pipeline logic from the Logic as Data file
    const pipelinePath = path.join(__dirname, '..', 'logic', 'GdsTdsPipeline.json');
    const pipelineConfig = JSON.parse(fs.readFileSync(pipelinePath, 'utf8'));

    console.log(`Executing pipeline: ${pipelineConfig.calculationName}`);

    // 2. Iterate through each step defined in the pipeline
    pipelineConfig.pipeline.forEach(step => {
        const { operation, sourceDataKey, operands = [], targetDataKey } = step;
        let result = getNestedValue(leadData, sourceDataKey); // Get the primary value

        // 3. Perform the defined operation
        switch (operation) {
            case 'SUM':
                result = operands.reduce((acc, operand) => {
                    const operandValue = (typeof operand === 'string' && operand.includes('.')) 
                        ? getNestedValue(leadData, operand) 
                        : operand;
                    return acc + (operandValue || 0);
                }, result || 0);
                break;
            case 'DIVIDE':
                const divisor = (typeof operands[0] === 'string' && operands[0].includes('.')) 
                    ? getNestedValue(leadData, operands[0]) 
                    : operands[0];
                result = (divisor && divisor !== 0) ? result / divisor : 0;
                break;
            default:
                console.warn(`Skipping unknown operation: ${operation} in step ${step.stepName}`);
        }

        // 4. Store the result back into the Lead object
        if (targetDataKey) {
            setNestedValue(leadData, targetDataKey, parseFloat(result.toFixed(4)));
        }
    });

    return leadData;
};

module.exports = {
    executePipeline
};
