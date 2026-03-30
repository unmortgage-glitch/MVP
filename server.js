import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Import Routes
import kernelRouter, { script_cache } from './src/routes/kernelRoutes.js';
import leadRouter from './src/routes/leadRoutes.js';
import createUploadRouter from './src/routes/uploadRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Mount Routes
app.use('/api/v2', kernelRouter);
app.use('/api/v2', leadRouter);
app.use('/api/v2', createUploadRouter(script_cache));

// Root Redirect to Dashboard for testing
app.get('/', (req, res) => res.redirect('/api/v2/dev-dashboard'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[Kenward] Server running on port ${PORT}`);
    console.log(`[Kenward] Dev Dashboard: http://localhost:${PORT}/api/v2/dev-dashboard`);
});
