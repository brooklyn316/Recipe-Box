import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet,
  RefreshControl, TextInput, ScrollView, Alert,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getAllRecipes, searchRecipes, toggleFavourite,
  getTopRatedRecipes, getRecipesByType, getRecipesByTagFilter,
  getRandomRecipe,
} from '../../lib/db';
import { Recipe, RecipeType, RecipeTag } from '../../lib/types';
import { RecipeCard } from '../../components/RecipeCard';
import { Colors, Spacing, Radius, Typography } from '../../lib/theme';

// ─── Filter config ────────────────────────────────────────────────────────────

type FilterId = 'all' | '5star' | `type:${string}` | `tag:${string}`;

interface FilterChip {
  id: FilterId;
  label: string;
}

const TYPE_FILTERS: FilterChip[] = [
  { id: 'type:main',     label: '🍽  Mains'     },
  { id: 'type:dessert',  label: '🍰  Desserts'  },
  { id: 'type:snack',    label: '🥨  Snacks'    },
  { id: 'type:side',     label: '🥗  Sides'     },
  { id: 'type:drink',    label: '🥤  Drinks'    },
  { id: 'type:airfryer', label: '🌬️  Air Fryer' },
  { id: 'type:other',    label: '📌  Other'     },
];

const TAG_FILTERS: FilterChip[] = [
  { id: 'tag:baking',           label: '🧁  Baking'         },
  { id: 'tag:breakfast',        label: '🍳  Breakfast'       },
  { id: 'tag:quick',            label: '⚡  Quick'           },
  { id: 'tag:vegetarian',       label: '🥬  Vegetarian'      },
  { id: 'tag:freezer-friendly', label: '❄️  Freezer-friendly'},
  { id: 'tag:family favourite', label: '❤️  Family Fav'      },
];

