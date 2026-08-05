/**
 * Email transport stub (SRS §4.8).
 *
 * Deliberately thin: it knows how to hand a message to nodemailer and nothing
 * about what a notification is. With no `SMTP_HOST` configured — the default —
 * `send()` reports that it skipped rather than throwing, so a development
 * install runs on the log channel alone and never fails a booking because a
 * mail server is missing.
 *
 * Choosing and certifying a provider is a client decision (SRS §10).
 */
const nodemailer = require('nodemailer');

const config = require('./config');

let transport = null;

function isConfigured() {
  return Boolean(config.smtp.host);
}

/** Memoised transport — nodemailer pools connections per transport object. */
function getTransport() {
  if (!isConfigured()) return null;

  if (!transport) {
    transport = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      // An unauthenticated relay is legitimate for a local MTA.
      ...(config.smtp.user ? { auth: { user: config.smtp.user, pass: config.smtp.pass } } : {}),
    });
  }

  return transport;
}

/**
 * Sends one plain-text message.
 * Returns `{ skipped: true, reason }` when there is nothing to send through.
 */
async function send({ to, subject, text }) {
  const mail = getTransport();

  if (!mail) {
    return { skipped: true, reason: 'SMTP is not configured (SMTP_HOST is blank).' };
  }
  if (!to) {
    return { skipped: true, reason: 'Recipient has no email address on file.' };
  }

  const info = await mail.sendMail({ from: config.smtp.from, to, subject, text });
  return { skipped: false, messageId: info.messageId };
}

module.exports = { send, isConfigured };
