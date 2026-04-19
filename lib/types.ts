// ─── Recipe Types ────────────────────────────────────────────────────────────

export type RecipeTag =
  | 'baking'
  | 'cooking'
  | 'savory'
  | 'sweet'
  | 'hot'
  | 'cold'
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'dessert'
  | 'snacks'
  | 'vegetarian'
  | 'family favourite'
  | 'quick'
  | 'freezer-friendly';

export type RecipeType = 'main' | 'dessert' | 'snack' | 'side' | 'drink' | 'airfryer' | 'other';

export interface Recipe {
  id: number;
  title: string;
  source: string;          // e.g. "Edmonds Cookbook", "Magazine clipping"
  pageNumber: string;      // e.g. "48"
  type: RecipeType;
  servings: string;        // e.g. "4", "4–6"
  prepTime: string;        // e.g. "15 min"
  cookTime: string;        // e.g. "45 min"
  ingredients: string[];   // one per line
  method: string[];        // one step per element
  notes: string;
  tags: RecipeTag[];
  originalImageUri: string | null;  // path to saved photo
  isFavourite: boolean;
  rating: number;          // 0 = unrated, 1–5 stars
  createdAt: number;       // unix timestamp
  updatedAt: number;
}

export type RecipeInput = Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>;

// ─── DB Row (SQLite stores arrays as JSON strings) ───────────────────────────

export interface RecipeRow {
  id: number;
  title: string;
  source: string;
  page_number: string;
  type: string;
  servings: string;
  prep_time: string;
  cook_time: string;
  ingredients: string;    // JSON
  method: string;         // JSON
  notes: string;
  tags: string;           // JSON
  original_image_uri: string | null;
  is_favourite: number;   // 0 | 1
  rating: number;         // 0–5
  created_at: number;
  updated_at: number;
}

// ─── OCR Result ──────────────────────────────────────────────────────────────

export interface OcrResult {
  rawText: string;
  confidence: 'high' | 'medium' | 'low';
}

// ─── Parsed OCR Draft ────────────────────────────────────────────────────────

export interface RecipeDraft {
  title: string;
  source: string;
  pageNumber: string;
  servings: string;
  prepTime: string;
  cookTime: string;
  ingredients: string[];
  method: string[];
  notes: string;
  tags: RecipeTag[];
  type: RecipeType;
}
