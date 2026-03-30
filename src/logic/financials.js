// src/logic/financials.js

// Placeholder for external Rate data (usually loaded from an external config or service)
const DEFAULT_RATES = {
    // Current qualifying rate for stress test (e.g., Bank of Canada 5.25% or contract rate + 2%)
    QUALIFYING_RATE: 0.0525, 
    // Max permitted GDS (Gross Debt Service) ratio
    MAX_GDS_RATIO: 0.32, 
    // Max permitted TDS (Total Debt Service) ratio
    MAX_TDS_RATIO: 0.40,
    // Typical amortization period in years
    AMORTIZATION_YEARS: 25,
};

// --- PURE FINANCIAL UTILITIES ---

/**
 * Pure function to convert an annual interest rate to a monthly decimal rate.
 *
 * @param {number} annual_rate - The annual decimal interest rate (e.g., 0.0525).
 * @returns {number} The monthly decimal interest rate.
 */
const calculate_monthly_rate = annual_rate => annual_rate / 12;

/**
 * Pure function to calculate the monthly mortgage payment (Principal and Interest).
 * M = P [ i(1 + i)^n ] / [ (1 + i)^n – 1 ]
 *
 * @param {number} principal - The loan amount.
 * @param {number} monthly_rate - The monthly decimal interest rate.
 * @param {number} total_months - The total number of payments (e.g., amortization * 12).
 * @returns {number} The required monthly mortgage payment.
 */
const calculate_monthly_payment = (principal, monthly_rate, total_months) => {
    if (monthly_rate === 0) return principal / total_months;

    const power = Math.pow(1 + monthly_rate, total_months);
    const numerator = principal * monthly_rate * power;
    const denominator = power - 1;

    return numerator / denominator;
};

/**
 * Pure helper function to aggregate all monthly debt payments.
 * Uses the new applicant.monthly_debts structure from the LeadSchema.
 *
 * @param {Object} monthly_debts - The applicant's detailed monthly debt object.
 * @returns {number} The total sum of all non-housing monthly debt obligations.
 */
const calculate_total_monthly_obligations = (monthly_debts) => {
    const { 
        credit_card_payments, 
        car_loan_payments, 
        other_loan_payments, 
        alimony_or_child_support 
    } = monthly_debts;

    // Sum all required debt fields
    return (
        credit_card_payments + 
        car_loan_payments + 
        other_loan_payments + 
        (alimony_or_child_support || 0) // Treat optional field as 0 if missing
    );
};


// --- PURE SCORER FUNCTIONS (The Core Business Logic) ---

/**
 * Calculates the Total Debt Servicing (TDS) Ratio. (Capacity Check)
 * TDS = (P&I + Taxes + Heating + Condo Fees + All Other Monthly Debt) / Gross Monthly Income
 *
 * @param {number} loan_amount - The principal amount of the mortgage being tested.
 * @param {Object} applicant - Applicant financial data.
 * @param {Object} property - Property data (taxes, heating, etc.).
 * @param {Object} rates - Configured interest rates and constants.
 * @returns {number} The calculated TDS ratio (decimal).
 */
const calculate_tds_ratio = (loan_amount, applicant, property, rates) => {
    // 1. Calculate Monthly Mortgage Payment (P&I)
    const monthly_rate = calculate_monthly_rate(rates.QUALIFYING_RATE);
    const total_months = rates.AMORTIZATION_YEARS * 12;
    const monthly_pi = calculate_monthly_payment(loan_amount, monthly_rate, total_months);

    // 2. Sum up Housing Expenses (PITH+C)
    const monthly_taxes = property.annual_taxes / 12;
    const monthly_heating = property.monthly_heating_cost; 
    const monthly_condo_fee = property.monthly_condo_fee || 0;

    const total_housing_debt = monthly_pi + monthly_taxes + monthly_heating + monthly_condo_fee;

    // 3. Sum up Total Non-Housing Debt (Uses new helper function)
    const total_monthly_obligations = calculate_total_monthly_obligations(applicant.monthly_debts); // CORRECTED

    // 4. Sum up Total Debt Servicing
    const total_monthly_debt = total_housing_debt + total_monthly_obligations;

    // 5. Calculate Gross Monthly Income
    const gross_monthly_income = applicant.annual_gross_income / 12;

    // Safety check against near-zero income (minimum 1 enforced by schema)
    if (gross_monthly_income < 0.001) return Infinity; 

    // 6. Final TDS Ratio
    const tds_ratio = total_monthly_debt / gross_monthly_income;

    return tds_ratio;
};

// --- PUBLIC API EXPORT ---

module.exports = {
    // Core rates and constants
    DEFAULT_RATES,

    // Core pure utilities
    calculate_monthly_rate,
    calculate_monthly_payment,
    calculate_total_monthly_obligations, // Exported for unit testing

    // Core scorer functions
    calculate_tds_ratio,
};
