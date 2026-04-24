import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Recipe, RecipeInput } from './types';

const FILE_VERSION = 1;

// ── Export a recipe as a .recipebox file and open the iOS Share Sheet ─────────

export async function shareRecipe(recipe: Recipe): Promise<void> {
  const payload = {
    version: FILE_VERSION,
    exportedAt: new Date().toISOString(),
    recipe: {
      title:       recipe.title,
      source:      recipe.source,
      pageNumber:  recipe.pageNumber,
      type:        recipe.type,
      servings:    recipe.servings,
      prepTime:    recipe.prepTime,
      cookTime:    recipe.cookTime,
      ingredients: recipe.ingredients,
      method:      recipe.method,
      notes:       recipe.notes,
      tags:        recipe.tags,
      rating:      recipe.rating,
      isFavourite: recipe.isFavourite,
    },
  };

  const safeName = recipe.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const fileUri  = FileSystem.cacheDirectory + `${safeName}.recipebox`;

  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device.');

  await Sharing.shareAsync(fileUri, {
    mimeType:    'application/json',
    dialogTitle: `Share "${recipe.title}"`,
    UTI:         'com.dardern.recipebox.recipe',
  });
}

// ── Parse an incoming .recipebox file URL into a RecipeInput ──────────────────

export async function parseRecipeFile(fileUri: string): Promise<RecipeInput | null> {
  try {
    const json = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const data = JSON.parse(json);
    if (data.version === FILE_VERSION && data.recipe) {
      const r = data.recipe;
      return {
        title:           r.title        ?? '',
        source:          r.source       ?? '',
        pageNumber:      r.pageNumber   ?? '',
        type:            r.type         ?? 'other',
        servings:        r.servings     ?? '',
        prepTime:        r.prepTime     ?? '',
        cookTime:        r.cookTime     ?? '',
        ingredients:     Array.isArray(r.ingredients) ? r.ingredients : [],
        method:          Array.isArray(r.method)      ? r.method      : [],
        notes:           r.notes        ?? '',
        tags:            Array.isArray(r.tags)        ? r.tags        : [],
        rating:          typeof r.rating === 'number' ? r.rating      : 0,
        isFavourite:     r.isFavourite  ?? false,
        originalImageUri: null,
      };
    }
    return null;
  } catch (err) {
    console.error('Failed to parse .recipebox file:', err);
    return null;
  }
}
