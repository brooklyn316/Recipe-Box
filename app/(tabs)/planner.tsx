import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Modal, FlatList, Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getMealPlanWeek, setMealPlan, removeMealPlan,
  getAllRecipes, addToShoppingList, MealPlanEntry,
} from '@/lib/db';
import { Recipe } from '@/lib/types';
import { RecipeCard } from '@/components/RecipeCard';
import { Colors, Spacing, Radius, Typography } from '@/lib/theme';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  r.setDate(r.getDate() + diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlannerScreen() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [entries, setEntries]     = useState<MealPlanEntry[]>([]);
  const [picking, setPicking]     = useState<{ dateStr: string; dayName: string } | null>(null);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd   = weekDates[6];

  const load = useCallback(async () => {
    const plan = await getMealPlanWeek(toDateStr(weekStart), toDateStr(weekEnd));
    setEntries(plan);
  }, [weekStart]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const prevWeek = () => setWeekStart((d) => addDays(d, -7));
  const nextWeek = () => setWeekStart((d) => addDays(d, 7));

  const isCurrentWeek = toDateStr(startOfWeek(new Date())) === toDateStr(weekStart);

  const getEntryForDate = (dateStr: string) =>
    entries.find((e) => e.dateStr === dateStr) ?? null;

  const handlePickRecipe = async (dateStr: string, dayName: string) => {
    const recipes = await getAllRecipes();
    setAllRecipes(recipes);
    setPicking({ dateStr, dayName });
  };

  const handleSelectRecipe = async (recipe: Recipe) => {
    if (!picking) return;
    await setMealPlan(picking.dateStr, 'dinner', recipe.id);
    setPicking(null);
    await load();
  };

  const handleRemove = (dateStr: string) => {
    Alert.alert('Remove meal?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await removeMealPlan(dateStr, 'dinner');
        await load();
      }},
    ]);
  };

  const handleShoppingList = async () => {
    const planned = entries.filter((e) => e.recipe);
    if (planned.length === 0) {
      Alert.alert('No meals planned', 'Add some meals to the week first.');
      return;
    }
    for (const entry of planned) {
      await addToShoppingList(entry.recipe.ingredients, entry.recipe.id, entry.recipe.title);
    }
    Alert.alert('Added to list!', `Ingredients from ${planned.length} meal${planned.length !== 1 ? 's' : ''} added to your shopping list.`);
  };

  const weekLabel = `${weekStart.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📅  Meal Planner</Text>
        <Pressable style={styles.shoppingBtn} onPress={handleShoppingList}>
          <Ionicons name="cart-outline" size={16} color={Colors.white} />
          <Text style={styles.shoppingBtnText}>Add week to list</Text>
        </Pressable>
      </View>

      {/* Week navigation */}
      <View style={styles.weekNav}>
        <Pressable onPress={prevWeek} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </Pressable>
        <View style={styles.weekLabelWrap}>
          <Text style={styles.weekLabel}>{weekLabel}</Text>
          {isCurrentWeek && <Text style={styles.thisWeek}>This week</Text>}
        </View>
        <Pressable onPress={nextWeek} hitSlop={12}>
          <Ionicons name="chevron-forward" size={24} color={Colors.primary} />
        </Pressable>
      </View>

      {/* Day rows */}
      <ScrollView contentContainerStyle={styles.dayList}>
        {weekDates.map((date, i) => {
          const dateStr  = toDateStr(date);
          const entry    = getEntryForDate(dateStr);
          const isToday  = toDateStr(new Date()) === dateStr;

          return (
            <View key={dateStr} style={[styles.dayRow, isToday && styles.dayRowToday]}>
              {/* Day label */}
              <View style={styles.dayLabel}>
                <Text style={[styles.dayName, isToday && styles.dayNameToday]}>{DAY_NAMES[i]}</Text>
                <Text style={[styles.dayDate, isToday && styles.dayNameToday]}>
                  {date.getDate()}
                </Text>
              </View>

              {/* Meal slot */}
              {entry ? (
                <Pressable
                  style={styles.mealFilled}
                  onLongPress={() => handleRemove(dateStr)}
                >
                  {entry.recipe.originalImageUri ? null : null}
                  <Text style={styles.mealTitle} numberOfLines={2}>{entry.recipe.title}</Text>
                  <Text style={styles.mealMeta}>
                    {entry.recipe.servings ? `Serves ${entry.recipe.servings}` : entry.recipe.type}
                  </Text>
                  <Text style={styles.mealHint}>Hold to remove</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={styles.mealEmpty}
                  onPress={() => handlePickRecipe(dateStr, FULL_DAYS[i])}
                >
                  <Ionicons name="add-circle-outline" size={20} color={Colors.textMuted} />
                  <Text style={styles.mealEmptyText}>Add dinner</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Recipe picker modal */}
      <Modal
        visible={!!picking}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPicking(null)}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Pick a recipe</Text>
            <Text style={styles.modalSub}>{picking?.dayName}</Text>
            <Pressable onPress={() => setPicking(null)} hitSlop={12}>
              <Ionicons name="close" size={26} color={Colors.text} />
            </Pressable>
          </View>
          <FlatList
            data={allRecipes}
            keyExtractor={(r) => String(r.id)}
            contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
            renderItem={({ item }) => (
              <RecipeCard recipe={item} onPress={() => handleSelectRecipe(item)} />
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingTop: 60, paddingBottom: Spacing.xs,
  },
  headerTitle: { ...Typography.h1, fontSize: 22 },
  shoppingBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  shoppingBtnText: { color: Colors.white, fontSize: 13, fontWeight: '700' },

  weekNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderColor: Colors.border,
  },
  weekLabelWrap: { alignItems: 'center' },
  weekLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  thisWeek: { fontSize: 11, color: Colors.primary, fontWeight: '600' },

  dayList: { padding: Spacing.md, gap: Spacing.sm },

  dayRow: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: Colors.white, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden', minHeight: 72,
  },
  dayRowToday: { borderColor: Colors.primary, borderWidth: 2 },

  dayLabel: {
    width: 52, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.background, padding: Spacing.sm, gap: 2,
    borderRightWidth: 1, borderColor: Colors.border,
  },
  dayName: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  dayDate: { fontSize: 18, fontWeight: '800', color: Colors.text },
  dayNameToday: { color: Colors.primary },

  mealEmpty: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: Spacing.md,
  },
  mealEmptyText: { fontSize: 14, color: Colors.textMuted },

  mealFilled: { flex: 1, padding: Spacing.md, justifyContent: 'center', gap: 2 },
  mealTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  mealMeta: { fontSize: 12, color: Colors.textMuted },
  mealHint: { fontSize: 10, color: Colors.border, marginTop: 2 },

  modal: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingTop: 20, paddingBottom: Spacing.sm,
    borderBottomWidth: 1, borderColor: Colors.border, flexWrap: 'wrap', gap: 4,
  },
  modalTitle: { ...Typography.h2, flex: 1 },
  modalSub: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
});
