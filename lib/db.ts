import * as SQLite from 'expo-sqlite';
import { Recipe, RecipeDraft, RecipeInput, RecipeRow, RecipeTag, RecipeType } from './types';

// ─── Open DB ─────────────────────────────────────────────────────────────────

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('recipebox.db');
  return _db;
}

// ─── Init Schema ─────────────────────────────────────────────────────────────

export async function initDb(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS recipes (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      title            TEXT    NOT NULL,
      source           TEXT    NOT NULL DEFAULT '',
      page_number      TEXT    NOT NULL DEFAULT '',
      type             TEXT    NOT NULL DEFAULT 'main',
      servings         TEXT    NOT NULL DEFAULT '',
      prep_time        TEXT    NOT NULL DEFAULT '',
      cook_time        TEXT    NOT NULL DEFAULT '',
      ingredients      TEXT    NOT NULL DEFAULT '[]',
      method           TEXT    NOT NULL DEFAULT '[]',
      notes            TEXT    NOT NULL DEFAULT '',
      tags             TEXT    NOT NULL DEFAULT '[]',
      original_image_uri TEXT,
      is_favourite     INTEGER NOT NULL DEFAULT 0,
      rating           INTEGER NOT NULL DEFAULT 0,
      created_at       INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at       INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_recipes_title     ON recipes(title);
    CREATE INDEX IF NOT EXISTS idx_recipes_favourite ON recipes(is_favourite);
    CREATE INDEX IF NOT EXISTS idx_recipes_updated   ON recipes(updated_at DESC);

    -- Cooking log: every time a recipe is made
    CREATE TABLE IF NOT EXISTS cooking_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id  INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      cooked_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      notes      TEXT    NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_log_recipe ON cooking_log(recipe_id, cooked_at DESC);

    -- Shopping list items
    CREATE TABLE IF NOT EXISTS shopping_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      text        TEXT    NOT NULL,
      is_checked  INTEGER NOT NULL DEFAULT 0,
      recipe_id   INTEGER,
      recipe_name TEXT    NOT NULL DEFAULT '',
      added_at    INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    -- Collections (named folders)
    CREATE TABLE IF NOT EXISTS collections (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    -- Recipe ↔ Collection join
    CREATE TABLE IF NOT EXISTS recipe_collections (
      collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      recipe_id     INTEGER NOT NULL REFERENCES recipes(id)     ON DELETE CASCADE,
      added_at      INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      PRIMARY KEY (collection_id, recipe_id)
    );

    -- Meal planner: one recipe per day slot
    CREATE TABLE IF NOT EXISTS meal_plan (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      date_str   TEXT    NOT NULL,   -- 'YYYY-MM-DD'
      meal_type  TEXT    NOT NULL DEFAULT 'dinner',
      recipe_id  INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      UNIQUE(date_str, meal_type)
    );
  `);

  // Safe migrations — add columns that may not exist yet
  const migrations = [
    `ALTER TABLE recipes ADD COLUMN page_number TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE recipes ADD COLUMN rating INTEGER NOT NULL DEFAULT 0`,
  ];
  for (const sql of migrations) {
    try { await db.execAsync(sql); } catch { /* column already exists */ }
  }
}

// ─── Row → Recipe ─────────────────────────────────────────────────────────────

function rowToRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    title: row.title,
    source: row.source,
    pageNumber: row.page_number ?? '',
    type: row.type as RecipeType,
    servings: row.servings,
    prepTime: row.prep_time,
    cookTime: row.cook_time,
    ingredients: JSON.parse(row.ingredients),
    method: JSON.parse(row.method),
    notes: row.notes,
    tags: JSON.parse(row.tags) as RecipeTag[],
    originalImageUri: row.original_image_uri,
    isFavourite: row.is_favourite === 1,
    rating: row.rating ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Recipes CRUD ─────────────────────────────────────────────────────────────

export async function getAllRecipes(): Promise<Recipe[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RecipeRow>(
    'SELECT * FROM recipes ORDER BY updated_at DESC'
  );
  return rows.map(rowToRecipe);
}

export async function getRecipeById(id: number): Promise<Recipe | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<RecipeRow>(
    'SELECT * FROM recipes WHERE id = ?', [id]
  );
  return row ? rowToRecipe(row) : null;
}

export async function insertRecipe(input: RecipeInput): Promise<number> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const result = await db.runAsync(
    `INSERT INTO recipes
      (title, source, page_number, type, servings, prep_time, cook_time,
       ingredients, method, notes, tags, original_image_uri,
       is_favourite, rating, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.title, input.source, input.pageNumber, input.type,
      input.servings, input.prepTime, input.cookTime,
      JSON.stringify(input.ingredients), JSON.stringify(input.method),
      input.notes, JSON.stringify(input.tags), input.originalImageUri,
      input.isFavourite ? 1 : 0, input.rating ?? 0, now, now,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateRecipe(id: number, input: Partial<RecipeInput>): Promise<void> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (input.title !== undefined)           { fields.push('title = ?');              values.push(input.title); }
  if (input.source !== undefined)          { fields.push('source = ?');             values.push(input.source); }
  if (input.pageNumber !== undefined)      { fields.push('page_number = ?');        values.push(input.pageNumber); }
  if (input.type !== undefined)            { fields.push('type = ?');               values.push(input.type); }
  if (input.servings !== undefined)        { fields.push('servings = ?');           values.push(input.servings); }
  if (input.prepTime !== undefined)        { fields.push('prep_time = ?');          values.push(input.prepTime); }
  if (input.cookTime !== undefined)        { fields.push('cook_time = ?');          values.push(input.cookTime); }
  if (input.ingredients !== undefined)     { fields.push('ingredients = ?');        values.push(JSON.stringify(input.ingredients)); }
  if (input.method !== undefined)          { fields.push('method = ?');             values.push(JSON.stringify(input.method)); }
  if (input.notes !== undefined)           { fields.push('notes = ?');              values.push(input.notes); }
  if (input.tags !== undefined)            { fields.push('tags = ?');               values.push(JSON.stringify(input.tags)); }
  if (input.originalImageUri !== undefined){ fields.push('original_image_uri = ?'); values.push(input.originalImageUri); }
  if (input.isFavourite !== undefined)     { fields.push('is_favourite = ?');       values.push(input.isFavourite ? 1 : 0); }
  if (input.rating !== undefined)          { fields.push('rating = ?');             values.push(input.rating); }

  fields.push('updated_at = ?');
  values.push(now, id);

  await db.runAsync(`UPDATE recipes SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteRecipe(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM recipes WHERE id = ?', [id]);
}

export async function toggleFavourite(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE recipes SET is_favourite = CASE WHEN is_favourite = 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?',
    [Math.floor(Date.now() / 1000), id]
  );
}

// ─── Search / filter ──────────────────────────────────────────────────────────

export async function searchRecipes(query: string): Promise<Recipe[]> {
  const db = await getDb();
  const pattern = `%${query.toLowerCase()}%`;
  const rows = await db.getAllAsync<RecipeRow>(
    `SELECT * FROM recipes
     WHERE lower(title) LIKE ? OR lower(source) LIKE ?
        OR lower(ingredients) LIKE ? OR lower(tags) LIKE ?
     ORDER BY updated_at DESC`,
    [pattern, pattern, pattern, pattern]
  );
  return rows.map(rowToRecipe);
}

export async function getRecipesByTag(tag: string): Promise<Recipe[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RecipeRow>(
    `SELECT * FROM recipes WHERE lower(tags) LIKE ? ORDER BY updated_at DESC`,
    [`%"${tag.toLowerCase()}"%`]
  );
  return rows.map(rowToRecipe);
}

export async function getFavourites(): Promise<Recipe[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RecipeRow>(
    'SELECT * FROM recipes WHERE is_favourite = 1 ORDER BY updated_at DESC'
  );
  return rows.map(rowToRecipe);
}

export async function setRating(id: number, rating: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE recipes SET rating = ?, updated_at = ? WHERE id = ?',
    [Math.min(5, Math.max(0, rating)), Math.floor(Date.now() / 1000), id]
  );
}

export async function getRecipesByType(type: string): Promise<Recipe[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RecipeRow>(
    'SELECT * FROM recipes WHERE type = ? ORDER BY updated_at DESC', [type]
  );
  return rows.map(rowToRecipe);
}

export async function getRecipesByTagFilter(tag: string): Promise<Recipe[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RecipeRow>(
    `SELECT * FROM recipes WHERE lower(tags) LIKE ? ORDER BY updated_at DESC`,
    [`%"${tag.toLowerCase()}"%`]
  );
  return rows.map(rowToRecipe);
}

export async function getRandomRecipe(fromRated?: number): Promise<Recipe | null> {
  const db = await getDb();
  const row = fromRated
    ? await db.getFirstAsync<RecipeRow>('SELECT * FROM recipes WHERE rating >= ? ORDER BY RANDOM() LIMIT 1', [fromRated])
    : await db.getFirstAsync<RecipeRow>('SELECT * FROM recipes ORDER BY RANDOM() LIMIT 1');
  return row ? rowToRecipe(row) : null;
}

export async function getTopRatedRecipes(minRating = 5): Promise<Recipe[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RecipeRow>(
    'SELECT * FROM recipes WHERE rating >= ? ORDER BY rating DESC, updated_at DESC',
    [minRating]
  );
  return rows.map(rowToRecipe);
}

// ─── Cooking Log ──────────────────────────────────────────────────────────────

export interface CookEntry {
  id: number;
  recipeId: number;
  cookedAt: number;   // unix timestamp
  notes: string;
}

export async function logCook(recipeId: number, notes = ''): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO cooking_log (recipe_id, cooked_at, notes) VALUES (?, ?, ?)',
    [recipeId, Math.floor(Date.now() / 1000), notes]
  );
}

export async function getCookLog(recipeId: number): Promise<CookEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: number; recipe_id: number; cooked_at: number; notes: string }>(
    'SELECT * FROM cooking_log WHERE recipe_id = ? ORDER BY cooked_at DESC',
    [recipeId]
  );
  return rows.map((r) => ({ id: r.id, recipeId: r.recipe_id, cookedAt: r.cooked_at, notes: r.notes }));
}

export async function deleteCookEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM cooking_log WHERE id = ?', [id]);
}

// ─── Shopping List ────────────────────────────────────────────────────────────

export interface ShoppingItem {
  id: number;
  text: string;
  isChecked: boolean;
  recipeId: number | null;
  recipeName: string;
  addedAt: number;
}

function rowToItem(r: any): ShoppingItem {
  return {
    id: r.id, text: r.text, isChecked: r.is_checked === 1,
    recipeId: r.recipe_id, recipeName: r.recipe_name, addedAt: r.added_at,
  };
}

export async function getShoppingItems(): Promise<ShoppingItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT * FROM shopping_items ORDER BY added_at ASC');
  return (rows as any[]).map(rowToItem);
}

export async function addToShoppingList(items: string[], recipeId: number | null, recipeName: string): Promise<void> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  for (const text of items) {
    await db.runAsync(
      'INSERT INTO shopping_items (text, recipe_id, recipe_name, added_at) VALUES (?, ?, ?, ?)',
      [text, recipeId, recipeName, now]
    );
  }
}

export async function addCustomShoppingItem(text: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO shopping_items (text, added_at) VALUES (?, ?)',
    [text, Math.floor(Date.now() / 1000)]
  );
}

export async function toggleShoppingItem(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE shopping_items SET is_checked = CASE WHEN is_checked = 1 THEN 0 ELSE 1 END WHERE id = ?',
    [id]
  );
}

export async function clearCheckedItems(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM shopping_items WHERE is_checked = 1');
}

export async function clearAllShoppingItems(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM shopping_items');
}

export async function deleteShoppingItem(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM shopping_items WHERE id = ?', [id]);
}

// ─── Collections ──────────────────────────────────────────────────────────────

export interface Collection {
  id: number;
  name: string;
  createdAt: number;
  recipeCount?: number;
}

export async function getCollections(): Promise<Collection[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: number; name: string; created_at: number; cnt: number }>(
    `SELECT c.id, c.name, c.created_at,
            COUNT(rc.recipe_id) AS cnt
     FROM collections c
     LEFT JOIN recipe_collections rc ON rc.collection_id = c.id
     GROUP BY c.id ORDER BY c.created_at DESC`
  );
  return rows.map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at, recipeCount: r.cnt }));
}

export async function createCollection(name: string): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    'INSERT INTO collections (name, created_at) VALUES (?, ?)',
    [name, Math.floor(Date.now() / 1000)]
  );
  return result.lastInsertRowId;
}

export async function deleteCollection(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM collections WHERE id = ?', [id]);
}

export async function renameCollection(id: number, name: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE collections SET name = ? WHERE id = ?', [name, id]);
}

export async function addRecipeToCollection(collectionId: number, recipeId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR IGNORE INTO recipe_collections (collection_id, recipe_id, added_at) VALUES (?, ?, ?)',
    [collectionId, recipeId, Math.floor(Date.now() / 1000)]
  );
}

export async function removeRecipeFromCollection(collectionId: number, recipeId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'DELETE FROM recipe_collections WHERE collection_id = ? AND recipe_id = ?',
    [collectionId, recipeId]
  );
}

export async function getCollectionRecipes(collectionId: number): Promise<Recipe[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RecipeRow>(
    `SELECT r.* FROM recipes r
     JOIN recipe_collections rc ON rc.recipe_id = r.id
     WHERE rc.collection_id = ?
     ORDER BY rc.added_at DESC`,
    [collectionId]
  );
  return rows.map(rowToRecipe);
}

export async function getRecipeCollectionIds(recipeId: number): Promise<number[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ collection_id: number }>(
    'SELECT collection_id FROM recipe_collections WHERE recipe_id = ?', [recipeId]
  );
  return rows.map((r) => r.collection_id);
}

// ─── Meal Planner ─────────────────────────────────────────────────────────────

export interface MealPlanEntry {
  id: number;
  dateStr: string;
  mealType: string;
  recipe: Recipe;
}

export async function getMealPlanWeek(startDateStr: string, endDateStr: string): Promise<MealPlanEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: number; date_str: string; meal_type: string } & RecipeRow>(
    `SELECT mp.id, mp.date_str, mp.meal_type, r.*
     FROM meal_plan mp
     JOIN recipes r ON r.id = mp.recipe_id
     WHERE mp.date_str BETWEEN ? AND ?
     ORDER BY mp.date_str, mp.meal_type`,
    [startDateStr, endDateStr]
  );
  return rows.map((r) => ({
    id: r.id,
    dateStr: r.date_str,
    mealType: r.meal_type,
    recipe: rowToRecipe(r),
  }));
}

export async function setMealPlan(dateStr: string, mealType: string, recipeId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO meal_plan (date_str, meal_type, recipe_id) VALUES (?, ?, ?)',
    [dateStr, mealType, recipeId]
  );
}

export async function removeMealPlan(dateStr: string, mealType: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'DELETE FROM meal_plan WHERE date_str = ? AND meal_type = ?',
    [dateStr, mealType]
  );
}
