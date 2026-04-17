import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, Image, Pressable,
  StyleSheet, Alert, Share,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getRecipeById, deleteRecipe, toggleFavourite } from '@/lib/db';
import { Recipe } from '@/lib/types';
import { Colors, Spacing, Radius, Typography } from '@/lib/theme';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const r = await getRecipeById(Number(id));
    setRecipe(r);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!recipe) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  const handleDelete = () => {
    Alert.alert(
      'Delete Recipe',
      `Are you sure you want to delete "${recipe.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await deleteRecipe(recipe.id);
            router.back();
          },
        },
      ]
    );
  };

  const handleShare = async () => {
    const text = [
      `📖 ${recipe.title}`,
      recipe.source ? `Source: ${recipe.source}` : '',
      recipe.servings ? `Serves: ${recipe.servings}` : '',
      '',
      'INGREDIENTS',
      ...recipe.ingredients.map((i) => `• ${i}`),
      '',
      'METHOD',
      ...recipe.method.map((s, i) => `${i + 1}. ${s}`),
      recipe.notes ? `\nNotes: ${recipe.notes}` : '',
    ].filter(Boolean).join('\n');

    await Share.share({ message: text, title: recipe.title });
  };

  const handleFav = async () => {
    await toggleFavourite(recipe.id);
    await load();
  };

  return (
    <View style={styles.container}>
      {/* Custom header buttons */}
      <View style={styles.headerBtns}>
        <Pressable onPress={handleFav} hitSlop={10}>
          <Ionicons
            name={recipe.isFavourite ? 'heart' : 'heart-outline'}
            size={24}
            color={recipe.isFavourite ? Colors.primary : Colors.textMuted}
          />
        </Pressable>
        <Pressable onPress={handleShare} hitSlop={10}>
          <Ionicons name="share-outline" size={24} color={Colors.textMuted} />
        </Pressable>
        <Pressable onPress={() => router.push(`/recipe/edit/${recipe.id}`)} hitSlop={10}>
          <Ionicons name="create-outline" size={24} color={Colors.primary} />
        </Pressable>
        <Pressable onPress={handleDelete} hitSlop={10}>
          <Ionicons name="trash-outline" size={24} color={Colors.danger} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Photo */}
        {recipe.originalImageUri && (
          <Image source={{ uri: recipe.originalImageUri }} style={styles.photo} resizeMode="cover" />
        )}

        {/* Title & meta */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>{recipe.title}</Text>
          {recipe.source ? <Text style={styles.source}>📖 {recipe.source}</Text> : null}

          <View style={styles.metaRow}>
            {recipe.servings  ? <MetaBadge icon="people-outline"   text={`Serves ${recipe.servings}`} /> : null}
            {recipe.prepTime  ? <MetaBadge icon="time-outline"     text={`Prep ${recipe.prepTime}`} />  : null}
            {recipe.cookTime  ? <MetaBadge icon="flame-outline"    text={`Cook ${recipe.cookTime}`} />  : null}
          </View>

          {recipe.tags.length > 0 && (
            <View style={styles.tags}>
              {recipe.tags.map((t) => (
                <View key={t} style={styles.chip}>
                  <Text style={styles.chipText}>{t}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Ingredients */}
        {recipe.ingredients.length > 0 && (
          <Section title="Ingredients">
            {recipe.ingredients.map((ing, i) => (
              <View key={i} style={styles.ingredientRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.ingredientText}>{ing}</Text>
              </View>
            ))}
          </Section>
        )}

        {/* Method */}
        {recipe.method.length > 0 && (
          <Section title="Method">
            {recipe.method.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNumBadge}>
                  <Text style={styles.stepNum}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </Section>
        )}

        {/* Notes */}
        {recipe.notes ? (
          <Section title="Notes">
            <Text style={styles.notes}>{recipe.notes}</Text>
          </Section>
        ) : null}

        {/* Original photo section */}
        {recipe.originalImageUri && (
          <Section title="Original Photo">
            <Text style={styles.originalPhotoHint}>
              Tap the photo below if you need to refer back to the original page.
            </Text>
            <Image
              source={{ uri: recipe.originalImageUri }}
              style={styles.originalPhoto}
              resizeMode="contain"
            />
          </Section>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function MetaBadge({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={styles.metaBadge}>
      <Ionicons name={icon} size={14} color={Colors.textMuted} />
      <Text style={styles.metaBadgeText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { ...Typography.body, color: Colors.textMuted },

  headerBtns: {
    flexDirection: 'row', justifyContent: 'flex-end',
    gap: Spacing.lg, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm,
  },

  content: { padding: Spacing.md, gap: Spacing.md },

  photo: { width: '100%', height: 220, borderRadius: Radius.md },

  titleSection: { gap: Spacing.sm },
  title: { ...Typography.h1 },
  source: { fontSize: 14, color: Colors.textMuted },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  metaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.chip, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  metaBadgeText: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: Colors.chip, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 4 },
  chipText: { fontSize: 12, color: Colors.chipText, fontWeight: '600' },

  section: { gap: Spacing.sm },
  sectionTitle: { ...Typography.h2, borderBottomWidth: 1.5, borderColor: Colors.border, paddingBottom: Spacing.xs },
  sectionContent: { gap: Spacing.xs },

  ingredientRow: { flexDirection: 'row', gap: Spacing.sm },
  bullet: { color: Colors.primary, fontSize: 18, lineHeight: 22, width: 14 },
  ingredientText: { flex: 1, ...Typography.body },

  stepRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  stepNumBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 1,
  },
  stepNum: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  stepText: { flex: 1, ...Typography.body, lineHeight: 24 },

  notes: { ...Typography.body, color: Colors.textMuted, lineHeight: 24, fontStyle: 'italic' },

  originalPhotoHint: { ...Typography.small, marginBottom: Spacing.sm },
  originalPhoto: { width: '100%', height: 300, borderRadius: Radius.md },
});
