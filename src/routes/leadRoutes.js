// src/routes/leadRoutes.js — Kenward CMS v2
// Lead lifecycle endpoints. Mounted at /api/v2/leads in server.js.
// Broker auth enforced on list/get. Transition and attest use their own auth logic.

import express from 'express';
import { randomUUID } from 'crypto';

import { saveLead, readLead, readLeads } from '../system/storage.js';
import { writeEntry } from '../system/auditWriter.js';
import { verifySessionToken } from '../security/tokenService.js';

// VERIFY: adjust import path to match where kernelExecutor.js lives on OVH.
// The handoff doc says src/logic/engine/kernelExecutor.js — confirm exports.
// import { runScript } from '../logic/engine/kernelExecutor.js';

const router = express.Router();

// ─── Broker auth middleware (local to this router) ────────────────────────────
const requireBroker = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const raw = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!raw) return res.status(401).json({ error: 'Authentication required' });

  const result = verifySessionToken(raw);
  if (!result?.valid) return res.status(403).json({ error: 'Session invalid or expired' });

  req.tenantId = result.tenantId;
  req.brokerId = result.brokerId;
  next();
};

// ─── Valid stage transitions ──────────────────────────────────────────────────
const STAGE_ORDER = [
  'CALCULATOR',
  'BOOKING',
  'PRE_QUESTIONNAIRE',
  'DOC_REQUEST',
  'DOC_UPLOAD',
  'ASSEMBLY',
  'SELF_ASSESSMENT',
  'CONFIRMED',
];

const isValidTransition = (fromStage, toStage) => {
  const from = STAGE_ORDER.indexOf(fromStage);
  const to   = STAGE_ORDER.indexOf(toStage);
  return to !== -1 && (from === -1 || to > from);
};

