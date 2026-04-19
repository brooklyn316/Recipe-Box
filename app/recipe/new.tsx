import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { insertRecipe } from '@/lib/db';
import { RecipeDraft, RecipeType } from '@/lib/types';
import { RecipeForm, FormValues } from '@/components/RecipeForm';

export default function NewRecipeScreen() {
  const params = useLocalSearchParams<{ draft?: string; imageUri?: string }>();

  // The OCR scan image (book page) is passed in via params.imageUri.
  // We do NOT carry it into the recipe — it only existed for OCR purposes.
  // It will be deleted after saving. The recipe's dish photo starts as null.
  let initial: FormValues = {
    title: '',
    source: '',
    pageNumber: '',
    type: 'main' as RecipeType,
    servings: '',
    prepTime: '',
    cookTime: '',
    ingredients: [''],
    method: [''],
    notes: '',
    tags: [],
    originalImageUri: null,   // dish photo — user adds this separately
    isFavourite: false,
  };

  if (params.draft) {
    try {
      const draft: RecipeDraft = JSON.parse(params.draft);
      initial = {
        title:            draft.title,
        source:           draft.source,
        pageNumber:       draft.pageNumber,
        type:             draft.type,
        servings:         draft.servings,
        prepTime:         draft.prepTime,
        cookTime:         draft.cookTime,
        ingredients:      draft.ingredients.length > 0 ? draft.ingredients : [''],
        method:           draft.method.length > 0 ? draft.method : [''],
        notes:            draft.notes,
        tags:             draft.tags,
        originalImageUri: null,   // dish photo — not the scanned book page
        isFavourite:      false,
      };
    } catch {
      // silently fall back to blank form
    }
  }

  const handleSubmit = async (values: FormValues) => {
    const id = await insertRecipe({
      title:            values.title.trim(),
      source:           values.source.trim(),
      pageNumber:       values.pageNumber.trim(),
      type:             values.type,
      servings:         values.servings.trim(),
      prepTime:         values.prepTime.trim(),
      cookTime:         values.cookTime.trim(),
      ingredients:      values.ingredients.filter((i) => i.trim()),
      method:           values.method.filter((s) => s.trim()),
      notes:            values.notes.trim(),
      tags:             values.tags,
      originalImageUri: values.originalImageUri,
      isFavourite:      values.isFavourite,
      rating:           0,
    });

    // Delete the temporary OCR scan image — it's no longer needed
    if (params.imageUri) {
      try { await FileSystem.deleteAsync(params.imageUri, { idempotent: true }); } catch { /* ignore */ }
    }

    router.replace(`/recipe/${id}`);
  };

  return <RecipeForm initialValues={initial} onSubmit={handleSubmit} submitLabel="Save Recipe" screenTitle="New Recipe" />;
}
