const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs').promises;

// --- APPLICATION SETUP ---
const app = express();
const PORT = process.env.PORT || 3000; 

// Middleware
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static('public')); 

// EJS Configuration
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('view cache', false); 

// --- CONTENT HELPER ---
const loadPageContent = async (slug) => {
    try {
        const filePath = path.join(__dirname, 'content', 'live', `${slug}.json`);
        const contentJson = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(contentJson);
    } catch (error) {
        console.error(`Error loading content for slug ${slug}:`, error.message);
        return { 
            pageTitle: 'Error Loading Content', 
            contentBlocks: [
                { type: 'text', text: `ERROR: The file 'content/live/${slug}.json' could not be loaded.` }
            ] 
        };
    }
};

// --- ROUTES ---

// 0. ROOT -> Homepage
app.get('/', (req, res) => res.redirect('/homepage'));

// 1. UNIVERSAL PAGE HANDLER
// This logic works for /homepage, /loans, etc.
app.get('/:slug', async (req, res) => {
    const slug = req.params.slug;
    
    // 1. Load Data
    const pageData = await loadPageContent(slug);

    // 2. Render the Universal Template (index.ejs)
    res.render('index', pageData);
});

// 2. CRM FORM HANDLER
app.post('/submit-lead', (req, res) => {
    const { name, email } = req.body;
    if (name && email) {
        console.log(`--- NEW LEAD CAPTURED: ${name} (${email}) ---`);
        res.redirect('/homepage?status=success');
    } else {
        res.redirect('/homepage?status=error');
    }
});

// START SERVER
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
