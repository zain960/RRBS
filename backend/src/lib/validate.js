/**
 * Small validation helpers. Collects per-field messages and raises a single
 * 422 AppError carrying them as `details`, matching the envelope in CLAUDE.md §3.
 */
const { AppError } = require('./http');

class Validator {
  constructor(body = {}) {
    this.body = body;
    this.errors = {};
    this.output = {};
  }

  /** Required trimmed string with a maximum length. */
  string(field, { required = true, max, label } = {}) {
    const name = label ?? field;
    const raw = this.body[field];

    if (raw === undefined || raw === null || String(raw).trim() === '') {
      if (required) this.errors[field] = `${name} is required.`;
      else this.output[field] = null;
      return this;
    }

    const value = String(raw).trim();
    if (max && value.length > max) {
      this.errors[field] = `${name} must be ${max} characters or fewer.`;
      return this;
    }

    this.output[field] = value;
    return this;
  }

  /** Integer with optional bounds. */
  integer(field, { required = true, min, max, label } = {}) {
    const name = label ?? field;
    const raw = this.body[field];

    if (raw === undefined || raw === null || raw === '') {
      if (required) this.errors[field] = `${name} is required.`;
      else this.output[field] = null;
      return this;
    }

    const value = Number(raw);
    if (!Number.isInteger(value)) {
      this.errors[field] = `${name} must be a whole number.`;
      return this;
    }
    if (min !== undefined && value < min) {
      this.errors[field] = `${name} must be at least ${min}.`;
      return this;
    }
    if (max !== undefined && value > max) {
      this.errors[field] = `${name} must be at most ${max}.`;
      return this;
    }

    this.output[field] = value;
    return this;
  }

  /**
   * Money value stored as Decimal(10,2). Kept as a string so it never passes
   * through a JS float (CLAUDE.md §3).
   */
  money(field, { required = false, min = 0, label } = {}) {
    const name = label ?? field;
    const raw = this.body[field];

    if (raw === undefined || raw === null || raw === '') {
      if (required) this.errors[field] = `${name} is required.`;
      else this.output[field] = null;
      return this;
    }

    if (!/^-?\d+(\.\d{1,2})?$/.test(String(raw).trim())) {
      this.errors[field] = `${name} must be an amount with up to 2 decimal places.`;
      return this;
    }

    const value = Number(raw);
    if (Number.isNaN(value)) {
      this.errors[field] = `${name} must be a number.`;
      return this;
    }
    if (min !== undefined && value < min) {
      this.errors[field] = `${name} must be ${min} or greater.`;
      return this;
    }
    if (value > 99999999.99) {
      this.errors[field] = `${name} exceeds the maximum of 99999999.99.`;
      return this;
    }

    this.output[field] = String(raw).trim();
    return this;
  }

  /**
   * Absolute http(s) URL, e.g. a menu item image. Only the two web schemes are
   * accepted — a `javascript:` or `data:` value would be rendered by the client.
   */
  url(field, { required = false, max = 255, label } = {}) {
    const name = label ?? field;
    const raw = this.body[field];

    if (raw === undefined || raw === null || String(raw).trim() === '') {
      if (required) this.errors[field] = `${name} is required.`;
      else this.output[field] = null;
      return this;
    }

    const value = String(raw).trim();
    if (max && value.length > max) {
      this.errors[field] = `${name} must be ${max} characters or fewer.`;
      return this;
    }

    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      this.errors[field] = `${name} must be a valid URL starting with http:// or https://`;
      return this;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      this.errors[field] = `${name} must be a valid URL starting with http:// or https://`;
      return this;
    }

    this.output[field] = value;
    return this;
  }

  /** Value must be one of the allowed enum members. */
  enum(field, allowed, { required = true, label } = {}) {
    const name = label ?? field;
    const raw = this.body[field];

    if (raw === undefined || raw === null || raw === '') {
      if (required) this.errors[field] = `${name} is required.`;
      else this.output[field] = null;
      return this;
    }

    const value = String(raw).trim();
    if (!allowed.includes(value)) {
      this.errors[field] = `${name} must be one of: ${allowed.join(', ')}.`;
      return this;
    }

    this.output[field] = value;
    return this;
  }

  /** Throws 422 if anything failed, otherwise returns the cleaned values. */
  result() {
    if (Object.keys(this.errors).length > 0) {
      throw new AppError(
        422,
        'VALIDATION_ERROR',
        'Please correct the highlighted fields.',
        this.errors
      );
    }
    return this.output;
  }
}

/** Parses a positive integer route parameter (e.g. :id). */
function parseId(raw, label = 'id') {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new AppError(400, 'INVALID_ID', `A valid numeric ${label} is required.`);
  }
  return value;
}

module.exports = { Validator, parseId };
