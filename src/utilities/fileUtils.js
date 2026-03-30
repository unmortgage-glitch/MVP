const fs = require('fs').promises;
const path = require('path');

/**
 * Helper: Loads and parses a JSON file.
 * @param {string} filePath - The path to the file (e.g., './content/live/home.json')
 */
const loadJson = async (filePath) => {
    try {
        // Read the file from the disk
        const rawData = await fs.readFile(filePath, 'utf8');
        // Convert text to JavaScript Object
        return JSON.parse(rawData);
    } catch (error) {
        console.error(`❌ [FileUtils] Failed to load: ${filePath}`);
        throw error; // Pass the error up so the server knows it failed
    }
};

/**
 * Helper: Saves an object as a JSON file.
 * @param {string} filePath - Where to save
 * @param {Object} data - The data to save
 */
const saveJson = async (filePath, data) => {
    try {
        const jsonString = JSON.stringify(data, null, 2); // Pretty print
        await fs.writeFile(filePath, jsonString, 'utf8');
        return true;
    } catch (error) {
        console.error(`❌ [FileUtils] Failed to save: ${filePath}`, error);
        throw error;
    }
};

module.exports = { loadJson, saveJson };
