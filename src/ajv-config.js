// src/ajv-config.js
const Ajv = require('ajv');
const addFormats = require('ajv-formats'); // <-- NEW IMPORT
const fs = require('fs');
const path = require('path');

const ajv = new Ajv({
    allErrors: true,
    coerceTypes: true,
    useDefaults: true,
    formats: {
        uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    }
});

// CRITICAL FIX: Add all standard formats like "date-time", "email", etc.
addFormats(ajv);

/**
 * Helper function to safely load and compile a schema from the /logic directory.
 */
const loadAndCompileSchema = (schemaName) => {
    try {
        const schemaPath = path.join(__dirname, '..', 'logic', schemaName);
        const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
        console.log(`Schema loaded: ${schemaName}`);
        return ajv.compile(schema);
    } catch (error) {
        console.error(`FATAL ERROR: Could not load or compile ${schemaName}.`);
        console.error(`Ensure the file exists in /logic and the JSON syntax is correct.`);
        throw error;
    }
};

// --- Load and Compile All Phase 4 Schemas ---
const validateLead = loadAndCompileSchema('LeadSchema.json');
const validateContent = loadAndCompileSchema('ContentBlockSchema.json');
const validateFormField = loadAndCompileSchema('FormFieldSchema.json');
const validateAuditLog = loadAndCompileSchema('AuditLogSchema.json');
const validateConfigSchema = loadAndCompileSchema('ConfigSchema.json');

module.exports = {
    validateLead,
    validateContent,
    validateFormField,
    validateAuditLog,
    validateConfigSchema
};