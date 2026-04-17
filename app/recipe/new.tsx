import React from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { insertRecipe } from '@/lib/db';
import { RecipeDraft, RecipeType } from '@/lib/types';
import { RecipeForm, FormValues } from '@/components/RecipeForm';

export default function NewRecipeScreen() {
  const params = useLocalSearchParams<{ draft?: string; imageUri?: string }>();

  // Build initial form values — either from OCR draft or blank
  let initial: FormValues = {
    title: '',
    source: '',
    type: 'main' as RecipeType,
    servings: '',
    prepTime: '',
    cookTime: '',
    ingredients: [''],
    method: [''],
    notes: '',
    tags: [],
    originalImageUri: null,
    isFavourite: false,
  };

  if (params.draft) {
    try {
      const draft: RecipeDraft = JSON.parse(params.draft);
      initial = {
        title:           draft.title,
        source:          draft.source,
        type:            draft.type,
        servings:        draft.servings,
        prepTime:        draft.prepTime,
        cookTime:        draft.cookTime,
        ingredients:     draft.ingredients.length > 0 ? draft.ingredients : [''],
        method:          draft.method.length > 0 ? draft.method : [''],
        notes:           draft.notes,
        tags:            draft.tags,
        originalImageUri: params.imageUri || null,
        isFavourite:     false,
      };
    } catch {
      // silently fall back to blank form
    }
  }

  const handleSubmit = async (values: FormValues) => {
    const id = await insertRecipe({
      title:            values.title.trim(),
      source:           values.source.trim(),
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
    });
    // Navigate to the newly created recipe
    router.replace(`/recipe/${id}`);
  };

  return <RecipeForm initialValues={initial} onSubmit={handleSubmit} submitLabel="Save Recipe" />;
}
