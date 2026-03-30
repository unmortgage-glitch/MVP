import express from 'express';
import multer from 'multer';
import { verifyToken } from '../security/tokenService.js';
import { storage } from '../system/storage.js';
import { extractData } from '../intelligence/docExtractor.js';

export default function createUploadRouter(script_cache) {
    const router = express.Router();
    const upload = multer({ dest: 'uploads/' });

    router.post('/upload', upload.array('documents'), async (req, res) => {
        try {
            const authHeader = req.headers.authorization;
            const token = authHeader && authHeader.split(' ')[1];
            if (!token) return res.status(401).json({ error: 'Missing token' });

            const decoded = verifyToken(token);
            const extractedData = await extractData(decoded.tenantId, req.files);
            
            res.json({ 
                message: 'Upload processed', 
                data: extractedData 
            });
        } catch (error) {
            console.error('[uploadRoutes] Error:', error.message);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
}