const ALL_CHIPS: FilterChip[] = [
  { id: 'all',   label: 'All' },
  { id: '5star', label: '★★★★★  Top rated' },
  ...TYPE_FILTERS,
  ...TAG_FILTERS,
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function RecipesScreen() {
  const [recipes, setRecipes]       = useState<Recipe[]>([]);
  const [query, setQuery]           = useState('');
  const [filter, setFilter]         = useState<FilterId>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const load = useCallback(async (q = query, f = filter) => {
    let data: Recipe[];

    if (q.trim().length > 0) {
      data = await searchRecipes(q);
    } else if (f === '5star') {
      data = await getTopRatedRecipes(5);
    } else if (f.startsWith('type:')) {
      data = await getRecipesByType(f.slice(5));
    } else if (f.startsWith('tag:')) {
      data = await getRecipesByTagFilter(f.slice(4));
    } else {
      data = await getAllRecipes();
    }

    setRecipes(data);
    if (f === 'all' && !q.trim()) setTotalCount(data.length);
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [filter]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onSearch = (text: string) => {
    setQuery(text);
    load(text, filter);
  };

  const onFilter = (f: FilterId) => {
    setFilter(f);
    setQuery('');
    load('', f);
  };

  const onToggle = async (id: number) => {
    await toggleFavourite(id);
    await load();
  };

  const handleSurprise = async () => {
    const isTopRated = filter === '5star';
    const recipe = await getRandomRecipe(isTopRated ? 5 : undefined);
    if (!recipe) {
      Alert.alert('No recipes yet', 'Add some recipes first!');
      return;
    }
    router.push(`/recipe/${recipe.id}`);
  };

  const activeLabel = ALL_CHIPS.find((c) => c.id === filter)?.label ?? 'All';
  const showEmpty   = recipes.length === 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Recipe Box 🍳</Text>
          {totalCount > 0 && (
            <Text style={styles.subtitle}>{totalCount} recipe{totalCount !== 1 ? 's' : ''}</Text>
          )}
        </View>
        <Pressable style={styles.addBtn} onPress={() => router.push('/ocr')}>
          <Ionicons name="camera-outline" size={20} color={Colors.white} />
          <Text style={styles.addBtnText}>Scan Recipe</Text>
        </Pressable>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search recipes, ingredients, tags…"
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={onSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {/* Surprise me button */}
        <Pressable onPress={handleSurprise} style={styles.surpriseBtn} hitSlop={8}>
          <Ionicons name="shuffle-outline" size={20} color={Colors.primary} />
        </Pressable>
      </View>

      {/* Filter chips — horizontal scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
        style={styles.filterBar}
      >
        {ALL_CHIPS.map((chip) => (
          <Pressable
            key={chip.id}
            style={[styles.filterChip, filter === chip.id && styles.filterChipActive]}
            onPress={() => onFilter(chip.id)}
          >
            <Text style={[styles.filterChipText, filter === chip.id && styles.filterChipTextActive]}>
              {chip.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Quick action links */}
      <View style={styles.quickLinks}>
        <Pressable style={styles.quickLink} onPress={() => router.push('/recipe/new')}>
          <Ionicons name="create-outline" size={15} color={Colors.accent} />
          <Text style={styles.quickLinkText}>Add manually</Text>
        </Pressable>
        <Text style={styles.quickLinkDivider}>·</Text>
        <Pressable style={styles.quickLink} onPress={() => router.push('/pantry')}>
          <Ionicons name="nutrition-outline" size={15} color={Colors.accent} />
          <Text style={styles.quickLinkText}>What can I make?</Text>
        </Pressable>
      </View>

      {/* Recipe list */}
      <FlatList
        data={recipes}
        keyExtractor={(r) => String(r.id)}
        renderItem={({ item }) => <RecipeCard recipe={item} onToggleFavourite={onToggle} />}
        contentContainerStyle={showEmpty ? styles.emptyContainer : styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name={query ? 'search-outline' : 'book-outline'} size={64} color={Colors.border} />
            <Text style={styles.emptyTitle}>
              {query
                ? 'No recipes found'
                : filter !== 'all'
                ? `No ${activeLabel.replace(/[^\w\s]/gi, '').trim()} recipes yet`
                : 'No recipes yet'}
            </Text>
            <Text style={styles.emptyBody}>
              {query
                ? 'Try a different search term or clear the filter.'
                : filter !== 'all'
                ? 'Add more recipes or try a different filter.'
                : 'Tap "Scan Recipe" to photograph a recipe page, or "Add recipe manually" to type one in.'}
            </Text>
            {filter !== 'all' && (
              <Pressable style={styles.clearFilterBtn} onPress={() => onFilter('all')}>
                <Text style={styles.clearFilterText}>Show all recipes</Text>
              </Pressable>
            )}
          </View>
        }
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingTop: 60, paddingBottom: Spacing.sm,
  },
  title: { ...Typography.h1 },
  subtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingVertical: 8, paddingHorizontal: 14, marginTop: 4,
  },
  addBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.md,
    marginHorizontal: Spacing.md, marginBottom: Spacing.xs,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
  },
  searchIcon: { marginRight: 4 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: Colors.text },
  surpriseBtn: {
    paddingHorizontal: 8, paddingVertical: 6,
    borderLeftWidth: 1, borderColor: Colors.border, marginLeft: 4,
  },

  filterBar: { maxHeight: 44 },
  filterScroll: {
    paddingHorizontal: Spacing.md, paddingVertical: 6, gap: 8,
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.full,
    backgroundColor: Colors.chip, borderWidth: 1.5, borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted, whiteSpace: 'nowrap' },
  filterChipTextActive: { color: Colors.white },

  quickLinks: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm,
  },
  quickLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  quickLinkText: { fontSize: 13, color: Colors.accent, fontWeight: '600' },
  quickLinkDivider: { fontSize: 13, color: Colors.textMuted },

  list: { paddingBottom: 40 },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16, marginTop: 40 },
  emptyTitle: { ...Typography.h2, textAlign: 'center' },
  emptyBody:  { ...Typography.body, textAlign: 'center', color: Colors.textMuted, lineHeight: 24 },
  clearFilterBtn: {
    marginTop: 4, paddingVertical: 8, paddingHorizontal: 20,
    backgroundColor: Colors.primary, borderRadius: Radius.full,
  },
  clearFilterText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
});
