import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { RecipeTag, RecipeType } from '@/lib/types';
import { Colors, Spacing, Radius, Typography } from '@/lib/theme';

// ─── All available tags ───────────────────────────────────────────────────────

export const ALL_TAGS: RecipeTag[] = [
  'baking', 'cooking', 'savory', 'sweet', 'hot', 'cold',
  'breakfast', 'lunch', 'dinner', 'dessert', 'snacks',
  'vegetarian', 'family favourite', 'quick', 'freezer-friendly',
];

export const ALL_TYPES: { value: RecipeType; label: string }[] = [
  { value: 'main',     label: 'Main' },
  { value: 'dessert',  label: 'Dessert' },
  { value: 'snack',    label: 'Snack' },
  { value: 'side',     label: 'Side' },
  { value: 'drink',    label: 'Drink' },
  { value: 'airfryer', label: 'Air Fryer' },
  { value: 'other',    label: 'Other' },
];

// ─── Tag Picker ───────────────────────────────────────────────────────────────

interface TagPickerProps {
  selected: RecipeTag[];
  onChange: (tags: RecipeTag[]) => void;
}

export function TagPicker({ selected, onChange }: TagPickerProps) {
  const toggle = (tag: RecipeTag) => {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag));
    } else {
      onChange([...selected, tag]);
    }
  };

  return (
    <View>
      <Text style={styles.label}>Tags</Text>
      <View style={styles.wrap}>
        {ALL_TAGS.map((tag) => {
          const active = selected.includes(tag);
          return (
            <Pressable
              key={tag}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => toggle(tag)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {tag}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Type Picker ──────────────────────────────────────────────────────────────

interface TypePickerProps {
  value: RecipeType;
  onChange: (type: RecipeType) => void;
}

export function TypePicker({ value, onChange }: TypePickerProps) {
  return (
    <View>
      <Text style={styles.label}>Recipe Type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {ALL_TYPES.map(({ value: v, label }) => {
          const active = value === v;
          return (
            <Pressable
              key={v}
              style={[styles.chip, active && styles.chipActive, styles.typeChip]}
              onPress={() => onChange(v)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...Typography.label,
    marginBottom: Spacing.sm,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: Spacing.xs,
  },
  chip: {
    backgroundColor: Colors.chip,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeChip: {
    minWidth: 70,
    alignItems: 'center',
  },
  chipText: {
    fontSize: 13,
    color: Colors.chipText,
    fontWeight: '600',
  },
  chipTextActive: {
    color: Colors.white,
  },
});
