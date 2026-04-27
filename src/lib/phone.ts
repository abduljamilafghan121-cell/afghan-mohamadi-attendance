/**
 * Phone validation + normalization for WhatsApp dispatch messaging.
 *
 * Default country code is Afghanistan (93). Real-world inputs vary
 * (`+93 79 ...`, `0791234567`, `937912345678`, with spaces/dashes/parens),
 * so we normalize before validating.
 *
 * Final accepted format: exactly 11 digits starting with `93`,
 * matching /^93\d{9}$/. This is the format `wa.me` requires (no `+`).
 */

export type PhoneValidationResult =
  | { valid: true; phone: string }
  | { valid: false; reason: string };

export function validatePhone(
  raw: string | null | undefined,
  defaultCountryCode = "93",
): PhoneValidationResult {
  if (raw == null || String(raw).trim() === "") {
    return { valid: false, reason: "Phone number is missing" };
  }

  let digits = String(raw).replace(/\D+/g, "");

  if (digits.length === 0) {
    return { valid: false, reason: "Phone number contains no digits" };
  }

  // Strip a leading 0 used for local-format Afghan numbers (e.g. 0791234567).
  if (digits.startsWith("0")) {
    digits = digits.replace(/^0+/, "");
  }

  // Prepend country code if missing.
  if (!digits.startsWith(defaultCountryCode)) {
    digits = defaultCountryCode + digits;
  }

  // Afghan mobile final form: 93 + 9 digits = 11 digits total.
  if (!/^93\d{9}$/.test(digits)) {
    return {
      valid: false,
      reason:
        "Phone is not a valid Afghan mobile number (must be 9 digits after country code 93)",
    };
  }

  return { valid: true, phone: digits };
}
