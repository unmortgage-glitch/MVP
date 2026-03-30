import express from 'express';
import { readLeads, readLead } from '../system/storage.js';
import { verifyToken } from '../security/tokenService.js';

const router = express.Router();

// GET /api/v2/dev-dashboard - Temporary bypass to view Postgres data
router.get('/dev-dashboard', async (req, res) => {
    try {
        // Using your specific Tenant UUID from the previous step
        const tenantId = 'd8ee1db2-03ea-46e6-9002-170cdc47ca03'; 
        const leads = await readLeads(tenantId);
        
        res.render('broker/dashboard', { 
            leads, 
            companyName: 'Kenward Mortgage Broker Inc.',
            slogan: 'Be secure. Be well. Thrive.' 
        });
    } catch (err) {
        console.error('[leadRoutes] DB Error:', err.message);
        res.status(500).render('error', { message: 'Database Connection Error' });
    }
});

// GET /api/v2/leads - Standard JSON API
router.get('/leads', async (req, res) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant ID required' });
    try {
        const leads = await readLeads(tenantId);
        res.json(leads);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
