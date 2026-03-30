// src/system/dependencyGraph.js
const { findMaxPermittedValue } = require('../logic/solver/binarySearch');
const { calculate_tds_ratio, DEFAULT_RATES } = require('../logic/financials');

// --- PURE APPLICATION LOGIC ---

/**
 * Pure function to map a raw request body into a standardized lead event object.
 *
 * @param {Object} rawData - The raw data payload (e.g., from req.body).
 * @returns {Object} The standardized Lead Event object.
 */
const map_raw_to_event = rawData => ({
    type: 'LEAD_CAPTURED',
    timestamp: new Date().toISOString(),
    leadData: rawData,
    status: 'NEW',
    processingSteps: [],
});

/**
 * Curried function factory for the Lead Event Appender.
 *
 * @param {Function} append_event_io - The curried GCS I/O handler: (file) => (event) => Promise.
 * @returns {Function} A function that takes the file reference (e.g., LeadFile).
 */
const create_lead_event_appender = append_event_io => fileReference =>
    /**
     * The curried application function that takes the new lead data.
     * @param {Object} rawLeadData - The raw lead data from the input source.
     * @returns {Promise<string>} Resolves with the filename on successful write.
     */
    rawLeadData => {
        const newEvent = map_raw_to_event(rawData);
        return append_event_io(fileReference)(newEvent);
    };

// --- PURE FINANCIAL SOLVER BINDING ---

/**
 * Curried function factory that binds the pure TDS calculation logic to the Binary Search Solver.
 * This creates the final application-level function for calculating the Max Loan Amount.
 *
 * @param {Function} solver - The curried solver: (scorer) => (params) => value.
 * @param {Function} tdsScorer - The pure function: (loanAmount, applicant, property, rates) => TDS_Ratio.
 * @returns {Function} A strictly curried function for max loan calculation.
 */
const create_max_loan_finder = solver => tdsScorer => applicantData => propertyData => ratesConfig => 
    /**
     * The curried function that executes the solver with the final parameters.
     *
     * @param {Object} searchParams - The search boundaries ({ targetScore, low, high, precision }).
     * @returns {number} The maximum permitted loan amount.
     */
    searchParams => {
        // 1. Create a partial application of the TDS scorer.
        const partialTdsScorer = loanAmount => tdsScorer(
            loanAmount, 
            applicantData, 
            propertyData, 
            ratesConfig
        );

        // 2. Inject the fully parameterized scorer into the curried solver and execute.
        const loanFinder = solver(partialTdsScorer);
        return loanFinder(searchParams);
    };


// --- PUBLIC DEPENDENCY GRAPH BUILDER (Strictly Curried) ---

/**
 * Main function to create the entire dependency graph (The Logic Engine).
 *
 * @param {Object} storageGateway - Object containing GCS I/O functions.
 * @returns {Function} A function that accepts Financial Logic dependencies.
 */
const get_app_functions = storageGateway => financialLogic => engineLogic => () => { // <--- Currying Chain Extended
    
    // --- 1. Storage Dependencies ---
    const leadLogFile = 'data/leads/LeadLog.json';
    const appenderFactory = create_lead_event_appender(storageGateway.appendEvent);
    const appendLeadEvent = appenderFactory(leadLogFile);

    // --- 2. Financial/Solver Dependencies ---
    // Inject the raw functions needed to build the final curried solver function
    const maxLoanFinderFactory = create_max_loan_finder(
        financialLogic.findMaxPermittedValue 
    )(
        financialLogic.tdsScorer 
    );
    
    // The final result is still curried: (applicantData => propertyData => ratesConfig => searchParams).
    const findMaxLoanAmount = maxLoanFinderFactory;
    
    // --- 3. Engine Dependencies ---
    // The final result is: (ruleset, clientData) => finalState
    const processLead = engineLogic.ruleProcessor;

    return {
        // Export I/O-related functions
        appendLeadEvent,
        // Export Calculation/Solver functions
        findMaxLoanAmount,
        // Export Rule Execution functions
        processLead,
    };
};

module.exports = {
    // Map the snake_case definition to the required public camelCase API
    getAppFunctions: get_app_functions,
};
