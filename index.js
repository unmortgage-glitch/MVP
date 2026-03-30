// index.js
const express = require('express');

// --- Import System Utilities (Snake_case Renaming Enforced) ---
const { 
    initializeStorage: initialize_storage, 
    appendEvent: append_event 
} = require('./src/system/storageGateway');

const { 
    loadConfig: load_config 
} = require('./src/system/configLoader');

const { 
    initializeAjv: initialize_ajv 
} = require('./ajv_config');

const { 
    getAppFunctions: get_app_functions 
} = require('./src/system/dependencyGraph');

const {
    loadRuleset: load_ruleset
} = require('./src/logic/engine/ruleLoader');

// --- Import Logic Components ---
const { 
    findMaxPermittedValue: find_max_permitted_value 
} = require('./src/logic/solver/binarySearch');

const { 
    calculate_tds_ratio: tds_scorer, 
    DEFAULT_RATES: default_rates 
} = require('./src/logic/financials');

const {
    evaluateFormula: evaluate_formula_init
} = require('./src/logic/engine/formula_evaluator');

const {
    createRuleProcessor: create_rule_processor
} = require('./src/logic/engine/ruleProcessor');

// --- Import Middleware (New) ---
const {
    createAirlockValidator: create_airlock_validator
} = require('./src/middleware/airlock_validator');


// --- PURE CORE CONFIGURATION ---

/**
 * Curried function to create the Express application.
 *
 * @param {Object} app_functions - The final API object.
 * @returns {Function} A function that takes the System Config and Compiled Ruleset grouped together.
 */
const create_express_app = app_functions => ({ config, ruleset, airlock_validator }) => { 
    const app = express();
    const port = config.port;
    const bucket_name = config.bucket_name; 

    app.use(express.json());

    // Health Check / Landing Route
    app.get('/', (req, res) => {
        const slogan = "Be secure. Be well. Thrive"; 
        res.status(200).send(`
            <h1>Kenward Mortgage CRM (Unbreakable Pipeline)</h1>
            <p>Status: Running on port ${port}. Slogan: ${slogan}</p>
            <p>GCS Target: ${bucket_name}</p>
            <p>Active Ruleset: ${ruleset.name} (${ruleset.rules.length} rules loaded)</p>
            <p>Endpoints: POST /log, POST /solve, POST /process (Requires LeadSchema validation)</p>
        `);
    });

    // Logging Route (I/O Side Effect)
    app.post('/log', (req, res) => {
        app_functions.appendLeadEvent(req.body) 
            .then(file_name => { 
                res.status(201).json({
                    message: 'Event logged successfully (Lead captured).',
                    file: file_name, 
                });
            })
            .catch(error => {
                console.error('API Log Error:', error);
                res.status(500).json({
                    message: 'Failed to write event to GCS.',
                    error: error.message,
                });
            });
    });

    // Solver Route (Pure Logic Execution)
    app.post('/solve', (req, res) => {
        try {
            const { applicant, property, searchParams: search_params } = req.body; 
            
            const max_loan_amount = app_functions.findMaxLoanAmount(applicant)(property)(default_rates)(search_params); 

            res.status(200).json({
                message: 'Max loan calculated successfully based on TDS constraint.',
                max_tds_ratio: default_rates.MAX_TDS_RATIO,
                max_loan_amount: max_loan_amount, 
            });

        } catch (e) {
            console.error('API Solver Error:', e.message);
            res.status(400).json({
                message: 'Failed to solve loan amount.',
                error: e.message,
            });
        }
    });

    // Core Logic Engine Execution Route (Airlock Gate 2 + Pure Execution + I/O Reporting)
    // The airlock_validator middleware ensures req.body is clean before the logic runs.
    app.post('/process', airlock_validator, async (req, res) => { 
        const client_data = req.body; 

        // 1. Execute Ruleset (Pure Logic) - Only runs if validated by middleware
        try {
            const final_state = app_functions.processLead(ruleset, client_data); 
            
            // 2. Report Result (I/O Side Effect)
            const log_event = { 
                type: 'LEAD_PROCESSED',
                ruleset: ruleset.name,
                status: 'PASSED',
                final_results: final_state.results,
                audit_summary: final_state.auditTrail.filter(a => a.status !== 'PASSED'),
            };
            const file_name = await app_functions.appendLeadEvent(log_event); 

            res.status(200).json({
                message: 'Ruleset processing PASSED. Audit trail logged to GCS.',
                audit_trail: final_state.auditTrail,
                results: final_state.results,
                log_file: file_name, 
                final_status: 'SUITABLE',
            });
        } catch (e) {
            // Catches validation failures thrown by the rule processor
            const final_state = e.finalState || null; 
            
            // 2. Report Failure (I/O Side Effect)
            const log_event = { 
                type: 'LEAD_REJECTED',
                ruleset: ruleset.name,
                status: 'REJECTED',
                failure_reason: e.message,
                failing_rule: e.ruleName,
                audit_summary: final_state ? final_state.auditTrail : null, 
            };
            const file_name = await app_functions.appendLeadEvent(log_event); 
            
            res.status(403).json({
                message: 'Ruleset processing FAILED: Validation check rejected the lead. Audit trail logged to GCS.',
                failure_reason: e.message,
                failed_rule: e.ruleName,
                audit_trail: final_state ? final_state.auditTrail : null, 
                log_file: file_name, 
            });
        }
    });

    return app;
};

