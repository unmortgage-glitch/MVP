/**
 * DATA LAYER: Client Repository (The Vault)
 * Mandate: Functional, Atomic Writes, fs/promises
 * Strategy: Write-Copy-Replace (prevents data corruption)
 */

const fs = require('node:fs/promises');
const path = require('node:path');

// -- PURE HELPERS --

const serialize = data => JSON.stringify(data, null, 2);

const deserialize = json => json ? JSON.parse(json) : [];

const getPaths = dbPath => ({
    main: dbPath,
    temp: `${dbPath}.tmp`
});

// -- IMPURE I/O OPERATIONS (Curried) --

const writeTemp = tempPath => dataStr => 
    fs.writeFile(tempPath, dataStr, 'utf8');

const moveTempToMain = tempPath => mainPath => 
    fs.rename(tempPath, mainPath);

const readDb = dbPath => 
    fs.readFile(dbPath, 'utf8')
        .catch(err => {
            if (err.code === 'ENOENT') return '[]'; 
            throw err; 
        })
        .then(deserialize);

// -- CORE REPOSITORY LOGIC --

const saveClient = config => client => {
    const { main, temp } = getPaths(config.dbPath);
    // Pipeline: Read -> Modify -> Serialize -> WriteTemp -> Rename -> Return
    return readDb(main)
        .then(currentList => {
            const existingIndex = currentList.findIndex(c => c.id === client.id);
            const newList = existingIndex >= 0 
                ? currentList.map(c => c.id === client.id ? client : c) // Update
                : [...currentList, client]; // Insert
            
            return newList;
        })
        .then(newList => {
            const dataStr = serialize(newList);
            // The Atomic Dance
            return writeTemp(temp)(dataStr)
                .then(() => moveTempToMain(temp)(main));
        })
        .then(() => client);
};

const getAllClients = config => () => 
    readDb(config.dbPath);

const getClientById = config => id => 
    readDb(config.dbPath)
        .then(list => list.find(c => c.id === id) || null);

// -- EXPORT FACTORY --

const createRepository = config => ({
    save: saveClient(config),
    getAll: getAllClients(config),
    getById: getClientById(config)
});

module.exports = createRepository;
