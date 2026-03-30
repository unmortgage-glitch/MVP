// server.js — Kenward CMS v2
// Full ESM. Pure functional. No classes.

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// VERIFY: kernelRoutes must export script_cache as a named export alongside default router.
// Expected shape in kernelRoutes.js:
//   export const script_cache = new Map();
//   export default router;
import kernelRouter, { script_cache } from './src/routes/kernelRoutes.js';
import leadRouter from './src/routes/leadRoutes.js';

// uploadRoutes is a factory — must be called with script_cache
// Expected shape: export default function createUploadRouter(script_cache) { ... }
import createUploadRouter from './src/routes/uploadRoutes.js';

// notifyRoutes is a service, not a router — do not mount it.
// Other route modules call it directly.

import { readLeads, readLead } from './src/system/storage.js';
import { verifySessionToken } from './src/security/tokenService.js';

// ─── Environment guard ────────────────────────────────────────────────────────
const REQUIRED_ENV = ['JWT_SECRET', 'RSA_PRIVATE_KEY_PATH'];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[FATAL] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

// ─── Path setup ───────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── App init ─────────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

// ─── View engine ──────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Broker auth middleware ───────────────────────────────────────────────────
// Protects all /broker/* routes.
// Accepts Authorization: Bearer <token> header OR ?token= query param.
const brokerAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const tokenFromQuery = req.query.token;

  const raw = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : tokenFromQuery;

  if (!raw) {
    return res.status(401).render('error', {
      message: 'Authentication required.',
      code: 401,
    });
  }

  const result = verifySessionToken(raw);

  if (!result?.valid) {
    return res.status(403).render('error', {
      message: 'Session invalid or expired.',
      code: 403,
    });
  }

  req.tenantId = result.tenantId;
  req.brokerId = result.brokerId;
  next();
};

// ─── API routes ───────────────────────────────────────────────────────────────
app.use('/api/v2', kernelRouter);
app.use('/api/v2/leads', leadRouter);

const uploadRouter = createUploadRouter(script_cache);
app.use('/', uploadRouter);

// ─── Broker dashboard ─────────────────────────────────────────────────────────
app.get('/broker/dashboard', brokerAuthMiddleware, async (req, res) => {
  try {
    const result = await readLeads(req.tenantId);
    if (!result.ok) throw new Error(result.error);
    res.render('broker/dashboard', {
      leads: result.data,
      tenantId: req.tenantId,
      brokerId: req.brokerId,
    });
  } catch (err) {
    console.error('[/broker/dashboard]', err);
    res.status(500).render('error', { message: 'Failed to load dashboard.', code: 500 });
  }
});

// ─── Broker lead detail ───────────────────────────────────────────────────────
app.get('/broker/lead/:id', brokerAuthMiddleware, async (req, res) => {
  try {
    const result = await readLead(req.tenantId, req.params.id);
    if (!result.ok) {
      return res.status(404).render('error', { message: 'Lead not found.', code: 404 });
    }
    res.render('broker/lead-detail', {
      lead: result.data,
      tenantId: req.tenantId,
      brokerId: req.brokerId,
    });
  } catch (err) {
    console.error('[/broker/lead/:id]', err);
    res.status(500).render('error', { message: 'Failed to load lead.', code: 500 });
  }
});

// ─── Borrower-facing standalone pages ────────────────────────────────────────
app.get('/self-assessment', (req, res) => {
  const { token, leadId } = req.query;
  if (!token || !leadId) {
    return res.status(400).render('error', { message: 'Invalid link.', code: 400 });
  }
  res.render('self-assessment', { token, leadId });
});

app.get('/upload/:token', (req, res) => {
  res.render('upload-portal', { token: req.params.token });
});

// ─── Error handlers ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found.', code: 404 });
});

app.use((err, req, res, next) => {
  console.error('[Unhandled error]', err);
  res.status(500).render('error', { message: 'Internal server error.', code: 500 });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Kenward] Server running on port ${PORT}`);
  console.log(`[Kenward] NODE_ENV=${process.env.NODE_ENV || 'development'}`);
  console.log(`[Kenward] script_cache loaded with ${script_cache.size} script(s)`);
});
