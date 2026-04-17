import React, { useCallback, useEffect, useState } from 'react';
import {
  View, FlatList, Text, Pressable, StyleSheet,
  RefreshControl, ScrollView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getAllRecipes, searchRecipes, toggleFavourite, getRecipesByTag, getFavourites } from '@/lib/db';
import { Recipe, RecipeTag } from '@/lib/types';
import { RecipeCard } from '@/components/RecipeCard';
import { SearchBar } from '@/components/SearchBar';
import { Colors, Spacing, Radius, Typography } from '@/lib/theme';

const QUICK_FILTERS: { label: string; tag: RecipeTag | 'all' | 'favourites' }[] = [
  { label: 'All',           tag: 'all' },
  { label: '❤️ Favourites', tag: 'favourites' },
  { label: '🍳 Breakfast',  tag: 'breakfast' },
  { label: '🍽 Dinner',     tag: 'dinner' },
  { label: '🎂 Dessert',    tag: 'dessert' },
  { label: '🥐 Baking',     tag: 'baking' },
  { label: '🥗 Vegetarian', tag: 'vegetarian' },
  { label: '⚡ Quick',      tag: 'quick' },
];

export default function RecipesScreen() {
  const [recipes, setRecipes]       = useState<Recipe[]>([]);
  const [query, setQuery]           = useState('');
  const [activeFilter, setFilter]   = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    let data: Recipe[];
    if (query.trim()) {
      data = await searchRecipes(query.trim());
    } else if (activeFilter === 'all') {
      data = await getAllRecipes();
    } else if (activeFilter === 'favourites') {
      data = await getFavourites();
    } else {
      data = await getRecipesByTag(activeFilter);
    }
    setRecipes(data);
  }, [query, activeFilter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => { load(); }, [query, activeFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onToggleFavourite = async (id: number) => {
    await toggleFavourite(id);
    await load();
  };

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <SearchBar value={query} onChangeText={setQuery} />
        </View>
      </View>

      {/* Quick filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}
      >
        {QUICK_FILTERS.map(({ label, tag }) => {
          const active = activeFilter === tag && !query;
          return (
            <Pressable
              key={tag}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => { setQuery(''); setFilter(tag); }}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Recipe list */}
      <FlatList
        data={recipes}
        keyExtractor={(r) => String(r.id)}
        renderItem={({ item }) => (
          <RecipeCard recipe={item} onToggleFavourite={onToggleFavourite} />
        )}
        contentContainerStyle={recipes.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={<EmptyState query={query} />}
      />

      {/* FAB: scan / add */}
      <View style={styles.fabRow}>
        <Pressable style={[styles.fab, styles.fabSecondary]} onPress={() => router.push('/recipe/new')}>
          <Ionicons name="create-outline" size={22} color={Colors.white} />
          <Text style={styles.fabLabel}>Type</Text>
        </Pressable>
        <Pressable style={styles.fab} onPress={() => router.push('/ocr')}>
          <Ionicons name="camera-outline" size={24} color={Colors.white} />
          <Text style={styles.fabLabel}>Scan</Text>
        </Pressable>
      </View>
    </View>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name="restaurant-outline" size={64} color={Colors.border} />
      {query ? (
        <>
          <Text style={styles.emptyTitle}>No results for "{query}"</Text>
          <Text style={styles.emptyBody}>Try searching by ingredient, tag, or source book.</Text>
        </>
      ) : (
        <>
          <Text style={styles.emptyTitle}>No recipes yet</Text>
          <Text style={styles.emptyBody}>
            Tap <Text style={{ fontWeight: '700' }}>Scan</Text> to photograph a recipe page,
            or <Text style={{ fontWeight: '700' }}>Type</Text> to enter one manually.
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchRow: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.xs },
  searchWrap: { flex: 1 },
  filterScroll: { flexGrow: 0 },
  filterRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.chip,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText:  { fontSize: 13, color: Colors.chipText, fontWeight: '600' },
  filterTextActive: { color: Colors.white },
  listContent: { paddingVertical: Spacing.sm, paddingBottom: 100 },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md, marginTop: 60 },
  emptyTitle: { ...Typography.h2, textAlign: 'center' },
  emptyBody:  { ...Typography.body, textAlign: 'center', color: Colors.textMuted },
  fabRow: {
    position: 'absolute', bottom: Spacing.xl, right: Spacing.md,
    flexDirection: 'row', gap: Spacing.sm,
  },
  fab: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: 20, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    shadowColor: Colors.primaryDark,
    shadowOpacity: 0.4, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  fabSecondary: { backgroundColor: Colors.accent },
  fabLabel: { fontSize: 14, fontWeight: '700', color: Colors.white },
});
