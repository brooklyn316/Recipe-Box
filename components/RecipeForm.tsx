import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable,
  StyleSheet, Alert, Image, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Recipe, RecipeDraft, RecipeTag, RecipeType } from '@/lib/types';
import { TagPicker, TypePicker } from './TagPicker';
import { Colors, Spacing, Radius, Typography } from '@/lib/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FormValues = {
  title: string;
  source: string;
  type: RecipeType;
  servings: string;
  prepTime: string;
  cookTime: string;
  ingredients: string[];
  method: string[];
  notes: string;
  tags: RecipeTag[];
  originalImageUri: string | null;
  isFavourite: boolean;
};

interface Props {
  initialValues: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
  submitLabel?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RecipeForm({ initialValues, onSubmit, submitLabel = 'Save Recipe' }: Props) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  // ── Ingredients ─────────────────────────────────────────────────────────────

  const updateIngredient = (idx: number, text: string) => {
    const next = [...values.ingredients];
    next[idx] = text;
    set('ingredients', next);
  };

  const addIngredient = () => set('ingredients', [...values.ingredients, '']);

  const removeIngredient = (idx: number) =>
    set('ingredients', values.ingredients.filter((_, i) => i !== idx));

  // ── Method ──────────────────────────────────────────────────────────────────

  const updateStep = (idx: number, text: string) => {
    const next = [...values.method];
    next[idx] = text;
    set('method', next);
  };

  const addStep = () => set('method', [...values.method, '']);

