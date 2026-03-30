// cleanup-v2.js
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const PROJECT_ROOT = __dirname;
const VIEWS_DIR = path.join(PROJECT_ROOT, 'views');
const PARTIALS_DIR = path.join(VIEWS_DIR, 'partials');
const NESTED_BLOCKS_DIR = path.join(PARTIALS_DIR, 'blocks');
const LAYOUTS_DIR = path.join(VIEWS_DIR, 'layouts');

// Structural files to move from 'views' root to 'views/layouts'
const STRUCTURAL_FILES_TO_MOVE = [
    'header.ejs',
    'footer.ejs',
    'hero.ejs',
    'land-acknowledgement.ejs'
];

/**
 * Executes a file rename/move operation.
 * @param {string} oldPath
 * @param {string} newPath
 */
const moveFile = (oldPath, newPath) => {
    if (fs.existsSync(oldPath)) {
        try {
            const targetDir = path.dirname(newPath);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }
            fs.renameSync(oldPath, newPath);
            console.log(`- MOVED: ${path.relative(VIEWS_DIR, oldPath)} -> ${path.relative(VIEWS_DIR, newPath)}`);
        } catch (error) {
            console.error(`ERROR moving ${oldPath}: ${error.message}`);
        }
    } else {
        console.log(`- SKIP: ${path.basename(oldPath)} not found.`);
    }
};

/**
 * Recursively moves all files from a source directory to a target directory.
 * @param {string} source
 * @param {string} target
 */
const moveAllFiles = (source, target) => {
    if (!fs.existsSync(source)) return;

    const files = fs.readdirSync(source);
    files.forEach(file => {
        const oldPath = path.join(source, file);
        const newPath = path.join(target, file);
        moveFile(oldPath, newPath);
    });
};

// --- Execution Start ---
console.log('--- Starting FINAL View Structure Cleanup (v2) ---');

// 1. Move structural layout files out of the 'views' root into 'views/layouts'
console.log('\n[1/3] Moving structural files to layouts/');
STRUCTURAL_FILES_TO_MOVE.forEach(fileName => {
    const oldPath = path.join(VIEWS_DIR, fileName);
    const newPath = path.join(LAYOUTS_DIR, fileName);
    moveFile(oldPath, newPath);
});

// 2. Fix the nested structure: Move all content blocks from views/partials/blocks/ 
//    UP one level to views/partials/
console.log('\n[2/3] Moving nested content blocks UP to views/partials/');
moveAllFiles(NESTED_BLOCKS_DIR, PARTIALS_DIR);

// 3. Remove the now-empty nested 'blocks' directory.
console.log('\n[3/3] Removing empty nested blocks directory.');
if (fs.existsSync(NESTED_BLOCKS_DIR) && fs.readdirSync(NESTED_BLOCKS_DIR).length === 0) {
    fs.rmdirSync(NESTED_BLOCKS_DIR);
    console.log(`- REMOVED directory: ${path.relative(VIEWS_DIR, NESTED_BLOCKS_DIR)}`);
} else if (fs.existsSync(NESTED_BLOCKS_DIR)) {
    console.warn(`- WARNING: ${path.relative(VIEWS_DIR, NESTED_BLOCKS_DIR)} is not empty. Skipping removal.`);
} else {
    console.log(`- SKIP: ${path.relative(VIEWS_DIR, NESTED_BLOCKS_DIR)} does not exist.`);
}

console.log(`\n--- FINAL Cleanup Script Finished ---`);
console.log(`\n**ACTION REQUIRED:** Your view paths are now clean! Manually edit views/index.ejs to use the final, correct paths:`);
console.log(`- Layouts (e.g., Header): <%%- include('layouts/header') %%>`);
console.log(`- Blocks: <%%- include('partials/_imageBlock') %%>`);
