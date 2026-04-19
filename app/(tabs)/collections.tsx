import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, TextInput,
  StyleSheet, Alert, Modal,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getCollections, createCollection, deleteCollection, renameCollection,
  getCollectionRecipes, Collection,
} from '@/lib/db';
import { Recipe } from '@/lib/types';
import { RecipeCard } from '@/components/RecipeCard';
import { Colors, Spacing, Radius, Typography } from '@/lib/theme';

export default function CollectionsScreen() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [newName, setNewName]         = useState('');
  const [open, setOpen]               = useState<Collection | null>(null);
  const [openRecipes, setOpenRecipes] = useState<Recipe[]>([]);

  const load = useCallback(async () => {
    setCollections(await getCollections());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    await createCollection(name);
    setNewName('');
    await load();
  };

  const handleDelete = (col: Collection) => {
    Alert.alert(`Delete "${col.name}"?`, 'This removes the collection but keeps the recipes.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteCollection(col.id);
        await load();
      }},
    ]);
  };

  const handleRename = (col: Collection) => {
    Alert.prompt('Rename Collection', 'Enter a new name:', async (name) => {
      if (name?.trim()) { await renameCollection(col.id, name.trim()); await load(); }
    }, 'plain-text', col.name);
  };

  const handleOpen = async (col: Collection) => {
    const recipes = await getCollectionRecipes(col.id);
    setOpenRecipes(recipes);
    setOpen(col);
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📁  Collections</Text>
      </View>

      {/* New collection input */}
      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          value={newName}
          onChangeText={setNewName}
          placeholder="New collection name…"
          placeholderTextColor={Colors.textMuted}
          returnKeyType="done"
          onSubmitEditing={handleCreate}
        />
        <Pressable
          style={[styles.addBtn, !newName.trim() && styles.addBtnDisabled]}
          onPress={handleCreate}
          disabled={!newName.trim()}
        >
          <Ionicons name="add" size={22} color={Colors.white} />
        </Pressable>
      </View>

      {collections.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="folder-open-outline" size={64} color={Colors.border} />
          <Text style={styles.emptyTitle}>No collections yet</Text>
          <Text style={styles.emptyHint}>
            Create a collection above, then add recipes to it from any recipe page.
          </Text>
        </View>
      ) : (
        <FlatList
          data={collections}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item: col }) => (
            <Pressable style={styles.collectionRow} onPress={() => handleOpen(col)}>
              <View style={styles.folderIcon}>
                <Ionicons name="folder" size={32} color={Colors.primary} />
              </View>
              <View style={styles.colInfo}>
                <Text style={styles.colName}>{col.name}</Text>
                <Text style={styles.colCount}>
                  {col.recipeCount === 1 ? '1 recipe' : `${col.recipeCount} recipes`}
                </Text>
              </View>
              <View style={styles.colActions}>
                <Pressable onPress={() => handleRename(col)} hitSlop={10}>
                  <Ionicons name="pencil-outline" size={20} color={Colors.textMuted} />
                </Pressable>
                <Pressable onPress={() => handleDelete(col)} hitSlop={10}>
                  <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                </Pressable>
                <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
              </View>
            </Pressable>
          )}
        />
      )}

      {/* Collection detail modal */}
      <Modal
        visible={!!open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(null)}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{open?.name}</Text>
            <Pressable onPress={() => setOpen(null)} hitSlop={12}>
              <Ionicons name="close" size={26} color={Colors.text} />
            </Pressable>
          </View>
          {openRecipes.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyHint}>No recipes in this collection yet.</Text>
            </View>
          ) : (
            <FlatList
              data={openRecipes}
              keyExtractor={(r) => String(r.id)}
              contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
              renderItem={({ item }) => (
                <RecipeCard
                  recipe={item}
                  onPress={() => { setOpen(null); router.push(`/recipe/${item.id}`); }}
                />
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },

  header: {
    paddingHorizontal: Spacing.md, paddingTop: 60, paddingBottom: Spacing.sm,
  },
  headerTitle: { ...Typography.h1, fontSize: 22 },

  addRow: {
    flexDirection: 'row', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm,
  },
  addInput: {
    flex: 1, backgroundColor: Colors.white, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: 15, color: Colors.text,
  },
  addBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.sm,
    paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center',
  },
  addBtnDisabled: { opacity: 0.4 },

  list: { paddingHorizontal: Spacing.md, paddingBottom: 40, gap: Spacing.sm },

  collectionRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md,
  },
  folderIcon: { width: 44, alignItems: 'center' },
  colInfo: { flex: 1 },
  colName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  colCount: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  colActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.xl },
  emptyTitle: { ...Typography.h2, color: Colors.textMuted },
  emptyHint: { ...Typography.body, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },

  modal: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingTop: 20, paddingBottom: Spacing.sm,
    borderBottomWidth: 1, borderColor: Colors.border,
  },
  modalTitle: { ...Typography.h2 },
});