  const removeStep = (idx: number) =>
    set('method', values.method.filter((_, i) => i !== idx));

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!values.title.trim()) {
      Alert.alert('Missing Title', 'Please add a recipe title.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit(values);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {/* Photo */}
      {values.originalImageUri && (
        <View style={styles.photoSection}>
          <Image source={{ uri: values.originalImageUri }} style={styles.photo} resizeMode="cover" />
          <Pressable style={styles.removePhoto} onPress={() => set('originalImageUri', null)}>
            <Ionicons name="close-circle" size={24} color={Colors.danger} />
          </Pressable>
        </View>
      )}

      {/* Title */}
      <Field label="Recipe Title *">
        <TextInput
          style={[styles.input, styles.inputLarge]}
          value={values.title}
          onChangeText={(t) => set('title', t)}
          placeholder="e.g. Mum's Lemon Slice"
          placeholderTextColor={Colors.textMuted}
        />
      </Field>

      {/* Source */}
      <Field label="Source">
        <TextInput
          style={styles.input}
          value={values.source}
          onChangeText={(t) => set('source', t)}
          placeholder="e.g. Edmonds Cookbook p.48, Magazine clipping"
          placeholderTextColor={Colors.textMuted}
        />
      </Field>

      {/* Type */}
      <View style={styles.section}>
        <TypePicker value={values.type} onChange={(t) => set('type', t)} />
      </View>

      {/* Servings / Times row */}
      <View style={styles.row3}>
        <Field label="Servings" style={styles.flex1}>
          <TextInput
            style={styles.input}
            value={values.servings}
            onChangeText={(t) => set('servings', t)}
            placeholder="4"
            placeholderTextColor={Colors.textMuted}
          />
        </Field>
        <Field label="Prep Time" style={styles.flex1}>
          <TextInput
            style={styles.input}
            value={values.prepTime}
            onChangeText={(t) => set('prepTime', t)}
            placeholder="15 min"
            placeholderTextColor={Colors.textMuted}
          />
        </Field>
        <Field label="Cook Time" style={styles.flex1}>
          <TextInput
            style={styles.input}
            value={values.cookTime}
            onChangeText={(t) => set('cookTime', t)}
            placeholder="45 min"
            placeholderTextColor={Colors.textMuted}
          />
        </Field>
      </View>

      {/* Ingredients */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ingredients</Text>
        {values.ingredients.map((ing, idx) => (
          <View key={idx} style={styles.listRow}>
            <Text style={styles.bullet}>•</Text>
            <TextInput
              style={[styles.input, styles.listInput]}
              value={ing}
              onChangeText={(t) => updateIngredient(idx, t)}
              placeholder={`Ingredient ${idx + 1}`}
              placeholderTextColor={Colors.textMuted}
              multiline
            />
            <Pressable onPress={() => removeIngredient(idx)} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
            </Pressable>
          </View>
        ))}
        <Pressable style={styles.addBtn} onPress={addIngredient}>
          <Ionicons name="add-circle-outline" size={18} color={Colors.accent} />
          <Text style={styles.addBtnText}>Add ingredient</Text>
        </Pressable>
      </View>

      {/* Method */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Method</Text>
        {values.method.map((step, idx) => (
          <View key={idx} style={styles.listRow}>
            <Text style={styles.stepNum}>{idx + 1}.</Text>
            <TextInput
              style={[styles.input, styles.listInput]}
              value={step}
              onChangeText={(t) => updateStep(idx, t)}
              placeholder={`Step ${idx + 1}`}
              placeholderTextColor={Colors.textMuted}
              multiline
            />
            <Pressable onPress={() => removeStep(idx)} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
            </Pressable>
          </View>
        ))}
        <Pressable style={styles.addBtn} onPress={addStep}>
          <Ionicons name="add-circle-outline" size={18} color={Colors.accent} />
          <Text style={styles.addBtnText}>Add step</Text>
        </Pressable>
      </View>

      {/* Notes */}
      <Field label="Notes">
        <TextInput
          style={[styles.input, styles.inputMulti]}
          value={values.notes}
          onChangeText={(t) => set('notes', t)}
          placeholder="Any extra tips, substitutions, storage notes…"
          placeholderTextColor={Colors.textMuted}
          multiline
          numberOfLines={3}
        />
      </Field>

      {/* Tags */}
      <View style={styles.section}>
        <TagPicker selected={values.tags} onChange={(tags) => set('tags', tags)} />
      </View>

      {/* Favourite toggle */}
      <Pressable
        style={styles.favRow}
        onPress={() => set('isFavourite', !values.isFavourite)}
      >
        <Ionicons
          name={values.isFavourite ? 'heart' : 'heart-outline'}
          size={22}
          color={values.isFavourite ? Colors.primary : Colors.textMuted}
        />
        <Text style={styles.favText}>Mark as Family Favourite</Text>
      </Pressable>

      {/* Submit */}
      <Pressable
        style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <>
            <Ionicons name="checkmark-circle-outline" size={20} color={Colors.white} />
            <Text style={styles.submitText}>{submitLabel}</Text>
          </>
        )}
      </Pressable>

      <View style={{ height: Spacing.xxl }} />
    </ScrollView>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { padding: Spacing.md, gap: Spacing.sm },
  section: { marginVertical: Spacing.sm },
  sectionTitle: { ...Typography.h3, marginBottom: Spacing.sm },

  photoSection: { position: 'relative', borderRadius: Radius.md, overflow: 'hidden', marginBottom: Spacing.sm },
  photo: { width: '100%', height: 200 },
  removePhoto: { position: 'absolute', top: 8, right: 8, backgroundColor: Colors.white, borderRadius: Radius.full },

  field: { gap: Spacing.xs },
  fieldLabel: { ...Typography.label },

  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
  },
  inputLarge: { fontSize: 17, fontWeight: '600' },
  inputMulti: { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 },

  row3: { flexDirection: 'row', gap: Spacing.sm },
  flex1: { flex: 1 },

  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.sm },
  bullet: { fontSize: 18, color: Colors.primary, marginTop: 8, width: 16 },
  stepNum: { fontSize: 14, fontWeight: '700', color: Colors.primary, marginTop: 10, width: 20 },
  listInput: { flex: 1 },

  addBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.xs },
  addBtnText: { fontSize: 14, color: Colors.accent, fontWeight: '600' },

  favRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  favText: { fontSize: 15, color: Colors.text },

  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { fontSize: 16, fontWeight: '700', color: Colors.white },
});
