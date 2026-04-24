import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput } from 'react-native';
import { RecipeTag, RecipeType } from '@/lib/types';
import { Colors, Spacing, Radius, Typography } from '@/lib/theme';

// ─── All available tags ───────────────────────────────────────────────────────

export const ALL_TAGS: RecipeTag[] = [
  'baking', 'cooking', 'savory', 'sweet', 'hot', 'cold',
  'breakfast', 'lunch', 'dinner', 'dessert', 'snacks',
  'vegetarian', 'family favourite', 'quick', 'freezer-friendly',
];

export const PRESET_TYPES: { value: string; label: string }[] = [
  { value: 'main',     label: 'Main' },
  { value: 'dessert',  label: 'Dessert' },
  { value: 'snack',    label: 'Snack' },
  { value: 'side',     label: 'Side' },
  { value: 'drink',    label: 'Drink' },
  { value: 'airfryer', label: 'Air Fryer' },
  { value: 'bbq',      label: 'BBQ' },
  { value: 'soup',     label: 'Soup' },
  { value: 'baking',   label: 'Baking' },
  { value: 'pasta',    label: 'Pasta' },
  { value: 'other',    label: 'Other' },
];

// Keep for backwards compatibility
export const ALL_TYPES = PRESET_TYPES;

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
  const isPreset = PRESET_TYPES.some((t) => t.value === value);
  const [showCustom, setShowCustom] = useState(!isPreset && !!value);
  const [customText, setCustomText] = useState(!isPreset && value ? value : '');

  const handlePresetSelect = (v: string) => {
    setShowCustom(false);
    setCustomText('');
    onChange(v as RecipeType);
  };

  const handleCustomChange = (text: string) => {
    setCustomText(text);
    if (text.trim()) onChange(text.trim() as RecipeType);
  };

  const handleCustomToggle = () => {
    setShowCustom(true);
    onChange('' as RecipeType);
  };

  return (
    <View style={styles.typePickerWrap}>
      <Text style={styles.label}>Recipe Type</Text>

      {/* Preset chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {PRESET_TYPES.map(({ value: v, label }) => {
          const active = !showCustom && value === v;
          return (
            <Pressable
              key={v}
              style={[styles.chip, active && styles.chipActive, styles.typeChip]}
              onPress={() => handlePresetSelect(v)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}

        {/* Custom chip */}
        <Pressable
          style={[styles.chip, showCustom && styles.chipActive, styles.typeChip]}
          onPress={handleCustomToggle}
        >
          <Text style={[styles.chipText, showCustom && styles.chipTextActive]}>
            + Custom
          </Text>
        </Pressable>
      </ScrollView>

      {/* Custom text input */}
      {showCustom && (
        <TextInput
          style={styles.customInput}
          value={customText}
          onChangeText={handleCustomChange}
          placeholder="e.g. BBQ, Slow Cooker, Wok…"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...Typography.label,
    marginBottom: Spacing.sm,
  },
  typePickerWrap: {
    gap: Spacing.sm,
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
  customInput: {
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
  },
});
