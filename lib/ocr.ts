import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as ImageManipulator from 'expo-image-manipulator';
import { OcrResult, RecipeDraft, RecipeTag, RecipeType } from './types';

// ─── Scrape recipe from a website URL ────────────────────────────────────────
// Works with any site that publishes schema.org/Recipe JSON-LD structured data
// (Taste.com.au, BBC Good Food, AllRecipes, NZ Herald recipes, etc.)

function parseDuration(iso: string): string {
  if (!iso) return '';
  const m = iso.match(/P(?:T|(?:\d+D)?T?)(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return '';
  const h = parseInt(m[1] || '0');
  const mins = parseInt(m[2] || '0');
  if (h && mins) return `${h}h ${mins} min`;
  if (h) return `${h}h`;
  if (mins) return `${mins} min`;
  return '';
}

function parseSchemaRecipe(schema: Record<string, unknown>): RecipeDraft {
  const name = (schema.name as string) ?? '';

  const rawIngredients = schema.recipeIngredient as string[] ?? [];
  const ingredients = rawIngredients.filter(Boolean);

  // Instructions can be a string, string[], or HowToStep[]
  const rawInstructions = schema.recipeInstructions;
  const method: string[] = [];
  if (typeof rawInstructions === 'string') {
    method.push(...rawInstructions.split(/\n+/).map((s) => s.trim()).filter(Boolean));
  } else if (Array.isArray(rawInstructions)) {
    for (const step of rawInstructions) {
      if (typeof step === 'string') method.push(step.trim());
      else if (typeof step === 'object' && step !== null) {
        const text = (step as Record<string, unknown>).text as string ?? '';
        if (text) method.push(text.trim());
      }
    }
  }

  const yield_ = schema.recipeYield;
  const servings = Array.isArray(yield_) ? String(yield_[0]) : String(yield_ ?? '');

  const draft = emptyDraft();
  draft.title      = toTitleCase(name);
  draft.ingredients = ingredients;
  draft.method      = method;
  draft.servings    = servings;
  draft.prepTime    = parseDuration(schema.prepTime as string ?? '');
  draft.cookTime    = parseDuration(schema.cookTime as string ?? schema.totalTime as string ?? '');
  draft.notes       = (schema.description as string ?? '').slice(0, 400);
  draft.type        = guessType(draft.title, ingredients);
  draft.tags        = guessTags(draft.title, ingredients, draft.type);
  return draft;
}

export async function scrapeRecipeFromUrl(url: string): Promise<RecipeDraft> {
  let html: string;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err) {
    throw new Error('Could not load that page. Check the link and your internet connection.');
  }

  // Find all JSON-LD blocks
  const scriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRe.exec(html)) !== null) {
    try {
      const data: unknown = JSON.parse(match[1]);
      const candidates: unknown[] = Array.isArray((data as Record<string, unknown>)['@graph'])
        ? ((data as Record<string, unknown>)['@graph'] as unknown[])
        : [data];
      for (const item of candidates) {
        const obj = item as Record<string, unknown>;
        const type = obj['@type'];
        const isRecipe = type === 'Recipe' || (Array.isArray(type) && (type as string[]).includes('Recipe'));
        if (isRecipe) return parseSchemaRecipe(obj);
      }
    } catch { /* keep searching */ }
  }

  throw new Error("This page doesn't seem to contain a recipe we can read automatically. Try copying and pasting the ingredients and method manually.");
}

// ─── Pre-process image for better OCR accuracy ────────────────────────────────
// Convert to greyscale and boost contrast so fraction glyphs (¼ ½ ¾) become
// crisp black-on-white instead of grey smudges that OCR misreads every time.

async function preprocessForOcr(imageUri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [
        // Scale up slightly — more pixels = finer detail for small characters
        { resize: { width: 2400 } },
      ],
      {
        compress: 1,           // no quality loss
        format: ImageManipulator.SaveFormat.PNG,  // lossless
        base64: false,
      }
    );
    return result.uri;
  } catch {
    // If pre-processing fails just use the original
    return imageUri;
  }
}

// ─── Run OCR on a local image URI ─────────────────────────────────────────────

