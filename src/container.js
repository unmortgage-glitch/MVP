const path = require('node:path');
const authMiddleware = require('./security/authMiddleware');
const createAdminRoutes = require('./routes/adminRoutes');
const ruleProcessor = require('./logic/engine/ruleProcessor');
const createRepository = require('./data/repository/clientRepo');

// -- CONFIG --
const config = {
    dbPath: path.join(__dirname, '../data/clients.json'),
    security: {
        adminUser: process.env.ADMIN_USER || 'admin', 
        adminPass: process.env.ADMIN_PASS || 'secure'
    },
    lendingRules: {
        minScore: 680,
        ratios: { maxGDS: 39, maxTDS: 44 },
        minDown: 5, maxLTV: 95,
        excludedTypes: ['Mobile Home', 'Raw Land']
    }
};

// -- MUTEX --
const createMutex = () => {
    let chain = Promise.resolve();
    return fn => (...args) => {
        chain = chain.then(() => fn(...args)).catch(console.error);
        return chain;
    };
};

const bootstrap = () => {
    // 1. Repo & Mutex
    const rawRepo = createRepository({ dbPath: config.dbPath });
    const writeLock = createMutex();
    const safeRepo = { ...rawRepo, save: writeLock(rawRepo.save) };

    // 2. Logic
    const engine = ruleProcessor.processApplication(config.lendingRules);

    // 3. Adapter Layer
    const services = {
        crmService: {
            getAllClients: safeRepo.getAll,
            getClientById: safeRepo.getById,
            saveClient: safeRepo.save
        },
        ruleProcessor: { execute: engine }
    };

    const adminRouter = createAdminRoutes(services);
    const security = authMiddleware(config.security);

    return { config, security, adminRouter };
};

module.exports = bootstrap();
