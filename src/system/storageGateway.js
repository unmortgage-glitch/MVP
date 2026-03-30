// src/system/storageGateway.js
const { Storage } = require('@google-cloud/storage');

/**
 * Curried function to create the GCS client instance.
 *
 * @param {string} projectId - The Google Cloud Project ID.
 * @returns {Function} A function that returns the initialized GCS Storage client.
 */
const initialize_storage = projectId => () => new Storage({ projectId });

/**
 * Internal pure function: Handles the parsing, appending, and stringifying.
 *
 * @param {string} logContent - The current JSON array string content.
 * @param {Object} newEvent - The event object to append.
 * @returns {string} The updated JSON array string.
 */
const parse_append_stringify = (logContent, newEvent) => {
    try {
        const logArray = JSON.parse(logContent);
        // Functional append: create new array via spread operator
        const newLogArray = [...logArray, newEvent];
        return JSON.stringify(newLogArray, null, 2);
    } catch (e) {
        // Recovery logic: if parsing fails (corrupted file), start a new log.
        return JSON.stringify([newEvent], null, 2);
    }
};

/**
 * Curried Pure function: Takes existing log content first, then the new event.
 * Returns a new JSON string with the event appended. Side-effect free.
 *
 * @param {string} existingJsonContent - The current JSON array string content of the file.
 * @returns {Function} A function that takes the new event object.
 */
const append_to_json_log = existingJsonContent => newEvent => {
    // Treat null/empty content (like a GCS 404 read) as an empty array '[]'
    const contentToParse = existingJsonContent && existingJsonContent.trim()
        ? existingJsonContent
        : '[]';

    return parse_append_stringify(contentToParse, newEvent);
};

/**
 * Curried Side Effect Handler: Reads from GCS, calls the pure logic, and writes back to GCS.
 * Resolves on success, rejects on failure (Functional Output).
 *
 * @param {File} file - The GCS File object (already bound to bucket and path).
 * @returns {Function} A function that takes the new event data.
 * @returns {Promise<string>} Resolves with the filename on success, rejects on error.
 */
const append_event = file => newEvent => {
    const fileName = file.name;
    const eventType = newEvent.type || 'UNKNOWN_EVENT';

    console.log(`[STORAGE] Attempting to read log for file: ${fileName}`);

    // Read operation (Side Effect 1: I/O)
    return file.download()
        .then(([data]) => {
            console.log(`[STORAGE] Successfully read ${data.length} bytes from ${fileName}.`);
            return data.toString();
        })
        .catch(err => {
            // If error is 404 (Not Found), map it to empty log content.
            if (err.code === 404) {
                console.log(`[STORAGE] File not found (${fileName}). Initializing new log.`);
                return ''; // Map 404 to empty content
            }
            // Re-throw other errors
            console.error(`[STORAGE] FATAL READ ERROR for ${fileName}:`, err.message);
            throw err;
        })
        .then(existingJsonContent => {
            // Pure logic call: isolates data manipulation via curried function
            const updateLog = append_to_json_log(existingJsonContent);
            return updateLog(newEvent);
        })
        .then(updatedJsonContent => {
            console.log(`[STORAGE] Writing updated log (${eventType}) to ${fileName}.`);
            // Write operation (Side Effect 2: I/O)
            return file.save(updatedJsonContent)
                .then(() => {
                    console.log(`[STORAGE] Event ${eventType} successfully written to ${fileName}.`);
                    // Return the filename, letting the promise resolve normally.
                    return fileName;
                });
        })
        .catch(err => {
            // Side Effect 3: Logging/Error Handling. Throw the error for Promise rejection.
            console.error(`[STORAGE] FATAL PROCESS/WRITE ERROR for ${fileName} on event ${eventType}:`, err.message);
            throw err; // Functional: Propagate the error out of the Promise chain
        });
};

module.exports = {
    // Map snake_case definitions to the public camelCase API
    initializeStorage: initialize_storage,
    appendEvent: append_event,
    appendToJsonLog: append_to_json_log, // Exported for pure unit testing
};
