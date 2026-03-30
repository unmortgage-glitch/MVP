/**
 * PHASE 5 PLACEHOLDER: Auth Middleware
 * Currently allows ALL traffic. Will be replaced with real security later.
 */

const authMiddleware = (req, res, next) => {
    console.log(`⚠️ [DEV AUTH] Bypass: Allowing access to ${req.originalUrl}`);
    next(); // Pass control to the next handler
};

module.exports = { authMiddleware };
