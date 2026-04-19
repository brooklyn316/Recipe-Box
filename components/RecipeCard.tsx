import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Recipe } from '@/lib/types';
import { Colors, Spacing, Radius, Typography } from '@/lib/theme';

interface Props {
  recipe: Recipe;
  onPress?: () => void;
  onToggleFavourite?: (id: number) => void;
}

function StarRow({ rating }: { rating: number }) {
  if (!rating) return null;
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Ionicons
          key={s}
          name={s <= rating ? 'star' : 'star-outline'}
          size={11}
          color={s <= rating ? '#F5A623' : Colors.border}
        />
      ))}
    </View>
  );
}

export function RecipeCard({ recipe, onPress, onToggleFavourite }: Props) {
  const handlePress = onPress ?? (() => router.push(`/recipe/${recipe.id}`));

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={handlePress}
    >
      {/* Thumbnail */}
      {recipe.originalImageUri ? (
        <Image source={{ uri: recipe.originalImageUri }} style={styles.thumb} />
      ) : (
        <View style={styles.thumbPlaceholder}>
          <Ionicons name="restaurant-outline" size={28} color={Colors.textMuted} />
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>{recipe.title || 'Untitled Recipe'}</Text>

        {recipe.source ? (
          <Text style={styles.source} numberOfLines={1}>📖 {recipe.source}</Text>
        ) : null}

        <View style={styles.meta}>
          {recipe.servings ? (
            <Text style={styles.metaText}>🍽 {recipe.servings}</Text>
          ) : null}
          {recipe.cookTime ? (
            <Text style={styles.metaText}>⏱ {recipe.cookTime}</Text>
          ) : null}
        </View>

        <StarRow rating={recipe.rating ?? 0} />

        {recipe.tags.length > 0 && (
          <View style={styles.tags}>
            {recipe.tags.slice(0, 3).map((tag) => (
              <View key={tag} style={styles.chip}>
                <Text style={styles.chipText}>{tag}</Text>
              </View>
            ))}
            {recipe.tags.length > 3 && (
              <Text style={styles.moreText}>+{recipe.tags.length - 3}</Text>
            )}
          </View>
        )}
      </View>

      {/* Favourite button */}
      {onToggleFavourite && (
        <Pressable
          style={styles.favBtn}
          onPress={() => onToggleFavourite(recipe.id)}
          hitSlop={10}
        >
          <Ionicons
            name={recipe.isFavourite ? 'heart' : 'heart-outline'}
            size={22}
            color={recipe.isFavourite ? Colors.primary : Colors.textMuted}
          />
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.xs,
    overflow: 'hidden',
    shadowColor: Colors.shadow,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pressed: { opacity: 0.85 },
  thumb: { width: 90, height: 90 },
  thumbPlaceholder: {
    width: 90, height: 90,
    backgroundColor: Colors.chip,
    alignItems: 'center', justifyContent: 'center',
  },
  content: { flex: 1, padding: Spacing.sm, paddingRight: Spacing.xl },
  title: { ...Typography.h3, fontSize: 15, marginBottom: 2 },
  source: { ...Typography.small, marginBottom: 4 },
  meta: { flexDirection: 'row', gap: Spacing.md, marginBottom: 4 },
  metaText: { fontSize: 12, color: Colors.textMuted },
  stars: { flexDirection: 'row', gap: 2, marginBottom: 4 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip: { backgroundColor: Colors.chip, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  chipText: { fontSize: 11, color: Colors.chipText, fontWeight: '600' },
  moreText: { fontSize: 11, color: Colors.textMuted, alignSelf: 'center' },
  favBtn: { position: 'absolute', top: Spacing.sm, right: Spacing.sm },
});
