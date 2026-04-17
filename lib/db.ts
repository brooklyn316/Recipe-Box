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
      created_at       INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at       INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_recipes_title    ON recipes(title);
    CREATE INDEX IF NOT EXISTS idx_recipes_favourite ON recipes(is_favourite);
    CREATE INDEX IF NOT EXISTS idx_recipes_updated  ON recipes(updated_at DESC);
  `);
}

// ─── Row → Recipe ─────────────────────────────────────────────────────────────

function rowToRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    title: row.title,
    source: row.source,
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

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
    'SELECT * FROM recipes WHERE id = ?',
    [id]
  );
  return row ? rowToRecipe(row) : null;
}

export async function insertRecipe(input: RecipeInput): Promise<number> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const result = await db.runAsync(
    `INSERT INTO recipes
      (title, source, type, servings, prep_time, cook_time,
       ingredients, method, notes, tags, original_image_uri,
       is_favourite, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.title,
      input.source,
      input.type,
      input.servings,
      input.prepTime,
      input.cookTime,
      JSON.stringify(input.ingredients),
      JSON.stringify(input.method),
      input.notes,
      JSON.stringify(input.tags),
      input.originalImageUri,
      input.isFavourite ? 1 : 0,
      now,
      now,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateRecipe(id: number, input: Partial<RecipeInput>): Promise<void> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (input.title !== undefined)          { fields.push('title = ?');              values.push(input.title); }
  if (input.source !== undefined)         { fields.push('source = ?');             values.push(input.source); }
  if (input.type !== undefined)           { fields.push('type = ?');               values.push(input.type); }
  if (input.servings !== undefined)       { fields.push('servings = ?');           values.push(input.servings); }
  if (input.prepTime !== undefined)       { fields.push('prep_time = ?');          values.push(input.prepTime); }
  if (input.cookTime !== undefined)       { fields.push('cook_time = ?');          values.push(input.cookTime); }
  if (input.ingredients !== undefined)    { fields.push('ingredients = ?');        values.push(JSON.stringify(input.ingredients)); }
  if (input.method !== undefined)         { fields.push('method = ?');             values.push(JSON.stringify(input.method)); }
  if (input.notes !== undefined)          { fields.push('notes = ?');              values.push(input.notes); }
  if (input.tags !== undefined)           { fields.push('tags = ?');               values.push(JSON.stringify(input.tags)); }
  if (input.originalImageUri !== undefined) { fields.push('original_image_uri = ?'); values.push(input.originalImageUri); }
  if (input.isFavourite !== undefined)    { fields.push('is_favourite = ?');       values.push(input.isFavourite ? 1 : 0); }

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await db.runAsync(
    `UPDATE recipes SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
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

// ─── Search ───────────────────────────────────────────────────────────────────

export async function searchRecipes(query: string): Promise<Recipe[]> {
  const db = await getDb();
  const pattern = `%${query.toLowerCase()}%`;
  const rows = await db.getAllAsync<RecipeRow>(
    `SELECT * FROM recipes
     WHERE lower(title) LIKE ?
        OR lower(source) LIKE ?
        OR lower(ingredients) LIKE ?
        OR lower(tags) LIKE ?
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
