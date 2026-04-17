import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getRecipeById, updateRecipe } from '@/lib/db';
import { Recipe } from '@/lib/types';
import { RecipeForm, FormValues } from '@/components/RecipeForm';
import { Colors } from '@/lib/theme';

export default function EditRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);

  useEffect(() => {
    if (id) getRecipeById(Number(id)).then(setRecipe);
  }, [id]);

  if (!recipe) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primary} />
        <Text style={{ color: Colors.textMuted, marginTop: 12 }}>Loading…</Text>
      </View>
    );
  }

  const initial: FormValues = {
    title:            recipe.title,
    source:           recipe.source,
    type:             recipe.type,
    servings:         recipe.servings,
    prepTime:         recipe.prepTime,
    cookTime:         recipe.cookTime,
    ingredients:      recipe.ingredients.length > 0 ? recipe.ingredients : [''],
    method:           recipe.method.length > 0 ? recipe.method : [''],
    notes:            recipe.notes,
    tags:             recipe.tags,
    originalImageUri: recipe.originalImageUri,
    isFavourite:      recipe.isFavourite,
  };

  const handleSubmit = async (values: FormValues) => {
    await updateRecipe(recipe.id, {
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
    router.back();
  };

  return <RecipeForm initialValues={initial} onSubmit={handleSubmit} submitLabel="Save Changes" />;
}
