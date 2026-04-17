import TextRecognition from '@react-native-ml-kit/text-recognition';
import { OcrResult, RecipeDraft, RecipeTag, RecipeType } from './types';

// ─── Run OCR on a local image URI ─────────────────────────────────────────────

export async function recognizeText(imageUri: string): Promise<OcrResult> {
  try {
    const result = await TextRecognition.recognize(imageUri);
    const rawText = result.text?.trim() ?? '';
    const confidence: OcrResult['confidence'] =
      rawText.length > 100 ? 'high' : rawText.length > 20 ? 'medium' : 'low';
    return { rawText, confidence };
  } catch (err) {
    console.error('OCR error:', err);
    return { rawText: '', confidence: 'low' };
  }
}

// ─── Parse raw OCR text into a recipe draft ──────────────────────────────────
//
//  This is a heuristic parser — it does its best and leaves the rest blank
//  for the user to fill in via the edit form.
//
//  Patterns it looks for:
//    • A title: first non-empty line, or a line in ALL CAPS / Title Case
//    • Servings: "Serves 4", "Makes 12", "4 servings"
//    • Times: "Prep: 15 min", "Cook time: 1 hour"
//    • Ingredient section: lines starting with numbers/fractions/measurement words
//    • Method section: numbered steps or lines starting with a verb

export function parseOcrDraft(rawText: string): RecipeDraft {
  if (!rawText.trim()) {
    return emptyDraft();
  }

  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let title = '';
  let servings = '';
  let prepTime = '';
  let cookTime = '';
  const ingredients: string[] = [];
  const method: string[] = [];
  const notes = '';

  // ── Title: look for first substantial line ─────────────────────────────────
  // Prefer ALL CAPS or Title Case lines near the top
  for (const line of lines.slice(0, 6)) {
    if (line.length > 3 && line.length < 80) {
      title = toTitleCase(line);
      break;
    }
  }

  // ── Servings ───────────────────────────────────────────────────────────────
  const servingRe = /(?:serves?|makes?|yield[s]?)\s*:?\s*(\d[\d–\-]*(?:\s*(?:people|servings?|portions?|pieces?|cookies?|biscuits?)?)?)/i;
  for (const line of lines) {
    const m = line.match(servingRe);
    if (m) { servings = m[1].trim(); break; }
  }

  // ── Times ──────────────────────────────────────────────────────────────────
  const prepRe  = /prep(?:aration)?\s*(?:time)?\s*:?\s*([\d]+\s*(?:min(?:utes?)?|hrs?|hours?))/i;
  const cookRe  = /cook(?:ing)?\s*(?:time)?\s*:?\s*([\d]+\s*(?:min(?:utes?)?|hrs?|hours?))/i;
  const totalRe = /total\s*(?:time)?\s*:?\s*([\d]+\s*(?:min(?:utes?)?|hrs?|hours?))/i;
  for (const line of lines) {
    if (!prepTime) { const m = line.match(prepRe);  if (m) prepTime = m[1].trim(); }
    if (!cookTime) { const m = line.match(cookRe);  if (m) cookTime = m[1].trim(); }
    if (!cookTime) { const m = line.match(totalRe); if (m) cookTime = m[1].trim(); }
  }

  // ── Identify section boundaries ────────────────────────────────────────────
  const ingredientHeaderRe = /^(ingredient[s]?|you['\u2019]?ll?\s+need|what\s+you\s+need)\s*:?$/i;
  const methodHeaderRe     = /^(method|direction[s]?|instruction[s]?|how\s+to\s+make|step[s]?)\s*:?$/i;
  const measurementRe      = /^\d|^[¼½¾⅓⅔⅛⅜⅝⅞]|^(a\s+|one\s+|two\s+|three\s+|four\s+|half\s+)?\b(cup|tbsp|tsp|tablespoon|teaspoon|g|kg|ml|l|oz|lb|pinch|handful|bunch|clove|slice|piece|tin|can|pack|bag)\b/i;
  const numberedStepRe     = /^(\d+[\.\)]\s+|step\s*\d+\s*:?\s*)/i;

  let section: 'unknown' | 'ingredients' | 'method' = 'unknown';

  for (const line of lines) {
    if (ingredientHeaderRe.test(line)) { section = 'ingredients'; continue; }
    if (methodHeaderRe.test(line))     { section = 'method';      continue; }

    // Numbered step always switches to method section
    if (numberedStepRe.test(line) && line.length > 6) {
      section = 'method';
      method.push(line.replace(numberedStepRe, '').trim());
      continue;
    }

    if (section === 'ingredients') {
      ingredients.push(line);
    } else if (section === 'method') {
      if (method.length > 0 && line.length < 30 && !line.match(/[a-z]/)) {
        // Looks like a heading inside method — skip
      } else {
        method.push(line);
      }
    } else {
      // No section header found — use heuristics
      if (measurementRe.test(line) && line.length < 120) {
        ingredients.push(line);
      }
    }
  }

  // ── Guess type from title ──────────────────────────────────────────────────
  const type = guessType(title, ingredients);
  const tags = guessTags(title, ingredients, type);

  return {
    title,
    source: '',
    servings,
    prepTime,
    cookTime,
    ingredients,
    method,
    notes,
    type,
    tags,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyDraft(): RecipeDraft {
  return {
    title: '',
    source: '',
    servings: '',
    prepTime: '',
    cookTime: '',
    ingredients: [],
    method: [],
    notes: '',
    type: 'main',
    tags: [],
  };
}

function toTitleCase(s: string): string {
  // If already mixed case keep it; if ALL CAPS convert
  if (s === s.toUpperCase()) {
    return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return s;
}

const DESSERT_WORDS = /cake|biscuit|cookie|tart|pie|pudding|slice|brownie|muffin|cupcake|cheesecake|ice.?cream|sorbet|pavlov|crumble|fudge/i;
const BAKING_WORDS  = /bread|loaf|roll|bun|scone|pastry|dough|flour|bake|oven/i;
const SNACK_WORDS   = /dip|spread|hummus|cracker|chip|nibble|bliss.?ball/i;
const DRINK_WORDS   = /smoothie|juice|cocktail|drink|shake|lemonade/i;
const SIDE_WORDS    = /salad|slaw|roast.?veg|side|relish|chutney|sauce|gravy/i;

function guessType(title: string, ingredients: string[]): RecipeType {
  const text = title + ' ' + ingredients.join(' ');
  if (DESSERT_WORDS.test(text)) return 'dessert';
  if (DRINK_WORDS.test(text))   return 'drink';
  if (SNACK_WORDS.test(text))   return 'snack';
  if (SIDE_WORDS.test(text))    return 'side';
  return 'main';
}

function guessTags(title: string, ingredients: string[], type: RecipeType): RecipeTag[] {
  const tags: RecipeTag[] = [];
  const text = (title + ' ' + ingredients.join(' ')).toLowerCase();

  if (BAKING_WORDS.test(text))                      tags.push('baking');
  if (type === 'dessert' || DESSERT_WORDS.test(text)) tags.push('sweet');
  if (/meat|chicken|beef|lamb|pork|fish|seafood/.test(text)) tags.push('savory');
  if (!tags.includes('savory') && type !== 'drink')  {
    if (/vegetable|tofu|legume|bean|lentil|chickpea|spinach|tomato|mushroom/.test(text)) {
      tags.push('vegetarian');
    }
  }
  if (type === 'dessert') tags.push('dessert');
  if (/breakfast|porridge|muesli|granola|pancake|french.?toast|egg/.test(text)) tags.push('breakfast');

  return tags;
}
