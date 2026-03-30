// update-ajv-config.js
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');
const CONFIG_PATH = path.join(SRC_DIR, 'ajv-config.js');

// --- Final AJV Configuration Code ---
const FINAL_AJV_CONFIG_CODE = `
// src/ajv-config.js
const Ajv = require('ajv');
const fs = require('fs');
const path = require('path');

// AJV Configuration: allErrors:true is crucial for comprehensive validation feedback.
const ajv = new Ajv({
    allErrors: true,
    coerceTypes: true,
    useDefaults: true,
    formats: {
        // Defines a format validator for UUIDs
        uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    }
});

/**
 * Helper function to safely load and compile a schema from the /logic directory.
 * This function enforces the Logic as Data rule by reading external JSON rules.
 * @param {string} schemaName - The file name of the schema (e.g., 'LeadSchema.json').
 * @returns {function} The compiled AJV validation function.
 */
const loadAndCompileSchema = (schemaName) => {
    try {
        // The path points from src/ to ../logic/
        const schemaPath = path.join(__dirname, '..', 'logic', schemaName);
        const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
        console.log(\`Schema loaded: \${schemaName}\`);
        return ajv.compile(schema);
    } catch (error) {
        console.error(\`FATAL ERROR: Could not load or compile \${schemaName}.\`);
        console.error(\`Ensure the file exists in /logic and the JSON syntax is correct.\`);
        throw error; // Stop application start-up if schemas are missing or malformed
    }
};

// --- Load and Compile All Phase 4 Schemas ---
const validateLead = loadAndCompileSchema('LeadSchema.json');
const validateContent = loadAndCompileSchema('ContentBlockSchema.json');
const validateFormField = loadAndCompileSchema('FormFieldSchema.json');
const validateAuditLog = loadAndCompileSchema('AuditLogSchema.json');

module.exports = {
    validateLead,
    validateContent,
    validateFormField,
    validateAuditLog
};
`;
// ----------------------------------------------------------------------

try {
    // 1. Ensure the /src directory exists
    if (!fs.existsSync(SRC_DIR)) {
        fs.mkdirSync(SRC_DIR);
        console.log(`- Created directory: ${SRC_DIR}`);
    }

    // 2. Write the complete configuration code to the file
    fs.writeFileSync(CONFIG_PATH, FINAL_AJV_CONFIG_CODE.trim());
    
    console.log(`\n✅ SUCCESS: src/ajv-config.js has been completely overwritten.`);
    console.log(`The configuration now loads all four core schemas, centralizing validation.`);
} catch (error) {
    console.error(`\n❌ ERROR: Failed to write src/ajv-config.js. Check file permissions.`);
    console.error(error.message);
}