// ─── POST /api/v2/leads — Create lead from calculator submission ──────────────
router.post('/', async (req, res) => {
  try {
    const {
      tenantId,
      annualIncome,
      downPayment,
      purchasePrice,
      monthlyDebts,
      employmentStatus,
      isFirstTimeBuyer,
      province,
      kernelResults,
    } = req.body;

    // VERIFY: tenantId must be embedded in the calculator EJS page.
    // Broker provisions a tenant and the tenantId is baked into their public
    // calculator page so borrower-created leads land in the right tenant.
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    const lead = {
      id:               randomUUID(),
      tenantId,
      stage:            'CALCULATOR',
      status:           'ACTIVE',
      warns:            [],
      history:          [{ stage: 'CALCULATOR', at: new Date().toISOString() }],
      createdAt:        new Date().toISOString(),
      updatedAt:        new Date().toISOString(),

      // Calculator inputs
      annualIncome:     annualIncome     ?? null,
      downPayment:      downPayment      ?? null,
      purchasePrice:    purchasePrice    ?? null,
      monthlyDebts:     monthlyDebts     ?? null,
      employmentStatus: employmentStatus ?? null,
      isFirstTimeBuyer: isFirstTimeBuyer ?? null,
      province:         province         ?? null,

      // Affordability kernel results
      kernelResults:    kernelResults    ?? null,

      // Populated by later stages
      borrowerName:     null,
      email:            null,
      phone:            null,
      docs:             [],
    };

    const saveResult = await saveLead(tenantId, lead);
    if (!saveResult.ok) throw new Error(saveResult.error);

    await writeEntry(tenantId, {
      event:  'LEAD_CREATED',
      leadId: lead.id,
      stage:  lead.stage,
    }, process.env.RSA_PRIVATE_KEY_PATH);

    res.status(201).json({ ok: true, leadId: lead.id, lead });
  } catch (err) {
    console.error('[POST /leads]', err);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// ─── GET /api/v2/leads — List all leads for tenant (broker only) ──────────────
router.get('/', requireBroker, async (req, res) => {
  try {
    const result = await readLeads(req.tenantId);
    if (!result.ok) throw new Error(result.error);
    res.json({ ok: true, leads: result.data });
  } catch (err) {
    console.error('[GET /leads]', err);
    res.status(500).json({ error: 'Failed to list leads' });
  }
});

// ─── GET /api/v2/leads/:id — Get single lead (broker only) ───────────────────
router.get('/:id', requireBroker, async (req, res) => {
  try {
    const result = await readLead(req.tenantId, req.params.id);
    if (!result.ok) return res.status(404).json({ error: 'Lead not found' });
    res.json({ ok: true, lead: result.data });
  } catch (err) {
    console.error('[GET /leads/:id]', err);
    res.status(500).json({ error: 'Failed to get lead' });
  }
});

// ─── POST /api/v2/leads/:id/transition — Advance lead stage ─────────────────
// Called by borrower-facing pages (calculator, booking, questionnaire, etc).
// No broker auth. tenantId + leadId identify the record.
// Body: { tenantId, stage: 'BOOKING', data: { ...stageFields } }
router.post('/:id/transition', async (req, res) => {
  try {
    const { tenantId, stage: toStage, data = {} } = req.body;

    if (!toStage)   return res.status(400).json({ error: 'stage is required' });
    if (!tenantId)  return res.status(400).json({ error: 'tenantId is required' });

    const readResult = await readLead(tenantId, req.params.id);
    if (!readResult.ok) return res.status(404).json({ error: 'Lead not found' });

    const lead = readResult.data;

    // Block transition if any uncleared warns exist
    const pendingWarns = lead.warns?.filter(w => !w.cleared) ?? [];
    if (pendingWarns.length > 0) {
      return res.status(409).json({
        error: 'Lead has uncleared warnings. Broker must attest before advancing.',
        warns: pendingWarns,
      });
    }

    if (!isValidTransition(lead.stage, toStage)) {
      return res.status(400).json({
        error: `Invalid transition: ${lead.stage} → ${toStage}`,
      });
    }

    const updatedLead = {
      ...lead,
      ...data,
      stage:     toStage,
      updatedAt: new Date().toISOString(),
      history: [
        ...lead.history,
        { stage: toStage, at: new Date().toISOString() },
      ],
    };

    const saveResult = await saveLead(tenantId, updatedLead);
    if (!saveResult.ok) throw new Error(saveResult.error);

    await writeEntry(tenantId, {
      event:     'LEAD_TRANSITIONED',
      leadId:    lead.id,
      fromStage: lead.stage,
      toStage,
    }, process.env.RSA_PRIVATE_KEY_PATH);

    res.json({ ok: true, lead: updatedLead });
  } catch (err) {
    console.error('[POST /leads/:id/transition]', err);
    res.status(500).json({ error: 'Failed to transition lead' });
  }
});

// ─── POST /api/v2/leads/:id/attest — Broker clears a WARN ───────────────────
// Body: { warnId: string }
// Requires broker session token in Authorization header.
router.post('/:id/attest', async (req, res) => {
  try {
    const { warnId } = req.body;
    if (!warnId) return res.status(400).json({ error: 'warnId is required' });

    const authHeader = req.headers['authorization'];
    const raw = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!raw) return res.status(401).json({ error: 'Authentication required' });

    const session = verifySessionToken(raw);
    if (!session?.valid) return res.status(403).json({ error: 'Session invalid or expired' });

    const readResult = await readLead(session.tenantId, req.params.id);
    if (!readResult.ok) return res.status(404).json({ error: 'Lead not found' });

    const lead = readResult.data;

    const warn = lead.warns?.find(w => w.id === warnId);
    if (!warn)         return res.status(404).json({ error: 'Warning not found' });
    if (warn.cleared)  return res.status(409).json({ error: 'Warning already cleared' });

    const updatedWarns = lead.warns.map(w =>
      w.id === warnId
        ? { ...w, cleared: true, clearedBy: session.brokerId, clearedAt: new Date().toISOString() }
        : w
    );

    const allCleared = updatedWarns.every(w => w.cleared);

    const updatedLead = {
      ...lead,
      warns:     updatedWarns,
      status:    allCleared ? 'ACTIVE' : 'WARN',
      updatedAt: new Date().toISOString(),
    };

    const saveResult = await saveLead(session.tenantId, updatedLead);
    if (!saveResult.ok) throw new Error(saveResult.error);

    await writeEntry(session.tenantId, {
      event:     'WARN_ATTESTED',
      leadId:    lead.id,
      warnId,
      brokerId:  session.brokerId,
      allCleared,
    }, process.env.RSA_PRIVATE_KEY_PATH);

    res.json({ ok: true, lead: updatedLead, allCleared });
  } catch (err) {
    console.error('[POST /leads/:id/attest]', err);
    res.status(500).json({ error: 'Failed to attest warning' });
  }
});

export default router;