// --- IMPURE APPLICATION INITIALIZATION (Entry Point) ---

/**
 * Main entry point function that handles I/O and environment dependencies.
 */
const start_server = async () => {
    try {
        // --- 1. Load System Configuration (I/O Side Effect) ---
        const execute_config_load = load_config('Config.json');
        const config = execute_config_load();
        
        console.log(`[INIT] Configuration loaded. Project: ${config.project_id}`);

        // --- 2. Initialize Core Systems (I/O Side Effects) ---
        
        const get_storage_client = initialize_storage(config.project_id); 
        const storage_client = get_storage_client(); 
        const bucket = storage_client.bucket(config.bucket_name); 

        // Initialize AJV Validator (I/O Side Effect: Airlock Gate 1)
        const execute_ajv_init = initialize_ajv(__dirname);
        const ajv_validator = execute_ajv_init(); 

        // Initialize Formula Evaluator (Pure)
        const execute_formula_eval = evaluate_formula_init();
        const formula_evaluator = execute_formula_eval(); 

        // --- 3. Ruleset Loading (I/O Side Effect: Compiles & Validates) ---
        const rule_loader_dependencies = { 
            ajvValidator: ajv_validator, 
            briefCompiler: { compileBriefToJSON: require('./src/logic/compiler/briefCompiler').compileBriefToJSON }, 
            ruleSchemaName: 'RuleSetSchema'
        };
        const execute_ruleset_load = load_ruleset(rule_loader_dependencies); 
        const ruleset = await execute_ruleset_load('briefs/mortgage_suitability.brief');

        // --- 4. Build Application Functions (Pure Logic Injection) ---
        
        const storage_gateway = { appendEvent: append_event }; 
        const financial_logic = { 
            findMaxPermittedValue: find_max_permitted_value, 
            tdsScorer: tds_scorer 
        };
        const engine_logic = { 
            ruleProcessor: create_rule_processor(formula_evaluator) 
        };

        const get_final_app_functions = get_app_functions(storage_gateway)(financial_logic)(engine_logic); 
        const app_functions = get_final_app_functions(); 
        
        // --- 5. Initialize Middleware (Airlock Gate 2) ---
        const create_airlock_middleware = create_airlock_validator(ajv_validator);
        const airlock_validator = create_airlock_middleware; // The resulting middleware function

        // --- 6. Start Express Server (I/O Side Effect) ---
        
        // Pass the grouped dependencies { config, ruleset, airlock_validator } to the pure app factory
        const app = create_express_app(app_functions)({ config, ruleset, airlock_validator }); 
        const port = config.port;

        app.listen(port, () => {
            console.log(`Server listening on port ${port}`);
            console.log(`GCS connection established for bucket: ${config.bucket_name}`);
            console.log(`\n🎉 Phase 1 & 2 Complete: Logic Engine is Fully Operational and Auditable.`);
        });

    } catch (error) {
        console.error('FATAL SYSTEM BOOT ERROR:', error.message, error.cause ? error.cause : '');
        process.exit(1);
    }
};

// Execute the main entry point
start_server();
