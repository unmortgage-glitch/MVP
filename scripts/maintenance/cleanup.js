// cleanup.js
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const PROJECT_ROOT = __dirname;
const VIEWS_DIR = path.join(PROJECT_ROOT, 'views');
const OLD_BLOCKS_DIR = path.join(VIEWS_DIR, 'blocks');
const PARTIALS_DIR = path.join(VIEWS_DIR, 'partials');
const LAYOUTS_DIR = path.join(VIEWS_DIR, 'layouts');

// Files to delete from the root 'views' folder (the duplicates)
const DUPLICATE_PARTIALS_TO_DELETE = [
    '_quoteBlock.ejs', // Already moved to blocks/ in the mess
    '_videoBlock.ejs',
    '_calculatorBlock.ejs',
    '_textBlock.ejs'
];

// Structural files to move from 'views' root to 'views/layouts'
const STRUCTURAL_FILES_TO_MOVE = [
    'header.ejs',
    'footer.ejs',
    'hero.ejs', // Assuming 'hero' is a layout component, not a block
    'land-acknowledgement.ejs'
];

/**
 * Executes a file rename/move operation, handling errors.
 * @param {string} oldPath
 * @param {string} newPath
 */
const moveFile = (oldPath, newPath) => {
    if (fs.existsSync(oldPath)) {
        try {
            // Ensure target directory exists before moving
            const targetDir = path.dirname(newPath);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
                console.log(`- Created directory: ${targetDir}`);
            }
            fs.renameSync(oldPath, newPath);
            console.log(`- MOVED: ${path.basename(oldPath)} -> ${path.basename(newPath) || path.basename(targetDir)}`);
        } catch (error) {
            console.error(`ERROR moving ${oldPath}: ${error.message}`);
        }
    } else {
        console.log(`- SKIP: ${path.basename(oldPath)} not found (already moved or deleted).`);
    }
};

/**
 * Deletes a file if it exists.
 * @param {string} filePath
 */
const deleteFile = (filePath) => {
    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
            console.log(`- DELETED: ${path.basename(filePath)} (Duplicate)`);
        } catch (error) {
            console.error(`ERROR deleting ${filePath}: ${error.message}`);
        }
    } else {
        console.log(`- SKIP: ${path.basename(filePath)} not found.`);
    }
};

// --- Execution Start ---
console.log('--- Starting View Structure Cleanup ---');

// 1. RENAME the messy 'blocks' folder to the standard 'partials' folder
console.log('\n[1/3] Renaming blocks/ to partials/');
moveFile(OLD_BLOCKS_DIR, PARTIALS_DIR); // fs.renameSync handles directory renaming

// 2. Move structural layout files out of the 'views' root into 'views/layouts'
console.log('\n[2/3] Moving structural files to layouts/');
STRUCTURAL_FILES_TO_MOVE.forEach(fileName => {
    const oldPath = path.join(VIEWS_DIR, fileName);
    const newPath = path.join(LAYOUTS_DIR, fileName);
    moveFile(oldPath, newPath);
});

// 3. Delete the duplicate partial files found in the 'views' root
console.log('\n[3/3] Deleting duplicate partial files from views root/');
DUPLICATE_PARTIALS_TO_DELETE.forEach(fileName => {
    const filePath = path.join(VIEWS_DIR, fileName);
    deleteFile(filePath);
});

// 4. (Manual Check Reminder) Clean up the inconsistent EJS naming inside 'partials'
console.log('\n--- Cleanup Script Finished ---');
console.log(`\n**ACTION REQUIRED:** Manually check and rename any inconsistent files inside the new ${PARTIALS_DIR} folder (e.g., '_audioBlock-ejs' should be '_audioBlock.ejs').`);
console.log('The next step is to update all EJS `include` calls in your views (e.g., index.ejs) to use the new paths: `layouts/header` and `partials/_imageBlock`.');