export async function recognizeText(imageUri: string): Promise<OcrResult> {
  try {
    const processedUri = await preprocessForOcr(imageUri);
    const result = await TextRecognition.recognize(processedUri);
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

  // Unit-start pattern used to decide whether a standalone digit is a fraction
  // quantity or just a page/chapter number.
  const unitStartEarly = /^(cup|tbsp|tsp|Tbsp|Tbs|tablespoon|teaspoon|g\b|kg|ml|oz|lb|pinch|handful|bunch|clove|slice)/i;

  const rawLines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const lines = rawLines.filter((l, i) => {
    // Drop standalone numbers UNLESS the very next line starts with a unit word —
    // in that case the digit is almost certainly an OCR-mangled fraction (¼ → "4", "14" etc.)
    if (/^\d{1,4}$/.test(l)) {
      const next = rawLines[i + 1] ?? '';
      return unitStartEarly.test(next);
    }
    return true;
  });

  let title = '';
  let servings = '';
  let prepTime = '';
  let cookTime = '';
  const ingredients: string[] = [];
  const method: string[] = [];
  const notes = '';

  // ── Title: prefer multi-word lines over single-word section headers ──────────
  // e.g. skip "Soups" / "SOUPS" and pick "Tomato Soup" instead
  const noiseReTitleCheck = /\b(edition|cookbook|copyright|publishing|all rights|isbn|recipe book)\b/i;
  let titleFallback = '';
  for (const line of lines.slice(0, 8)) {
    if (line.length < 3 || line.length > 80) continue;
    if (noiseReTitleCheck.test(line)) continue;
    // Skip known section/chapter headers
    if (/^(ingredient[s]?|method|direction[s]?|instruction[s]?|preparation|soups?|cakes?|biscuits?|desserts?|salads?|mains?|starters?|snacks?|drinks?|sauces?)\s*:?$/i.test(line)) continue;
    const wordCount = line.trim().split(/\s+/).length;
    if (!titleFallback) titleFallback = line;
    if (wordCount >= 2) {
      title = toTitleCase(line);
      break;
    }
  }
  if (!title) title = toTitleCase(titleFallback);

  // ── Servings ───────────────────────────────────────────────────────────────
  const servingRe = /(?:serves?|makes?|yield[s]?)\s*:?\s*(\d[\d–\-]*(?:\s*(?:people|servings?|portions?|pieces?|cookies?|biscuits?)?)?)/i;
  for (const line of lines) {
    const m = line.match(servingRe);
    if (m) { servings = m[1].trim(); break; }
  }

  // ── Times ─────────────────────────────────────────────────────────────────
  // Not auto-detected — too many false positives from numbers on the page.
  // Left blank so the user can fill in after cooking the recipe a few times.

  // ── Identify section boundaries ────────────────────────────────────────────
  const ingredientHeaderRe = /^(ingredient[s]?|you['\u2019]?ll?\s+need|what\s+you\s+need)\s*:?$/i;
  const methodHeaderRe     = /^(method|direction[s]?|instruction[s]?|how\s+to\s+make|step[s]?)\s*:?$/i;
  // Used only when no explicit header — to identify the START of an ingredient block.
  // Includes common abbreviations: t = teaspoon, T/Tbs/Tbsp = tablespoon
  // Also catches lone "h" at start of line — OCR misread of ¼ or ½ fraction glyphs
  const unitWords          = 'cup|tbsp|tsp|tablespoon|teaspoon|Tbsp|Tbs|g\\b|kg\\b|ml\\b|l\\b|oz\\b|lb\\b|pinch|handful|bunch|clove|slice|piece|tin|can|pack|bag';
  const measurementRe      = new RegExp(
    `^\\d|^[¼½¾⅓⅔⅛⅜⅝⅞]` +
    // "h teaspoon" / "h cup" — OCR misread of a fraction glyph (¼ or ½ → h)
    `|^h\\s+(?=(${unitWords}))` +
    // standalone t or T as unit abbreviation: "1 t salt", "2 T flour"
    `|^(a\\s+|one\\s+|two\\s+|three\\s+|four\\s+|half\\s+)?\\b(${unitWords}|\\bT\\b|\\bt\\b)\\b`
  );
  // Match "1. " or "1) " — require explicit punctuation, NOT bare "1 " (which could be "1 onion")
  const numberedStepRe     = /^(\d+[\.\)]\s+|step\s*\d+\s*:?\s*)/i;
  // Lines that are clearly publication noise, not food.
  // Also catches common OCR corruptions of "EDITION" / "RECIPE" stamp text.
  const noiseRe            = /\b(edition|edton|editon|cookbook|copyright|publishing|all rights|isbn|repgpe|recpe)\b/i;

  let section: 'unknown' | 'ingredients' | 'method' = 'unknown';
  let collectedIngredients = false;

  for (const line of lines) {
    if (noiseRe.test(line)) continue;                          // skip book header noise
    if (ingredientHeaderRe.test(line)) { section = 'ingredients'; continue; }
    if (methodHeaderRe.test(line))     { section = 'method';      continue; }

    // Numbered step always switches to method section
    if (numberedStepRe.test(line) && line.length > 6) {
      section = 'method';
      method.push(line.replace(numberedStepRe, '').trim());
      continue;
    }

    if (section === 'ingredients') {
      // In an explicit ingredients section, accept ALL lines that aren't
      // clearly a sub-heading (short ALL-CAPS-only lines)
      const isSubHeading = line.length < 30 && line === line.toUpperCase() && /[A-Z]/.test(line) && !/\d/.test(line);
      if (isSubHeading) continue;
      // Long sentence = probably the start of the method
      if (collectedIngredients && line.length > 55) {
        section = 'method';
        method.push(line);
      } else {
        ingredients.push(line);
        collectedIngredients = true;
      }
    } else if (section === 'method') {
      if (method.length > 0 && line.length < 30 && !line.match(/[a-z]/)) {
        // Looks like a heading inside method — skip
      } else {
        method.push(line);
      }
    } else {
      // No explicit section headers — use heuristics
      if (measurementRe.test(line) && line.length < 120) {
        ingredients.push(line);
        collectedIngredients = true;
      } else if (collectedIngredients) {
        // Anything that looks like an instruction sentence switches us to method.
        // Key signals: doesn't match measurementRe AND is long enough to be a sentence.
        // Short lines (< 30 chars) are still assumed to be ingredients ("Black Pepper" etc.)
        if (line.length >= 30 && !measurementRe.test(line)) {
          section = 'method';
          method.push(line);
        } else if (line.length > 2) {
          ingredients.push(line);
        }
      }
    }
  }

  // ── Rescue pass: recover ingredients OCR placed after the method text ───────
  // On a physical cookbook page the fractions/quantities sometimes sit in a
  // margin column that OCR reads AFTER the method paragraphs.  Any short line
  // that looks like a measurement but ended up in `method` belongs in ingredients.
  const rescuedMethod: string[] = [];
  for (const line of method) {
    if (
      measurementRe.test(line) &&
      line.length < 90 &&
      !numberedStepRe.test(line) &&    // not "1. Preheat…"
      !/[.!?]$/.test(line.trim())       // not a full sentence
    ) {
      ingredients.push(line);
    } else {
      rescuedMethod.push(line);
    }
  }
  method.length = 0;
  method.push(...rescuedMethod);

  // ── Post-process: merge split quantity lines ───────────────────────────────
  // OCR sometimes puts "1/4" on one line and "cup sugar" on the next
  const unitStartRe = /^(cup|tbsp|tsp|Tbsp|Tbs|tablespoon|teaspoon|g\b|kg|ml|l\b|oz|lb|pinch|handful|bunch|clove|slice|T\b|t\b)/;
  const mergedIngredients: string[] = [];
  for (let i = 0; i < ingredients.length; i++) {
    const curr = ingredients[i];
    const next = ingredients[i + 1];
    // A very short fragment (≤ 3 chars) directly before a unit word is almost
    // certainly an OCR-mangled fraction (¼ → "h", "Ja", "4", "'2", etc.).
    // Resolve it to the correct fraction symbol before merging.
    const isShortFragment = curr.trim().length <= 3 && next && unitStartRe.test(next);
    if (isShortFragment) {
      mergedIngredients.push(resolveFractionFragment(curr.trim()) + ' ' + next);
      i++; // consume next line
    } else {
      mergedIngredients.push(curr);
    }
  }

  // ── Filter noise from method ───────────────────────────────────────────────
  // Remove "Serves X" / "Makes X" lines (already in servings field) and
  // book caption lines like "Top: Mussel Soup (pg 93)"
  const servesLineRe  = /^(serves?|makes?)\s+[\d–\-]/i;
  const captionLineRe = /^(top|bottom|centre|center|left|right)\s*:/i;
  const cleanMethod   = method.filter(l => !servesLineRe.test(l) && !captionLineRe.test(l));

  // ── Post-process: join fragmented method lines ─────────────────────────────
  // OCR splits long sentences across visual lines — join continuations.
  // A line is a continuation if it starts with lowercase (mid-sentence break),
  // OR it is short AND the previous step did NOT end with sentence punctuation.
  const mergedMethod: string[] = [];
  for (const line of cleanMethod) {
    if (mergedMethod.length === 0) {
      mergedMethod.push(line);
      continue;
    }
    const prev = mergedMethod[mergedMethod.length - 1];
    const prevEndsSentence = /[.!?]$/.test(prev.trim());
    const currStartsLower  = /^[a-z]/.test(line);
    const currIsNewStep    = /^\d/.test(line); // numbered step = always new
    // Short line continuation only if prev sentence hasn't closed
    const isShortContinuation = !currIsNewStep && !prevEndsSentence && line.length < 45;

    if (!currIsNewStep && (currStartsLower || isShortContinuation)) {
      mergedMethod[mergedMethod.length - 1] = prev + ' ' + line;
    } else {
      mergedMethod.push(line);
    }
  }

  // ── Post-process: split any large method blob into individual steps ──────────
  // After merging OCR lines together, we may have one big paragraph.
  // Split at sentence boundaries and group into steps of a comfortable length.
  const finalMethod: string[] = [];
  for (const step of mergedMethod) {
    if (step.length <= 120) {
      finalMethod.push(step);
    } else {
      // Split into individual sentences
      const sentences = step.match(/[^.!?]+[.!?]+[\s]*/g) ?? [step];
      let current = '';
      for (const s of sentences) {
        const trimmed = s.trim();
        if (!trimmed) continue;
        if (!current) {
          current = trimmed;
        } else if (current.length + trimmed.length + 1 <= 110) {
          current += ' ' + trimmed;    // group short sentences together
        } else {
          finalMethod.push(current);
          current = trimmed;
        }
      }
      if (current) finalMethod.push(current);
    }
  }

  // ── Sanitise ingredient lines ──────────────────────────────────────────────
  // 1. Normalise common OCR character swaps inside words:
  //    • digit 0 surrounded by letters → 'o'  ("teasp0on" → "teaspoon")
  //    • letter l between digits or slash → '1' ("l/4" → "1/4")
  // 2. Fix fraction OCR artifacts on the same line as the unit word.
  // 3. Fix mid-word capitalisation by lowercasing then capitalising first char.
  // Only units that genuinely need a numeric quantity (e.g. "¼ cup").
  // Self-quantifying words like "Pinch", "Handful", "Bunch" are already complete
  // without a number, so we exclude them to avoid "¼ pinch of chilli".
  const unitStartCapRe = /^(Cup|Tbsp|Tsp|Tablespoon|Teaspoon)\s/;
  const sanitisedIngredients = mergedIngredients
    .map((line) => {
      const normalised = line
        .replace(/([a-zA-Z])0([a-zA-Z])/g, '$1o$2')   // teasp0on → teaspoon
        .replace(/(\d)l(\d|\/)/g, '$11$2')              // l between digits → 1
        .replace(/^l(\d|\/)/g, '1$1');                  // leading l before digit → 1
      const fractionFixed = fixSameLineFraction(normalised);
      const lower = fractionFixed.toLowerCase();
      const result = lower.charAt(0).toUpperCase() + lower.slice(1);
      // If a unit word starts the line (quantity was dropped by OCR) prepend ¼
      // as a best-guess placeholder so the user sees something to correct.
      return unitStartCapRe.test(result) ? '¼ ' + result.charAt(0).toLowerCase() + result.slice(1) : result;
    })
    .filter((s) => s.trim().length > 0);  // drop any blank ingredients

  // ── Guess type from title ──────────────────────────────────────────────────
  const type = guessType(title, sanitisedIngredients);
  const tags = guessTags(title, sanitisedIngredients, type);

  return {
    title,
    source: '',
    pageNumber: '',
    servings,
    prepTime,
    cookTime,
    ingredients: sanitisedIngredients,
    method: finalMethod,
    notes,
    type,
    tags,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Called when a short fragment was isolated on its OWN LINE before a unit word.
// We know it must be a fraction glyph — OCR just mangled it.  Digits are safe
// to convert here because genuine "2 cups" / "4 tablespoons" always OCR as a
// single unbroken line, never as a split fragment.
function resolveFractionFragment(f: string): string {
  if (/^[\d]+\/[\d]+$/.test(f)) return f;   // "1/4" — already correct
  if (/^[¼½¾⅓⅔⅛⅜⅝⅞]$/.test(f)) return f;   // Unicode fraction — already correct
  // Strip non-digit noise and use the remaining digit(s) as a hint
  const digits = f.replace(/\D/g, '');
  if (digits === '2' || digits === '12') return '½';
  if (digits === '3' || digits === '13') return '⅓';
  if (digits === '34')                   return '¾';
  // No recognisable digit hint — use letter shape as a hint:
  // Capital H looks like ½ in many serif typefaces; lowercase h looks like ¼
  if (f === 'H') return '½';
  if (f === 'h') return '¼';
  if (/2/.test(f)) return '½';
  if (/3/.test(f)) return '⅓';
  return '¼';
}

// Called during sanitisation when the mangled glyph and unit appear on the
// SAME OCR line, e.g. "'2 teaspoon salt" or "A cup tomato paste".
// Only converts NON-digit prefixes — a digit prefix like "2 cups" is a genuine
// measurement and must be left alone.
function fixSameLineFraction(line: string): string {
  const unitPat = 'cup|tbsp|tsp|Tbsp|Tbs|tablespoon|teaspoon|g\\b|kg|ml|oz|lb|pinch|handful|bunch|clove|slice';

  // ── Singular-unit heuristic ──────────────────────────────────────────────
  // A single digit 2–4 followed by a SINGULAR unit (no trailing 's') is almost
  // certainly an OCR-mangled fraction.  "2 teaspoon" → "½ teaspoon";
  // "2 teaspoons" is left alone because that's a genuine count.
  const singularMap: Record<string, string> = { '2': '½', '3': '⅓', '4': '¼' };
  const singularMatch = line.match(
    new RegExp(`^([2-4])\\s+(${unitPat})(?!s)`, 'i')
  );
  if (singularMatch && singularMap[singularMatch[1]]) {
    return singularMap[singularMatch[1]] + line.slice(singularMatch[1].length);
  }

  // ── Non-digit prefix heuristic ───────────────────────────────────────────
  const m = line.match(new RegExp(`^(\\S{1,3})\\s+(?=(${unitPat}))`, 'i'));
  if (!m) return line;
  const prefix = m[1];
  if (/^\d+$/.test(prefix)) return line;           // pure digits → genuine count
  if (/^[\d]+\/[\d]+$/.test(prefix)) return line;  // "1/4 cup" → already correct
  if (/^[¼½¾⅓⅔⅛⅜⅝⅞]$/.test(prefix)) return line; // Unicode fraction → correct
  const fraction = resolveFractionFragment(prefix);
  if (fraction === prefix) return line;
  return fraction + ' ' + line.slice(prefix.length).trimStart();
}

function emptyDraft(): RecipeDraft {
  return {
    title: '',
    source: '',
    pageNumber: '',
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

// Words that strongly indicate a savoury main — checked against TITLE first
// so a "Sticky Orange Chicken" is never mis-labelled as dessert.
const SAVORY_TITLE_WORDS = /chicken|beef|lamb|pork|fish|prawn|shrimp|turkey|duck|steak|mince|sausage|tofu|salmon|tuna|bacon|ham|veal|venison|crab|lobster|mussel|oyster/i;

// Dessert words — only applied when no savoury protein is in the title
const DESSERT_WORDS = /\b(cake|biscuit|cookie|tart|pudding|brownie|muffin|cupcake|cheesecake|ice.?cream|sorbet|pavlov|crumble|fudge|tiramisu|mousse|custard|meringue|eclair|macaron)\b/i;
const BAKING_WORDS  = /bread|loaf|roll|bun|scone|pastry|dough|flour|bake|oven/i;
const SNACK_WORDS   = /dip|spread|hummus|cracker|chip|nibble|bliss.?ball/i;
const DRINK_WORDS   = /smoothie|juice|cocktail|drink|shake|lemonade/i;
const SIDE_WORDS    = /salad|slaw|roast.?veg|side|relish|chutney|sauce|gravy/i;

function guessType(title: string, ingredients: string[]): RecipeType {
  // A savoury protein in the TITLE always wins — prevents "Sticky Orange Chicken"
  // or "Honey Soy Chicken Pie" being classified as dessert.
  if (SAVORY_TITLE_WORDS.test(title)) return 'main';

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
