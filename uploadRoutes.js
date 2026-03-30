// src/routes/uploadRoutes.js — Kenward CMS v2
// Tokenized upload portal. No broker auth — upload token is the only credential.
// Factory function: exported default takes script_cache from kernelRoutes.
// Mounted at root in server.js: app.use('/', createUploadRouter(script_cache))

import express from 'express';
import multer from 'multer';

import { verifyUploadToken } from '../security/tokenService.js';
import { saveLead, readLead, saveDoc } from '../system/storage.js';
import { writeEntry } from '../system/auditWriter.js';

// VERIFY: adjust these imports to match the actual exports on OVH.
// docExtractor.js is not yet built — stubbed below until it exists.
// import { extractDoc } from '../intelligence/docExtractor.js';
// import { runScript } from '../logic/engine/kernelExecutor.js';

// ─── Multer config ────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPG, and PNG files are accepted'), false);
    }
  },
});

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates the upload router with access to the compiled script cache.
 * @param {Map} script_cache — compiled .bas scripts from kernelRoutes
 * @returns {express.Router}
 */
export default function createUploadRouter(script_cache) {
  const router = express.Router();

  // ── GET /upload/:token — Validate token, render upload portal ───────────────
  // Note: server.js also has a GET /upload/:token route that renders the view.
  // This route handles the API-side token validation and doc list retrieval.
  // The server.js GET route renders the EJS; this one is for AJAX token checks.
  router.get('/upload/:token/validate', (req, res) => {
    try {
      // We don't know leadId at this point — just check the token is valid JWT
      // without the leadId match requirement.
      const { verifyToken } = await import('../security/tokenService.js');
      const decoded = verifyToken(req.params.token);

      if (decoded.type !== 'upload') {
        return res.status(403).json({ error: 'Invalid token type' });
      }

      res.json({
        ok: true,
        leadId:  decoded.leadId,
        docList: decoded.docList,
      });
    } catch (err) {
      res.status(403).json({ error: 'Invalid or expired upload token' });
    }
  });

  // ── POST /upload/:token/doc — Accept a single document upload ───────────────
  router.post('/upload/:token/doc', upload.single('doc'), async (req, res) => {
    try {
      const { token } = req.params;
      const { docType } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      if (!docType) {
        return res.status(400).json({ error: 'docType is required' });
      }

      // Validate token — requires leadId embedded in the form body or derived
      // from the token itself. We use the token's own leadId for validation.
      let decoded;
      try {
        const { verifyToken } = await import('../security/tokenService.js');
        decoded = verifyToken(token);
        if (decoded.type !== 'upload') throw new Error('Wrong token type');
      } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired upload token' });
      }

      const { leadId, tenantId, docList } = decoded;

      // Check docType is in the token's permitted doc list
      if (!docList.includes(docType)) {
        return res.status(400).json({ error: `docType '${docType}' is not in the required document list` });
      }

      // Read current lead state
      const readResult = await readLead(tenantId, leadId);
      if (!readResult.ok) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      const lead = readResult.data;

      // Save raw document buffer to tenant doc storage
      const saveDocResult = await saveDoc(tenantId, leadId, docType, req.file.buffer);
      if (!saveDocResult.ok) throw new Error(saveDocResult.error);

      // ── Document extraction (stubbed until docExtractor.js is built) ─────────
      // When docExtractor.js exists, replace this stub:
      //
      // const { extractDoc } = await import('../intelligence/docExtractor.js');
      // const extraction = await extractDoc(req.file.buffer, req.file.mimetype, docType);
      //
      // For now, record that the doc was received with no extraction data.
      const extraction = { fields: {}, raw: null, stub: true };

      // ── Authenticity check (stubbed until kernelExecutor + doc_authenticity.bas) ──
      // When the kernel is wired:
      //
      // const compiledAuth = script_cache.get('doc_authenticity');
      // const authResult = compiledAuth
      //   ? runScript(compiledAuth, {
      //       authenticity_score: extraction.authenticityScore ?? 0,
      //       doc_type: docType,
      //       expected_fields_present: extraction.expectedFieldsPresent ?? false,
      //     })
      //   : null;
      //
      // const warnings = authResult?.warnings ?? [];
      const warnings = [];

      // Update lead doc record
      const existingDocs = lead.docs ?? [];
      const docRecord = {
        docType,
        uploadedAt:        new Date().toISOString(),
        status:            'RECEIVED',
        authenticityScore: extraction.authenticityScore ?? null,
        extractedFields:   extraction.fields ?? {},
        warnings,
      };

      const updatedDocs = [
        ...existingDocs.filter(d => d.docType !== docType), // replace if re-uploaded
        docRecord,
      ];

      // Add any kernel WARN entries to lead.warns
      const newWarns = warnings.map(w => ({
        id:        `${docType}-${Date.now()}`,
        message:   w.message,
        source:    'doc_authenticity',
        docType,
        cleared:   false,
        createdAt: new Date().toISOString(),
      }));

      const updatedLead = {
        ...lead,
        docs:      updatedDocs,
        warns:     [...(lead.warns ?? []), ...newWarns],
        status:    newWarns.length > 0 ? 'WARN' : lead.status,
        updatedAt: new Date().toISOString(),
      };

      const saveLeadResult = await saveLead(tenantId, updatedLead);
      if (!saveLeadResult.ok) throw new Error(saveLeadResult.error);

      await writeEntry(tenantId, {
        event:    'DOC_UPLOADED',
        leadId,
        docType,
        warnings: newWarns.length,
      }, process.env.RSA_PRIVATE_KEY_PATH);

      res.json({
        ok: true,
        docType,
        extracted: extraction.fields,
        warnings:  newWarns,
      });
    } catch (err) {
      console.error('[POST /upload/:token/doc]', err);
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  return router;
}
