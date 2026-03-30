// src/routes/notifyRoutes.js — Kenward CMS v2
// Email notification service. NOT a router — do not mount in server.js.
// Other route modules import and call these functions directly.
//
// Usage:
//   import { sendDocRequest, sendAppointmentConfirmed } from '../routes/notifyRoutes.js';
//   await sendDocRequest(lead, uploadUrl);
//
// Requires env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM

import nodemailer from 'nodemailer';

// ─── Transporter factory ──────────────────────────────────────────────────────

/**
 * Build a Nodemailer transporter from environment variables.
 * Throws at call time (not module load) if env vars are missing.
 */
const create_transporter = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    throw new Error(
      '[notifyRoutes] Missing SMTP env vars. Required: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM'
    );
  }

  return nodemailer.createTransport({
    host:   SMTP_HOST,
    port:   parseInt(SMTP_PORT, 10),
    secure: parseInt(SMTP_PORT, 10) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
};

// ─── Doc type display names ───────────────────────────────────────────────────

const DOC_LABELS = {
  t4:              'T4 Slip',
  noa:             'Notice of Assessment (CRA)',
  paystub:         'Pay Stub (last 2 pay periods)',
  t2:              'T2 Corporate Tax Return',
  bank_statement:  'Bank Statement (3 months)',
  photo_id:        'Government-Issued Photo ID',
  void_cheque:     'Void Cheque',
  co_t4:           'Co-Borrower T4 Slip',
  co_paystub:      'Co-Borrower Pay Stub',
  co_t2:           'Co-Borrower T2 Return',
  co_bank_statement: 'Co-Borrower Bank Statement',
  lease_agreement: 'Existing Lease Agreement',
};

const format_doc_list = (doc_list) =>
  doc_list
    .map(d => `  • ${DOC_LABELS[d] ?? d}`)
    .join('\n');

const format_doc_list_html = (doc_list) =>
  doc_list
    .map(d => `<li>${DOC_LABELS[d] ?? d}</li>`)
    .join('\n');

// ─── sendDocRequest ───────────────────────────────────────────────────────────

/**
 * Send the document request email to the borrower.
 * Triggered when the lead transitions to DOC_REQUEST stage.
 *
 * @param {object} lead       — lead record (must have email, borrowerName, docList, uploadUrl, uploadExpiresAt)
 * @param {string} uploadUrl  — the full tokenized upload portal URL
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export const sendDocRequest = async (lead, uploadUrl) => {
  try {
    const transporter = create_transporter();

    const doc_list    = lead.docList ?? [];
    const expiry      = lead.uploadExpiresAt
      ? new Date(lead.uploadExpiresAt).toLocaleDateString('en-CA', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        })
      : '48 hours from now';

    const first_name  = (lead.borrowerName ?? 'there').split(' ')[0];
    const from        = process.env.SMTP_FROM;

    const text = `
Hi ${first_name},

Your broker has prepared a secure upload link for your mortgage application documents.

Please upload the following documents before ${expiry}:

${format_doc_list(doc_list)}

Upload your documents here:
${uploadUrl}

This link is unique to you and expires in 48 hours. No login required.

If you have any questions, reply to this email or contact your broker directly.

— Kenward Mortgage
    `.trim();

    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family: sans-serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 24px;">
  <p style="font-size: 22px; font-weight: 600; margin-bottom: 4px;">Kenward</p>
  <p style="color: #666; margin-top: 0;">Be secure. Be well. Thrive.</p>
  <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">

  <p>Hi ${first_name},</p>
  <p>Your broker has prepared a secure upload link for your mortgage application. Please provide the following documents before <strong>${expiry}</strong>:</p>

  <ul style="line-height: 2;">
    ${format_doc_list_html(doc_list)}
  </ul>

  <p>
    <a href="${uploadUrl}"
       style="display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 600;">
      Upload My Documents
    </a>
  </p>

  <p style="color: #666; font-size: 14px;">
    This link is unique to you and expires in 48 hours. No login required.<br>
    Questions? Reply to this email or contact your broker directly.
  </p>

  <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
  <p style="color: #999; font-size: 12px;">Kenward Mortgage Broker Inc. — kenward.ca</p>
</body>
</html>
    `.trim();

    await transporter.sendMail({
      from,
      to:      lead.email,
      subject: 'Action Required: Upload Your Mortgage Documents',
      text,
      html,
    });

    console.log(`[notifyRoutes] Doc request email sent to ${lead.email} (lead: ${lead.id})`);
    return { ok: true };

  } catch (err) {
    console.error('[notifyRoutes.sendDocRequest]', err.message);
    return { ok: false, error: err.message };
  }
};

// ─── sendAppointmentConfirmed ─────────────────────────────────────────────────

/**
 * Notify the borrower that their appointment is confirmed.
 * Triggered when the lead transitions to CONFIRMED stage.
 *
 * @param {object} lead — must have email, borrowerName, preferredDate, preferredTime
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export const sendAppointmentConfirmed = async (lead) => {
  try {
    const transporter = create_transporter();

    const first_name = (lead.borrowerName ?? 'there').split(' ')[0];
    const from       = process.env.SMTP_FROM;

    const appt_date = lead.preferredDate ?? 'your scheduled date';
    const appt_time = lead.preferredTime ?? 'your scheduled time';

    const text = `
Hi ${first_name},

Great news — your mortgage consultation appointment is confirmed.

Date: ${appt_date}
Time: ${appt_time}

Your broker has reviewed your documents and pre-populated your application. You're ready to go.

See you soon,
— Kenward Mortgage
    `.trim();

    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family: sans-serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 24px;">
  <p style="font-size: 22px; font-weight: 600; margin-bottom: 4px;">Kenward</p>
  <p style="color: #666; margin-top: 0;">Be secure. Be well. Thrive.</p>
  <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">

  <p>Hi ${first_name},</p>
  <p>Great news — your mortgage consultation appointment is <strong>confirmed</strong>.</p>

  <table style="margin: 20px 0; border-collapse: collapse;">
    <tr>
      <td style="padding: 8px 16px 8px 0; font-weight: 600;">Date</td>
      <td style="padding: 8px 0;">${appt_date}</td>
    </tr>
    <tr>
      <td style="padding: 8px 16px 8px 0; font-weight: 600;">Time</td>
      <td style="padding: 8px 0;">${appt_time}</td>
    </tr>
  </table>

  <p>Your broker has reviewed your documents and pre-populated your application. You're all set.</p>
  <p>See you soon,<br>— Kenward Mortgage</p>

  <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
  <p style="color: #999; font-size: 12px;">Kenward Mortgage Broker Inc. — kenward.ca</p>
</body>
</html>
    `.trim();

    await transporter.sendMail({
      from,
      to:      lead.email,
      subject: 'Your Appointment is Confirmed — Kenward Mortgage',
      text,
      html,
    });

    console.log(`[notifyRoutes] Confirmation email sent to ${lead.email} (lead: ${lead.id})`);
    return { ok: true };

  } catch (err) {
    console.error('[notifyRoutes.sendAppointmentConfirmed]', err.message);
    return { ok: false, error: err.message };
  }
};
