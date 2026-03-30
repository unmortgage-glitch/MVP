// src/routes/lead-api.js
const express = require('express');
const router = express.Router();
const { validateLead } = require('../ajv-config'); 
const { executePipeline } = require('../processors/calculationExecutor'); 

// Assume this package is installed or is a system built-in in Node 16+
const { randomUUID } = require('crypto'); 

// --- Simulation of Google Cloud Storage/File I/O Service ---
// In a functional style, this function handles the side effect of I/O.
const saveLead = async (leadData) => {
    // NOTE: This is a placeholder for your Cloud Storage file versioning (Event Sourcing).
    // It would save the lead to a JSON file in the /leads/Active folder.
    console.log(`[STORAGE] Simulating save of Lead ${leadData.leadId} to /leads/Active...`);
    // Placeholder for actual file writing logic...
    return { success: true, message: 'Lead saved and versioned.' };
};

// --- Middleware Pipeline Functions ---

/**
 * STEP 1: Validate input against LeadSchema.json (Rule 2: Input Validation)
 */
const leadValidationMiddleware = (req, res, next) => {
    if (!validateLead(req.body)) {
        console.error('Lead validation failed:', validateLead.errors);
        return res.status(400).json({
            message: 'Lead submission failed validation against LeadSchema.json.',
            errors: validateLead.errors
        });
    }
    // Data is clean. Attach it for the next step.
    req.validatedLead = req.body;
    next();
};

/**
 * STEP 2: Execute business logic and storage (Rule 1 & 4: Logic as Data & No DBs)
 */
const leadProcessingController = async (req, res) => {
    let lead = req.validatedLead;
    
    // 1. Enrich the lead with system data
    // Use the randomUUID function imported from 'crypto'
    lead.leadId = lead.leadId || randomUUID(); 
    lead.submissionDate = new Date().toISOString();
    lead.status = lead.status || 'Active';

    // 2. Execute the Logic as Data Pipeline (GDS/TDS calculation)
    try {
        lead = executePipeline(lead); // Mutates the lead object based on JSON rules
        console.log(`[PROCESS] Lead ${lead.leadId} processed. TDS: ${lead.capacity.calculatedTDS}`);
    } catch (error) {
        console.error("Pipeline execution failed:", error);
        return res.status(500).json({ message: 'Internal calculation pipeline failure.' });
    }

    // 3. Save the final, processed lead to Cloud Storage (Event Sourcing)
    try {
        const result = await saveLead(lead); 
        
        // Final response using the company slogan!
        res.status(201).json({
            message: `Lead created and processed successfully. ${result.message} Our motto: "Be secure. Be well. Thrive"`,
            leadId: lead.leadId,
            status: lead.status,
            calculatedTDS: lead.capacity.calculatedTDS
        });
    } catch (error) {
        console.error("Storage failed:", error);
        res.status(500).json({ message: 'Failed to write lead to Cloud Storage.' });
    }
};

// --- Route Definition ---
router.post('/lead', 
    leadValidationMiddleware, // Input must be valid
    leadProcessingController // Execute logic and storage
);

module.exports = router;
