// src/system/configLoader.js
const fs = require('fs');
const path = require('path');

// --- PURE CORE LOGIC ---

/**
 * Pure function to get default settings.
 *
 * @returns {Object} The default configuration object.
 */
const get_default_config = () => ({
    port: 8080,
    log_level: 'info',
    pipeline_status: 'DEV',
    data_directory: 'data',
});

/**
 * Pure function to merge configuration from various sources.
 *
 * @param {Object} defaultConfig - The default configuration settings.
 * @param {Object} fileConfig - Configuration loaded from a local JSON file.
 * @param {Object} envVars - Selected environment variables (e.g., PORT, GCP_PROJECT_ID).
 * @returns {Object} The finalized, merged configuration object.
 */
const merge_configs = (defaultConfig, fileConfig, envVars) => ({
    ...defaultConfig,
    ...fileConfig,
    // Environment variables always override
    port: envVars.PORT || defaultConfig.port,
    project_id: envVars.GCP_PROJECT_ID,
    bucket_name: envVars.BUCKET_NAME,
    log_level: envVars.LOG_LEVEL || defaultConfig.log_level,
});


// --- PUBLIC CURRIED API (Side-Effect Delayed) ---

/**
 * Curried function to create the Configuration Loader.
 *
 * @param {string} configFileName - Name of the configuration file (e.g., Config.json).
 * @returns {Function} A function that handles I/O and returns the final configuration object.
 * @throws {Error} if critical environment variables are missing.
 */
const load_config = configFileName => () => {
    // 1. Prepare Environment Variables (Impure Read Side Effect)
    const envVars = {
        PORT: process.env.PORT,
        GCP_PROJECT_ID: process.env.GCP_PROJECT_ID,
        BUCKET_NAME: process.env.BUCKET_NAME,
        LOG_LEVEL: process.env.LOG_LEVEL,
    };

    // Check for critical variables (Impure Flow Control/Side Effect)
    if (!envVars.GCP_PROJECT_ID || !envVars.BUCKET_NAME) {
        throw new Error('FATAL CONFIG ERROR: GCP_PROJECT_ID and BUCKET_NAME must be set in environment.');
    }

    // 2. Read Default Configuration (Pure)
    const defaultConfig = get_default_config();

    // 3. Read File Configuration (Impure I/O Side Effect)
    const configPath = path.join(process.cwd(), configFileName);
    let fileConfig = {}; // Use let/mutation only within this side-effect wrapper

    try {
        const fileContent = fs.readFileSync(configPath, 'utf8');
        fileConfig = JSON.parse(fileContent);
        console.log(`[CONFIG] Loaded file config from: ${configFileName}`);
    } catch (e) {
        // Gracefully handle file not found, relying on defaults/env
        if (e.code === 'ENOENT') {
            console.warn(`[CONFIG] Warning: Configuration file not found at ${configPath}. Using defaults/environment variables.`);
        } else {
            console.error(`[CONFIG] Error parsing config file ${configFileName}: ${e.message}. Using defaults/environment variables.`);
        }
    }

    // 4. Pure Merge and Final Return
    return merge_configs(defaultConfig, fileConfig, envVars);
};

module.exports = {
    // Export the side-effect loader function (using its camelCase public API name)
    loadConfig: load_config,
    // Export pure functions for composition/testing
    get_default_config,
    merge_configs,
};
