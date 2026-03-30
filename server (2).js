import express from 'express';
import path from 'path';
import fs from 'fs'; // Added File System module
import { fileURLToPath } from 'url';
import multer from 'multer';

// --- CONFIGURATION ---
const PORT = 3000;

// Fix for __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Multer (Memory Storage)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const app = express();

// --- MIDDLEWARE ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// View Engine Setup (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- MOCK DATA STORE ---
const MOCK_LEAD_DATA = {
    applicant: {
        annual_gross_income: 125000,
        credit_score: 780,
        employment_status: "Salaried",
        liquid_assets: 85000,
        down_payment_source: { source_type: "Savings", amount: 60000 },
        monthly_debts: { credit_card_payments: 250, car_loan_payments: 450, other_loan_payments: 0, alimony_or_child_support: 0 }
    },
    property: { value: 750000, annual_taxes: 3500, monthly_heating_cost: 120, monthly_condo_fee: 0 },
    loan_request: { loan_amount_requested: 500000, amortization_years: 25 }
};

// --- ROUTES ---

// 1. Landing Page (With Content Loader)
app.get('/', (req, res) => {
    let content = { blocks: [] };
    
    // Try to load the homepage content
    try {
        const contentPath = path.join(__dirname, 'content/live/homepage.json');
        if (fs.existsSync(contentPath)) {
            const raw = fs.readFileSync(contentPath, 'utf-8');
            content = JSON.parse(raw);
        } else {
            console.warn("⚠️ homepage.json not found. Using empty mock.");
        }
    } catch (error) {
        console.error("❌ Failed to load content:", error.message);
    }

    res.render('index', { 
        pageTitle: 'Kenward Mortgage | Mock Mode',
        pipeline_status: 'Local Simulation (Offline)',
        content: content // Inject the CMS data
    });
});

/**
 * 2. MOCK AI ENDPOINT
 */
app.post('/ai-process', upload.single('audio_file'), async (req, res) => {
    try {
        console.log('\n--- [MOCK AI] Request Received ---');
        
        if (req.file) console.log(`🎤 Audio Input: ${req.file.originalname}`);
        if (req.body.text) console.log(`📝 Text Input: "${req.body.text}"`);

        if (!req.file && !req.body.text) throw new Error("No input provided.");

        console.log('⏳ AI is analyzing inputs...');
        await new Promise(resolve => setTimeout(resolve, 1500));

        console.log('✅ Returning Mock JSON');
        res.json({ success: true, data: MOCK_LEAD_DATA });

    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- SERVER START ---
app.listen(PORT, () => {
    console.log(`\n--- THE UNBREAKABLE PIPELINE (MOCK MODE) ---`);
    console.log(`[Status]    Online`);
    console.log(`[Port]      ${PORT}`);
    console.log(`[Url]       http://localhost:${PORT}`);
    console.log(`--------------------------------------------\n`);
});
