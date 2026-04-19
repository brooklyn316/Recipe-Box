import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList,
  StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getAllRecipes } from '@/lib/db';
import { Recipe } from '@/lib/types';
import { Colors, Spacing, Radius, Typography } from '@/lib/theme';

// ─── Match logic ──────────────────────────────────────────────────────────────

interface MatchedRecipe {
  recipe: Recipe;
  matchCount: number;
  matchedTerms: string[];
}

function findMatches(recipes: Recipe[], terms: string[]): MatchedRecipe[] {
  if (terms.length === 0) return [];

  const results: MatchedRecipe[] = [];

  for (const recipe of recipes) {
    const haystack = recipe.ingredients.join(' ').toLowerCase();
    const matchedTerms: string[] = [];

    for (const term of terms) {
      if (haystack.includes(term.toLowerCase())) {
        matchedTerms.push(term);
      }
    }

    if (matchedTerms.length > 0) {
      results.push({ recipe, matchCount: matchedTerms.length, matchedTerms });
    }
  }

  // Sort: most ingredients matched first, then alphabetically
  return results.sort((a, b) =>
    b.matchCount - a.matchCount || a.recipe.title.localeCompare(b.recipe.title)
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PantryScreen() {
  const [input, setInput]       = useState('');
  const [chips, setChips]       = useState<string[]>([]);
  const [results, setResults]   = useState<MatchedRecipe[] | null>(null);
  const [loading, setLoading]   = useState(false);

  const addChip = (text: string) => {
    const trimmed = text.trim().replace(/,+$/, '').trim();
    if (!trimmed || chips.includes(trimmed.toLowerCase())) return;
    setChips((prev) => [...prev, trimmed.toLowerCase()]);
  };

  const handleInputSubmit = () => {
    // Allow comma-separated entry
    const parts = input.split(',').map((s) => s.trim()).filter(Boolean);
    parts.forEach(addChip);
    setInput('');
  };

  const handleInputChange = (text: string) => {
    // Auto-add chip when user types a comma
    if (text.endsWith(',')) {
      const parts = text.split(',').map((s) => s.trim()).filter(Boolean);
      parts.forEach(addChip);
      setInput('');
    } else {
      setInput(text);
    }
  };

  const removeChip = (chip: string) => {
    setChips((prev) => prev.filter((c) => c !== chip));
    setResults(null);
  };

  const handleSearch = async () => {
    const terms = [...chips];
    if (input.trim()) {
      input.split(',').map((s) => s.trim()).filter(Boolean).forEach((t) => terms.push(t.toLowerCase()));
    }
    if (terms.length === 0) return;
    setLoading(true);
    try {
      const all = await getAllRecipes();
      setResults(findMatches(all, terms));
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setChips([]);
    setInput('');
    setResults(null);
  };

  const totalTerms = chips.length + (input.trim() ? 1 : 0);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>What can I make?</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        <Text style={styles.instructions}>
          Type the ingredients you have — add as many as you like. The app will find recipes that use them.
        </Text>

        {/* Ingredient input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={handleInputChange}
            onSubmitEditing={handleInputSubmit}
            placeholder="e.g. chicken, garlic, lemon…"
            placeholderTextColor={Colors.textMuted}
            returnKeyType="done"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            style={[styles.addBtn, !input.trim() && styles.addBtnDisabled]}
            onPress={handleInputSubmit}
            disabled={!input.trim()}
          >
            <Ionicons name="add" size={22} color={Colors.white} />
          </Pressable>
        </View>

        {/* Ingredient chips */}
        {chips.length > 0 && (
          <View style={styles.chipsWrap}>
            {chips.map((chip) => (
              <Pressable key={chip} style={styles.chip} onPress={() => removeChip(chip)}>
                <Text style={styles.chipText}>{chip}</Text>
                <Ionicons name="close" size={13} color={Colors.primary} />
              </Pressable>
            ))}
          </View>
        )}

        {/* Search / clear buttons */}
        <View style={styles.btnRow}>
          <Pressable
            style={[styles.searchBtn, totalTerms === 0 && styles.searchBtnDisabled]}
            onPress={handleSearch}
            disabled={totalTerms === 0 || loading}
          >
            {loading
              ? <ActivityIndicator color={Colors.white} size="small" />
              : <>
                  <Ionicons name="search" size={18} color={Colors.white} />
                  <Text style={styles.searchBtnText}>Find Recipes</Text>
                </>}
          </Pressable>
          {(chips.length > 0 || results !== null) && (
            <Pressable style={styles.clearBtn} onPress={handleClear}>
              <Text style={styles.clearBtnText}>Clear all</Text>
            </Pressable>
          )}
        </View>

        {/* Results */}
        {results !== null && (
          <View style={styles.results}>
            {results.length === 0 ? (
              <View style={styles.noResults}>
                <Ionicons name="sad-outline" size={48} color={Colors.border} />
                <Text style={styles.noResultsTitle}>No matches found</Text>
                <Text style={styles.noResultsBody}>
                  Try adding more ingredients or check for spelling.
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.resultsLabel}>
                  {results.length} recipe{results.length !== 1 ? 's' : ''} found
                </Text>
                {results.map(({ recipe, matchCount, matchedTerms }) => (
                  <Pressable
                    key={recipe.id}
                    style={styles.resultCard}
                    onPress={() => router.push(`/recipe/${recipe.id}`)}
                  >
                    <View style={styles.resultTop}>
                      <Text style={styles.resultTitle} numberOfLines={2}>{recipe.title}</Text>
                      <View style={[
                        styles.matchBadge,
                        matchCount === chips.length ? styles.matchBadgeFull : styles.matchBadgePartial,
                      ]}>
                        <Ionicons
                          name={matchCount === chips.length ? 'checkmark-circle' : 'ellipse'}
                          size={12}
                          color={Colors.white}
                        />
                        <Text style={styles.matchBadgeText}>
                          {matchCount}/{chips.length || matchCount}
                        </Text>
                      </View>
                    </View>
                    {recipe.source ? (
                      <Text style={styles.resultSource}>📖 {recipe.source}</Text>
                    ) : null}
                    <View style={styles.matchedChips}>
                      {matchedTerms.map((t) => (
                        <View key={t} style={styles.matchedChip}>
                          <Ionicons name="checkmark" size={11} color={Colors.accent} />
                          <Text style={styles.matchedChipText}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  </Pressable>
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingTop: 60, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm,
  },
  backBtn: { padding: 4 },
  headerTitle: { ...Typography.h1, fontSize: 22 },

  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md, paddingBottom: 60, gap: Spacing.md },

  instructions: {
    ...Typography.body, color: Colors.textMuted, lineHeight: 22,
  },

  inputRow: { flexDirection: 'row', gap: Spacing.sm },
  input: {
    flex: 1, backgroundColor: Colors.white, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 11,
    fontSize: 15, color: Colors.text,
  },
  addBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.sm,
    paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center',
  },
  addBtnDisabled: { opacity: 0.4 },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.white, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.primary,
    paddingVertical: 5, paddingHorizontal: 12,
  },
  chipText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },

  btnRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  searchBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 13,
  },
  searchBtnDisabled: { opacity: 0.45 },
  searchBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  clearBtn: { paddingVertical: 13, paddingHorizontal: 4 },
  clearBtnText: { color: Colors.textMuted, fontSize: 14, fontWeight: '600' },

  results: { gap: Spacing.sm },
  resultsLabel: { ...Typography.label },

  resultCard: {
    backgroundColor: Colors.white, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: 6,
  },
  resultTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  resultTitle: { ...Typography.h3, flex: 1, fontSize: 15 },
  resultSource: { ...Typography.small, color: Colors.textMuted },

  matchBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: Radius.full, paddingVertical: 3, paddingHorizontal: 8,
  },
  matchBadgeFull:    { backgroundColor: Colors.accent },
  matchBadgePartial: { backgroundColor: Colors.primary },
  matchBadgeText: { color: Colors.white, fontWeight: '700', fontSize: 12 },

  matchedChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  matchedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.chip, borderRadius: Radius.full,
    paddingVertical: 2, paddingHorizontal: 8,
  },
  matchedChipText: { fontSize: 12, color: Colors.text, fontWeight: '600' },

  noResults: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl },
  noResultsTitle: { ...Typography.h3, color: Colors.textMuted },
  noResultsBody:  { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
});
