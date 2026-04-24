import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { parseRecipeFile } from '@/lib/share';
import { insertRecipe } from '@/lib/db';
import { RecipeInput } from '@/lib/types';
import { Colors, Spacing, Radius, Typography } from '@/lib/theme';

export default function ImportRecipeScreen() {
  const { fileUri } = useLocalSearchParams<{ fileUri: string }>();
  const [recipe, setRecipe]   = useState<RecipeInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (!fileUri) { setLoading(false); return; }
    parseRecipeFile(decodeURIComponent(fileUri))
      .then((r) => { setRecipe(r); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, [fileUri]);

  const handleSave = async () => {
    if (!recipe) return;
    setSaving(true);
    try {
      const id = await insertRecipe(recipe);
      Alert.alert(
        '🎉 Recipe saved!',
        `"${recipe.title}" has been added to your Recipe Box.`,
        [{ text: 'View Recipe', onPress: () => router.replace(`/recipe/${id}`) }],
      );
    } catch (err) {
      Alert.alert('Error', 'Could not save the recipe. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centred}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Reading recipe…</Text>
      </View>
    );
  }

  if (!recipe) {
    return (
      <View style={styles.centred}>
        <Ionicons name="alert-circle-outline" size={64} color={Colors.danger} />
        <Text style={styles.errorTitle}>Couldn't read recipe</Text>
        <Text style={styles.errorBody}>This file doesn't look like a valid Recipe Box file.</Text>
        <Pressable style={styles.backBtn} onPress={() => router.replace('/')}>
          <Text style={styles.backBtnText}>Go to Recipe Box</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badge}>
          <Ionicons name="share-outline" size={16} color={Colors.primary} />
          <Text style={styles.badgeText}>Shared Recipe</Text>
        </View>
        <Text style={styles.title}>{recipe.title}</Text>
        {recipe.source ? (
          <Text style={styles.source}>From: {recipe.source}</Text>
        ) : null}
      </View>

      {/* Quick info */}
      <View style={styles.infoRow}>
        {recipe.prepTime ? (
          <View style={styles.infoChip}>
            <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.infoText}>Prep {recipe.prepTime}</Text>
          </View>
        ) : null}
        {recipe.cookTime ? (
          <View style={styles.infoChip}>
            <Ionicons name="flame-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.infoText}>Cook {recipe.cookTime}</Text>
          </View>
        ) : null}
        {recipe.servings ? (
          <View style={styles.infoChip}>
            <Ionicons name="people-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.infoText}>Serves {recipe.servings}</Text>
          </View>
        ) : null}
      </View>

      {/* Ingredients */}
      {recipe.ingredients.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ingredients</Text>
          {recipe.ingredients.map((ing, i) => (
            <View key={i} style={styles.listRow}>
              <View style={styles.bullet} />
              <Text style={styles.listText}>{ing}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Method */}
      {recipe.method.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Method</Text>
          {recipe.method.map((step, i) => (
            <View key={i} style={styles.listRow}>
              <Text style={styles.stepNum}>{i + 1}</Text>
              <Text style={styles.listText}>{step}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Notes */}
      {recipe.notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.listText}>{recipe.notes}</Text>
        </View>
      ) : null}

      {/* Actions */}
      <Pressable
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color={Colors.white} size="small" />
          : <>
              <Ionicons name="checkmark-circle-outline" size={22} color={Colors.white} />
              <Text style={styles.saveBtnText}>Save to My Recipe Box</Text>
            </>
        }
      </Pressable>

      <Pressable style={styles.dismissBtn} onPress={() => router.replace('/')}>
        <Text style={styles.dismissText}>Not now</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:  { flex: 1, backgroundColor: Colors.background },
  container: { padding: Spacing.md, paddingTop: 60, paddingBottom: 60, gap: Spacing.md },
  centred: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },

  header: { gap: 6 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.accentLight, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  title:  { ...Typography.h1 },
  source: { fontSize: 13, color: Colors.textMuted },

  infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  infoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.card, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: Colors.border,
  },
  infoText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },

  section: { gap: 8 },
  sectionTitle: { ...Typography.label },
  listRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary, marginTop: 7 },
  stepNum: { fontSize: 13, fontWeight: '700', color: Colors.primary, width: 20, marginTop: 1 },
  listText: { flex: 1, fontSize: 14, color: Colors.text, lineHeight: 22 },

  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 15, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 10, marginTop: Spacing.sm,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: Colors.white },

  dismissBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  dismissText: { fontSize: 14, color: Colors.textMuted },

  loadingText: { ...Typography.body, color: Colors.textMuted, marginTop: Spacing.md },
  errorTitle: { ...Typography.h2, textAlign: 'center' },
  errorBody:  { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
  backBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 12, paddingHorizontal: 24, marginTop: 8,
  },
  backBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});
