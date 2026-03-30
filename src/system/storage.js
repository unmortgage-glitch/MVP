import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    user: 'broker_admin',
    password: '@Ontario7',
    host: 'localhost',
    port: 5432,
    database: 'kenward_cms',
});

export async function saveLead(tenantId, leadId, data) {
    const query = 'INSERT INTO leads (id, tenant_id, full_name, email, extracted_data) VALUES ($1, $2, $3, $4, $5) RETURNING *';
    const values = [leadId, tenantId, data.fullName || 'Unknown', data.email || null, JSON.stringify(data)];
    const res = await pool.query(query, values);
    return res.rows[0];
}

export async function readLeads(tenantId) {
    const res = await pool.query('SELECT * FROM leads WHERE tenant_id = $1 ORDER BY created_at DESC', [tenantId]);
    return res.rows;
}

export async function readLead(tenantId, leadId) {
    const res = await pool.query('SELECT * FROM leads WHERE id = $1 AND tenant_id = $2', [leadId, tenantId]);
    return res.rows[0];
}

export const storage = {
    saveLead,
    readLead,
    readLeads,
    saveDocument: async (tenantId, leadId, file) => ({ path: `uploads/${file.filename}` })
};
