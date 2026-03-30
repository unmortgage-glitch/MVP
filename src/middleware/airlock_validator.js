// src/middleware/airlock_validator.js

// --- PUBLIC CURRIED API ---

/**
 * Curried function factory to create the Airlock Validation middleware (Gate 2).
 * This middleware ensures all incoming data strictly conforms to LeadSchema.json.
 *
 * @param {Ajv} ajv_validator - The configured AJV instance.
 * @returns {Function} An Express middleware function (req, res, next) => void.
 */
const create_airlock_validator = ajv_validator => (req, res, next) => {
    // Define the schema name required for Lead data
    const schema_name = 'LeadSchema';
    
    // Get the pre-compiled validation function
    const validate = ajv_validator.getSchema(schema_name);

    if (!validate) {
        // Critical failure: Validator not initialized correctly. Fail with 500.
        return res.status(500).json({ 
            message: 'Internal System Error: Validation schema not loaded.' 
        });
    }

    // Pure Validation Step
    const is_valid = validate(req.body);

    if (is_valid) {
        // Success: Data is clean and conforms to the schema. Proceed to the Logic Engine.
        next();
    } else {
        // Failure: Airlock Breach Detected. Reject immediately with 400.
        
        // Map errors into a clean, auditable format
        const error_details = validate.errors.map(err => ({
            field: err.instancePath,
            issue: err.message,
            constraint: err.keyword,
            schema_path: err.schemaPath,
        }));
        
        const error_message = `Airlock Validation Failed against ${schema_name}.`;
        
        // Respond with a 400 Bad Request and detailed AJV error audit trail
        res.status(400).json({
            message: error_message,
            errors: error_details,
        });
    }
};

module.exports = {
    createAirlockValidator: create_airlock_validator,
};
