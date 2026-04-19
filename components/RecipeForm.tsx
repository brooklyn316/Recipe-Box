import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable,
  StyleSheet, Alert, Image, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Recipe, RecipeDraft, RecipeTag, RecipeType } from '@/lib/types';
import { TagPicker, TypePicker } from './TagPicker';
import { Colors, Spacing, Radius, Typography } from '@/lib/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FormValues = {
  title: string;
  source: string;
  pageNumber: string;
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
  screenTitle?: string;
}

// ─── Compress & save helper ───────────────────────────────────────────────────

async function saveDishPhoto(uri: string): Promise<string> {
  // Resize to max 1200px wide, 80% JPEG quality — looks great, keeps size ~150–350 KB
  const processed = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1200 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  );
  const dir = FileSystem.documentDirectory + 'recipe-photos/';
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const dest = dir + `dish-${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: processed.uri, to: dest });
  return dest;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RecipeForm({ initialValues, onSubmit, submitLabel = 'Save Recipe', screenTitle }: Props) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [saving, setSaving] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);

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

  // ── Dish photo — camera ────────────────────────────────────────────────────
  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera Permission', 'Please allow camera access in Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      await applyPhoto(result.assets[0].uri);
    }
  };

  // ── Dish photo — gallery ───────────────────────────────────────────────────
  const handleGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      await applyPhoto(result.assets[0].uri);
    }
  };

  const applyPhoto = async (uri: string) => {
    setPhotoLoading(true);
    try {
      const dest = await saveDishPhoto(uri);
      set('originalImageUri', dest);
    } finally {
      setPhotoLoading(false);
    }
  };

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
    <View style={styles.screen}>
      {/* Header with back button */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={26} color={Colors.text} />
        </Pressable>
        {screenTitle ? <Text style={styles.headerTitle}>{screenTitle}</Text> : <View />}
        <View style={{ width: 34 }} />
      </View>

    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {/* Dish photo */}
      {values.originalImageUri ? (
        <View style={styles.photoSection}>
          <Image source={{ uri: values.originalImageUri }} style={styles.photo} resizeMode="cover" />
          <Pressable style={styles.removePhoto} onPress={() => set('originalImageUri', null)}>
            <Ionicons name="close-circle" size={24} color={Colors.danger} />
          </Pressable>
          <View style={styles.changePhotoRow}>
            <Pressable style={styles.changePhotoBtn} onPress={handleCamera}>
              <Ionicons name="camera-outline" size={15} color={Colors.white} />
              <Text style={styles.changePhotoBtnText}>Retake</Text>
            </Pressable>
            <Pressable style={styles.changePhotoBtn} onPress={handleGallery}>
              <Ionicons name="images-outline" size={15} color={Colors.white} />
              <Text style={styles.changePhotoBtnText}>Change</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.addPhotoCard}>
          <Text style={styles.addPhotoLabel}>Dish Photo <Text style={styles.addPhotoOptional}>(optional)</Text></Text>
          <Text style={styles.addPhotoHint}>Add a photo of the finished dish so it's easy to browse your recipes.</Text>
          {photoLoading ? (
            <View style={styles.photoLoadingBox}>
              <ActivityIndicator color={Colors.accent} />
              <Text style={styles.photoLoadingText}>Saving photo…</Text>
            </View>
          ) : (
            <View style={styles.addPhotoBtnRow}>
              <Pressable style={styles.addPhotoBtn} onPress={handleCamera}>
                <Ionicons name="camera" size={20} color={Colors.white} />
                <Text style={styles.addPhotoBtnText}>Take Photo</Text>
              </Pressable>
              <Pressable style={[styles.addPhotoBtn, styles.addPhotoBtnSecondary]} onPress={handleGallery}>
                <Ionicons name="images-outline" size={20} color={Colors.primary} />
                <Text style={[styles.addPhotoBtnText, styles.addPhotoBtnTextSecondary]}>Gallery</Text>
              </Pressable>
            </View>
          )}
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

      {/* Source + Page Number */}
      <View style={styles.sourceRow}>
        <Field label="Book / Source" style={styles.sourceField}>
          <TextInput
            style={[styles.input, !values.source && styles.inputAttention]}
            value={values.source}
            onChangeText={(t) => set('source', t)}
            placeholder="e.g. Edmonds Cookbook"
            placeholderTextColor={!values.source ? Colors.warning : Colors.textMuted}
          />
        </Field>
        <Field label="Page No." style={styles.pageField}>
          <TextInput
            style={[styles.input, !values.pageNumber && styles.inputAttention]}
            value={values.pageNumber}
            onChangeText={(t) => set('pageNumber', t)}
            placeholder="e.g. 48"
            placeholderTextColor={!values.pageNumber ? Colors.warning : Colors.textMuted}
            keyboardType="number-pad"
          />
        </Field>
      </View>

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
            style={[styles.input, !values.prepTime && styles.inputAttention]}
            value={values.prepTime}
            onChangeText={(t) => set('prepTime', t)}
            placeholder="e.g. 20 min"
            placeholderTextColor={!values.prepTime ? Colors.warning : Colors.textMuted}
          />
        </Field>
        <Field label="Cook Time" style={styles.flex1}>
          <TextInput
            style={[styles.input, !values.cookTime && styles.inputAttention]}
            value={values.cookTime}
            onChangeText={(t) => set('cookTime', t)}
            placeholder="e.g. 45 min"
            placeholderTextColor={!values.cookTime ? Colors.warning : Colors.textMuted}
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
    </View>
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
  screen: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingTop: 56, paddingBottom: Spacing.sm,
    backgroundColor: Colors.background,
  },
  backBtn: { padding: 4 },
  headerTitle: { ...Typography.h3, flex: 1, textAlign: 'center' },
  scroll: { flex: 1 },
  container: { padding: Spacing.md, gap: Spacing.sm },
  section: { marginVertical: Spacing.sm },
  sectionTitle: { ...Typography.h3, marginBottom: Spacing.sm },

  // ── Dish photo ──
  photoSection: { borderRadius: Radius.md, overflow: 'hidden', marginBottom: Spacing.sm },
  photo: { width: '100%', height: 200 },
  removePhoto: { position: 'absolute', top: 8, right: 8, backgroundColor: Colors.white, borderRadius: Radius.full },
  changePhotoRow: {
    position: 'absolute', bottom: 8, right: 8,
    flexDirection: 'row', gap: 6,
  },
  changePhotoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  changePhotoBtnText: { fontSize: 12, fontWeight: '700', color: Colors.white },

  addPhotoCard: {
    backgroundColor: Colors.white, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.sm,
  },
  addPhotoLabel: { ...Typography.label },
  addPhotoOptional: { fontWeight: '400', color: Colors.textMuted },
  addPhotoHint: { ...Typography.small, color: Colors.textMuted, lineHeight: 18 },
  addPhotoBtnRow: { flexDirection: 'row', gap: Spacing.sm },
  addPhotoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.primary, borderRadius: Radius.sm, paddingVertical: 11,
  },
  addPhotoBtnSecondary: {
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.primary,
  },
  addPhotoBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },
  addPhotoBtnTextSecondary: { color: Colors.primary },
  photoLoadingBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10 },
  photoLoadingText: { fontSize: 14, color: Colors.textMuted },

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
  inputAttention: { borderColor: Colors.warning, borderWidth: 1.5, backgroundColor: '#FFF9EE' },
  inputMulti: { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 },

  sourceRow: { flexDirection: 'row', gap: Spacing.sm },
  sourceField: { flex: 3 },
  pageField: { flex: 1 },
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
