/**
 * Fixed-point decimal helpers usable from client components (no `Prisma.Decimal`
 * import — that pulls in the generated Prisma runtime, which is server-only).
 *
 * `createOrder` computes `salePriceRon` as
 * `new Prisma.Decimal(salePrice).mul(exchangeRate).toDecimalPlaces(2)`, and
 * decimal.js's default rounding mode is ROUND_HALF_UP (round half away from
 * zero). `multiplyAndRoundToTwoDecimals` reimplements that exact operation
 * with BigInt arithmetic so the EUR-rate preview shown before saving always
 * matches the RON value the server will actually persist — no floating-point
 * drift, no separate rounding rule to keep in sync by hand.
 */

type ParsedDecimal = { sign: 1 | -1; digits: bigint; scale: number };

function parseDecimal(value: string): ParsedDecimal | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^(-)?(\d+)(?:\.(\d+))?$/);
  if (!match) return null;

  const sign = match[1] ? -1 : 1;
  const intPart = match[2];
  const fracPart = match[3] ?? "";

  return { sign, digits: BigInt(intPart + fracPart), scale: fracPart.length };
}

function formatFixed(sign: 1 | -1, magnitude: bigint, scale: number): string {
  const digits = magnitude.toString().padStart(scale + 1, "0");
  const intPart = digits.slice(0, digits.length - scale);
  const fracPart = digits.slice(digits.length - scale);
  const signPrefix = sign === -1 && magnitude !== BigInt(0) ? "-" : "";
  return `${signPrefix}${intPart}.${fracPart}`;
}

/**
 * Multiplies two decimal strings and rounds the product to 2 decimal places,
 * half-up (away from zero). Returns null if either input is not a plain
 * decimal number (e.g. empty, partially typed, or negative-with-no-digits).
 */
export function multiplyAndRoundToTwoDecimals(a: string, b: string): string | null {
  const left = parseDecimal(a);
  const right = parseDecimal(b);
  if (!left || !right) return null;

  const productDigits = left.digits * right.digits;
  const productSign: 1 | -1 = left.sign * right.sign === -1 ? -1 : 1;
  const productScale = left.scale + right.scale;
  const targetScale = 2;

  if (productScale <= targetScale) {
    const padded = productDigits * BigInt(10) ** BigInt(targetScale - productScale);
    return formatFixed(productSign, padded, targetScale);
  }

  const dropScale = productScale - targetScale;
  const divisor = BigInt(10) ** BigInt(dropScale);
  const quotient = productDigits / divisor;
  const remainder = productDigits % divisor;
  const rounded = remainder * BigInt(2) >= divisor ? quotient + BigInt(1) : quotient;

  return formatFixed(productSign, rounded, targetScale);
}
