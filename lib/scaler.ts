// ─── Ingredient quantity scaler ───────────────────────────────────────────────
// Parses the leading quantity from an ingredient string, scales it, and
// formats it back. Non-numeric ingredients (e.g. "Salt to taste") pass through.

// Unicode fraction → decimal
const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5, '¼': 0.25, '¾': 0.75,
  '⅓': 1/3, '⅔': 2/3,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};

// Decimal → best unicode fraction (within 0.01 tolerance)
const DECIMAL_TO_FRACTION: Array<[number, string]> = [
  [1/8,  '⅛'], [1/4,  '¼'], [1/3,  '⅓'], [3/8,  '⅜'],
  [1/2,  '½'], [5/8,  '⅝'], [2/3,  '⅔'], [3/4,  '¾'],
  [7/8,  '⅞'],
];

function decimalToNiceString(n: number): string {
  if (n === 0) return '0';

  const whole = Math.floor(n);
  const frac  = n - whole;

  // Try to match fractional part to a unicode glyph
  if (frac > 0.01) {
    for (const [dec, glyph] of DECIMAL_TO_FRACTION) {
      if (Math.abs(frac - dec) < 0.04) {
        return whole > 0 ? `${whole}${glyph}` : glyph;
      }
    }
    // Fall back to 1-decimal place
    if (whole > 0) return n.toFixed(1).replace(/\.0$/, '');
    return n.toFixed(1);
  }

  return String(whole);
}

// Parse a leading quantity token. Returns the numeric value and how many
// characters it consumed, or null if no quantity found.
function parseLeadingQuantity(s: string): { value: number; length: number } | null {
  s = s.trimStart();

  // e.g. "1½" or "1 ½" — whole number followed by unicode fraction
  const mixedUnicode = s.match(/^(\d+)\s*([½¼¾⅓⅔⅛⅜⅝⅞])/);
  if (mixedUnicode) {
    const whole = parseInt(mixedUnicode[1], 10);
    const frac  = UNICODE_FRACTIONS[mixedUnicode[2]];
    return { value: whole + frac, length: mixedUnicode[0].length };
  }

  // Standalone unicode fraction e.g. "½"
  const unicodeFrac = s.match(/^([½¼¾⅓⅔⅛⅜⅝⅞])/);
  if (unicodeFrac) {
    return { value: UNICODE_FRACTIONS[unicodeFrac[1]], length: unicodeFrac[0].length };
  }

  // e.g. "1 1/2" or "1/2"
  const slashFrac = s.match(/^(\d+)\s+(\d+)\/(\d+)/);
  if (slashFrac) {
    const whole = parseInt(slashFrac[1], 10);
    const num   = parseInt(slashFrac[2], 10);
    const den   = parseInt(slashFrac[3], 10);
    if (den !== 0) return { value: whole + num / den, length: slashFrac[0].length };
  }

  const plainFrac = s.match(/^(\d+)\/(\d+)/);
  if (plainFrac) {
    const num = parseInt(plainFrac[1], 10);
    const den = parseInt(plainFrac[2], 10);
    if (den !== 0) return { value: num / den, length: plainFrac[0].length };
  }

  // Plain integer or decimal e.g. "2" or "1.5"
  const plain = s.match(/^(\d+(?:\.\d+)?)/);
  if (plain) {
    return { value: parseFloat(plain[1]), length: plain[0].length };
  }

  return null;
}

// Scale a single ingredient string. If no parseable quantity is found it
// returns the original string unchanged.
export function scaleIngredient(ingredient: string, factor: number): string {
  if (factor === 1) return ingredient;

  const trimmed = ingredient.trimStart();
  const parsed  = parseLeadingQuantity(trimmed);
  if (!parsed) return ingredient;

  const scaled  = parsed.value * factor;
  const rest    = trimmed.slice(parsed.length);
  const prefix  = ingredient.slice(0, ingredient.length - trimmed.length); // preserve leading spaces

  return prefix + decimalToNiceString(scaled) + rest;
}

// Scale all ingredients in a list.
export function scaleIngredients(ingredients: string[], originalServings: number, newServings: number): string[] {
  if (originalServings <= 0 || newServings <= 0 || originalServings === newServings) {
    return ingredients;
  }
  const factor = newServings / originalServings;
  return ingredients.map((ing) => scaleIngredient(ing, factor));
}

// Parse serving count from a servings string like "4", "Serves 4", "4-6"
export function parseServingCount(s: string): number {
  const m = s.match(/\d+/);
  return m ? parseInt(m[0], 10) : 4;
}
