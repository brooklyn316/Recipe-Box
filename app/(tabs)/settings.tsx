import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Alert, ActivityIndicator,
  Share, TextInput, ScrollView, Modal,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { getAllRecipes, insertRecipe, searchRecipes } from '@/lib/db';
import { Colors, Spacing, Radius, Typography } from '@/lib/theme';

// ─── Import helper ────────────────────────────────────────────────────────────

async function importFromJson(json: string): Promise<{ added: number; skipped: number }> {
  const data = JSON.parse(json);
  const recipes = Array.isArray(data) ? data : data.recipes;
  if (!Array.isArray(recipes)) throw new Error('Invalid backup format.');

  let added = 0;
  let skipped = 0;

  for (const r of recipes) {
    if (!r.title) continue;
    // Skip if a recipe with the same title already exists
    const existing = await searchRecipes(r.title);
    const duplicate = existing.some((e) => e.title.toLowerCase() === r.title.toLowerCase());
    if (duplicate) { skipped++; continue; }

    await insertRecipe({
      title:            r.title            ?? '',
      source:           r.source           ?? '',
      pageNumber:       r.pageNumber       ?? '',
      type:             r.type             ?? 'main',
      servings:         r.servings         ?? '',
      prepTime:         r.prepTime         ?? '',
      cookTime:         r.cookTime         ?? '',
      ingredients:      Array.isArray(r.ingredients) ? r.ingredients : [],
      method:           Array.isArray(r.method)      ? r.method      : [],
      notes:            r.notes            ?? '',
      tags:             Array.isArray(r.tags)        ? r.tags        : [],
      originalImageUri: null,   // images can't be transferred via JSON
      isFavourite:      r.isFavourite      ?? false,
      rating:           r.rating           ?? 0,
    });
    added++;
  }

  return { added, skipped };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const [exporting, setExporting]   = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting]   = useState(false);

  // ── Export ──────────────────────────────────────────────────────────────────

  const handleExport = async () => {
    setExporting(true);
    try {
      const recipes = await getAllRecipes();
      const json    = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), recipes }, null, 2);

      const path = FileSystem.documentDirectory + 'recipebox-backup.json';
      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });

      await Share.share(
        { message: json, title: 'Recipe Box Backup' },
        { dialogTitle: 'Save or send your recipe backup' }
      );
    } catch (e: any) {
      if (e.message !== 'User did not share') Alert.alert('Export failed', e.message);
    } finally {
      setExporting(false);
    }
  };

  // ── Import ──────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    const text = importText.trim();
    if (!text) return;
    setImporting(true);
    try {
      const { added, skipped } = await importFromJson(text);
      setShowImport(false);
      setImportText('');
      Alert.alert(
        'Import complete',
        `${added} recipe${added !== 1 ? 's' : ''} imported.` +
        (skipped > 0 ? `\n${skipped} skipped (already exist).` : '')
      );
    } catch (e: any) {
      Alert.alert('Import failed', e.message || 'Could not read the backup. Make sure you pasted the full JSON.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⚙️  Settings</Text>
      </View>

      {/* Data & Backup */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Data & Backup</Text>

        <Pressable style={styles.row} onPress={handleExport} disabled={exporting}>
          <View style={styles.rowIcon}>
            <Ionicons name="cloud-upload-outline" size={22} color={Colors.primary} />
          </View>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>Export all recipes</Text>
            <Text style={styles.rowSub}>Share a JSON backup — save to Files, email, AirDrop, etc.</Text>
          </View>
          {exporting
            ? <ActivityIndicator color={Colors.primary} />
            : <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />}
        </Pressable>

        <View style={styles.rowGap} />

        <Pressable style={styles.row} onPress={() => setShowImport(true)}>
          <View style={styles.rowIcon}>
            <Ionicons name="cloud-download-outline" size={22} color={Colors.accent} />
          </View>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>Import backup</Text>
            <Text style={styles.rowSub}>Paste JSON from a previous export to restore recipes</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
        </Pressable>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.aboutCard}>
          <Text style={styles.appName}>Recipe Box</Text>
          <Text style={styles.aboutText}>
            A family cookbook app for keeping recipes safe and within reach — whether they come from a cherished old cookbook, a website, or your own kitchen experiments.
          </Text>
        </View>
      </View>

      {/* Import modal */}
      <Modal
        visible={showImport}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowImport(false)}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Import Backup</Text>
            <Pressable onPress={() => { setShowImport(false); setImportText(''); }} hitSlop={12}>
              <Ionicons name="close" size={26} color={Colors.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.importInstructions}>
              1. Open your backup file (e.g. from Files, email, or Notes){'\n'}
              2. Select all the text and copy it{'\n'}
              3. Paste it into the box below
            </Text>

            <TextInput
              style={styles.pasteBox}
              value={importText}
              onChangeText={setImportText}
              placeholder={'Paste your JSON backup here…\n\nIt should start with { "version": 1, …'}
              placeholderTextColor={Colors.textMuted}
              multiline
              autoCorrect={false}
              autoCapitalize="none"
            />

            <Pressable
              style={[styles.importBtn, (!importText.trim() || importing) && styles.importBtnDisabled]}
              onPress={handleImport}
              disabled={!importText.trim() || importing}
            >
              {importing
                ? <ActivityIndicator color={Colors.white} />
                : <>
                    <Ionicons name="checkmark-circle-outline" size={20} color={Colors.white} />
                    <Text style={styles.importBtnText}>Import Recipes</Text>
                  </>}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 60 },

  header: { paddingHorizontal: Spacing.md, paddingTop: 60, paddingBottom: Spacing.md },
  headerTitle: { ...Typography.h1, fontSize: 22 },

  section: { paddingHorizontal: Spacing.md, marginBottom: Spacing.lg },
  sectionLabel: { ...Typography.label, marginBottom: Spacing.sm },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  rowGap: { height: Spacing.sm },
  rowIcon: { width: 36, alignItems: 'center' },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  rowSub: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },

  aboutCard: {
    backgroundColor: Colors.white, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  appName: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  aboutText: { ...Typography.body, color: Colors.textMuted, lineHeight: 22 },

  modal: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingTop: 20, paddingBottom: Spacing.sm,
    borderBottomWidth: 1, borderColor: Colors.border,
  },
  modalTitle: { ...Typography.h2 },
  modalBody: { flex: 1, padding: Spacing.md },

  importInstructions: {
    ...Typography.body, color: Colors.textMuted, lineHeight: 24,
    backgroundColor: Colors.chip, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  pasteBox: {
    backgroundColor: Colors.white, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, fontSize: 13, color: Colors.text,
    minHeight: 220, textAlignVertical: 'top', fontFamily: 'monospace',
    marginBottom: Spacing.md,
  },
  importBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, marginBottom: 40,
  },
  importBtnDisabled: { opacity: 0.45 },
  importBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});
