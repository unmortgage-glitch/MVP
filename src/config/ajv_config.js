// src/config/ajv_config.js
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const fs = require('fs');
const path = require('path');

// --- PURE HELPERS ---

const loadSchema = (filename) => {
    // Correctly points to ../schemas
    const schemaPath = path.join(__dirname, '../schemas', filename);
    try {
        const fileContent = fs.readFileSync(schemaPath, 'utf8');
        return JSON.parse(fileContent);
    } catch (error) {
        console.error(`[AJV CONFIG] Failed to load schema: ${filename}`, error.message);
        throw error;
    }
};

// --- MAIN FACTORY ---

const initializeAjv = () => {
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);

    // Load and Register Schemas
    try {
        const leadSchema = loadSchema('LeadSchema.json');
        const ruleSetSchema = loadSchema('RuleSetSchema.json');
        
        ajv.addSchema(leadSchema, 'LeadSchema');
        ajv.addSchema(ruleSetSchema, 'RuleSetSchema');
        console.log('[SYSTEM] AJV Initialized. Schemas Loaded.');
    } catch (e) {
        console.warn('[SYSTEM] Schema loading skipped or failed. Check src/schemas/');
    }

    return ajv;
};

module.exports = { initializeAjv };
