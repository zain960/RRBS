/**
 * CSV serialisation for report exports (SRS §4.11).
 *
 * Reports are opened in spreadsheets, so two things matter beyond quoting:
 * a leading =, +, - or @ makes a cell look like a formula, and CRLF line
 * endings are what Excel expects.
 */

/** Escapes one cell, neutralising anything a spreadsheet would treat as a formula. */
function cell(value) {
  if (value === null || value === undefined) return '';

  let text = value instanceof Date ? value.toISOString() : String(value);

  // Formula injection: a cell starting with these is executed on open.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;

  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Turns rows into CSV text.
 *
 * @param {{key: string, header: string}[]} columns
 * @param {object[]} rows
 */
function toCsv(columns, rows) {
  const header = columns.map((column) => cell(column.header)).join(',');
  const body = rows.map((row) => columns.map((column) => cell(row[column.key])).join(','));
  return [header, ...body].join('\r\n');
}

/**
 * Writes a CSV response with a download filename.
 * The filename is sanitised — it is interpolated into a header value.
 */
function sendCsv(res, filename, columns, rows) {
  const safeName = String(filename).replace(/[^a-zA-Z0-9._-]/g, '-');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);

  // BOM so Excel reads UTF-8 rather than guessing the local codepage.
  return res.send(`﻿${toCsv(columns, rows)}`);
}

module.exports = { cell, toCsv, sendCsv };
