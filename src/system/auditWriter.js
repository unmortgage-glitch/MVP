// src/system/auditWriter.js
const fs = require('fs');
const path = require('path');
const { validateAuditLog } = require('../ajv-config'); // Requires updating ajv-config.js
const { randomUUID } = require('crypto'); 

const AUDIT_LOGS_DIR = path.join(__dirname, '..', '..', 'system', 'Audit Logs');

/**
 * Creates a valid audit record and writes it to the system log folder.
 * @param {object} logData - The audit log data payload.
 */
const writeAuditLog = (logData) => {
    // 1. Enrich the log record
    const record = {
        auditId: randomUUID(),
        timestamp: new Date().toISOString(),
        ...logData 
    };

    // 2. Validate the record against the schema (Crucial step for integrity)
    if (!validateAuditLog(record)) {
        console.error("FATAL AUDIT ERROR: Audit log record failed validation!", validateAuditLog.errors);
        // We log the failure but do not throw, as logging should not stop core business logic.
        return false; 
    }

    // 3. Define the storage location (Event Sourcing)
    const logFileName = `${record.timestamp.replace(/:/g, '-')}-${record.targetType}-${record.targetId}.json`;
    const logFilePath = path.join(AUDIT_LOGS_DIR, logFileName);

    // 4. Write the file (The side effect)
    try {
        fs.writeFileSync(logFilePath, JSON.stringify(record, null, 2));
        console.log(`[AUDIT] Successfully logged: ${record.eventType} on ${record.targetType} ${record.targetId}`);
        return true;
    } catch (error) {
        console.error(`[AUDIT] Failed to write file to storage: ${error.message}`);
        return false;
    }
};

module.exports = {
    writeAuditLog
};
