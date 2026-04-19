import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, Image, Pressable,
  StyleSheet, Alert, Share, Modal, TextInput,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import {
  getRecipeById, deleteRecipe, toggleFavourite,
  logCook, getCookLog, CookEntry,
  addToShoppingList, getCollections, addRecipeToCollection,
  removeRecipeFromCollection, getRecipeCollectionIds, Collection,
  setRating,
} from '@/lib/db';
import { Recipe } from '@/lib/types';
import { Colors, Spacing, Radius, Typography } from '@/lib/theme';
import { UnitConverterModal } from '@/components/UnitConverterModal';
import { CookModeModal } from '@/components/CookModeModal';
import { TimerPanel } from '@/components/TimerPanel';
import { scaleIngredients, parseServingCount } from '@/lib/scaler';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCookDate(ts: number): string {
  const d = new Date(ts * 1000);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days} days ago`;
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recipe, setRecipe]               = useState<Recipe | null>(null);
  const [photoModal, setPhotoModal]       = useState(false);
  const [keepAwake, setKeepAwake]         = useState(false);
  const [converterVisible, setConverter]  = useState(false);
  const [cookMode, setCookMode]           = useState(false);
  const [showTimers, setShowTimers]       = useState(false);

  // Serving scaler
  const [servings, setServings]           = useState<number | null>(null);
  const [servingInput, setServingInput]   = useState('');
  const [editingServings, setEditingServings] = useState(false);

  // Cooking log
  const [cookLog, setCookLog]             = useState<CookEntry[]>([]);
  const [showLog, setShowLog]             = useState(false);
  const [logNote, setLogNote]             = useState('');

  // Collections
  const [collections, setCollections]         = useState<Collection[]>([]);
  const [recipeColIds, setRecipeColIds]       = useState<number[]>([]);
  const [showCollections, setShowCollections] = useState(false);

  // Ingredient checkboxes — UI only, resets on leave (used while cooking)
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());

  // Shopping list picker — separate from cooking checkboxes
  const [showShoppingPicker, setShowShoppingPicker] = useState(false);
  const [shoppingSelection, setShoppingSelection]   = useState<Set<number>>(new Set());

  const toggleIngredient = (idx: number) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const load = useCallback(async () => {
    if (!id) return;
    const r = await getRecipeById(Number(id));
    setRecipe(r);
    if (r) {
      const origCount = parseServingCount(r.servings);
      if (servings === null) setServings(origCount);
      const log = await getCookLog(Number(id));
      setCookLog(log);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!recipe) return null;

  const origServings  = parseServingCount(recipe.servings);
  const scaledServings = servings ?? origServings;
  const scaledIngredients = scaleIngredients(recipe.ingredients, origServings, scaledServings);

  // ── Keep awake ───────────────────────────────────────────────────────────────

  const handleKeepAwakeToggle = async () => {
    if (keepAwake) { deactivateKeepAwake(); setKeepAwake(false); }
    else { await activateKeepAwakeAsync(); setKeepAwake(true); }
  };

  // ── Delete / share / favourite ───────────────────────────────────────────────

  const handleDelete = () => {
    Alert.alert('Delete Recipe', `Are you sure you want to delete "${recipe.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteRecipe(recipe.id); router.back();
      }},
    ]);
  };

  const handleShare = async () => {
    const text = [
      `📖 ${recipe.title}`,
      recipe.source ? `Source: ${recipe.source}` : '',
      recipe.servings ? `Serves: ${recipe.servings}` : '',
      '',
      'INGREDIENTS',
      ...scaledIngredients.map((i) => `• ${i}`),
      '',
      'METHOD',
      ...recipe.method.map((s, i) => `${i + 1}. ${s}`),
      recipe.notes ? `\nNotes: ${recipe.notes}` : '',
    ].filter(Boolean).join('\n');
    await Share.share({ message: text, title: recipe.title });
  };

  const handleFav = async () => {
    await toggleFavourite(recipe.id); await load();
  };

  // ── Shopping list picker ─────────────────────────────────────────────────────

  const openShoppingPicker = () => {
    // Pre-select all ingredients by default
    setShoppingSelection(new Set(scaledIngredients.map((_, i) => i)));
    setShowShoppingPicker(true);
  };

  const toggleShoppingItem = (idx: number) => {
    setShoppingSelection((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const handleConfirmShoppingList = async () => {
    const selected = scaledIngredients.filter((_, i) => shoppingSelection.has(i));
    if (selected.length === 0) { setShowShoppingPicker(false); return; }
    await addToShoppingList(selected, recipe.id, recipe.title);
    setShowShoppingPicker(false);
    Alert.alert('Added!', `${selected.length} ingredient${selected.length !== 1 ? 's' : ''} added to your shopping list.`);
  };

  // ── Cooking log ──────────────────────────────────────────────────────────────

  const handleLogCook = async () => {
    await logCook(recipe.id, logNote.trim());
    setLogNote('');
    setShowLog(false);
    await load();
  };

  // ── Serving scaler ───────────────────────────────────────────────────────────

  const applyServings = () => {
    const n = parseInt(servingInput, 10);
    if (n > 0 && n <= 100) setServings(n);
    setEditingServings(false);
  };

  // ── Rating ───────────────────────────────────────────────────────────────────

  const handleRating = async (stars: number) => {
    // Tap same star again to clear rating
    const newRating = recipe.rating === stars ? 0 : stars;
    await setRating(recipe.id, newRating);
    await load();
  };

  // ── Collections ──────────────────────────────────────────────────────────────

  const handleOpenCollections = async () => {
    const cols   = await getCollections();
    const colIds = await getRecipeCollectionIds(recipe.id);
    setCollections(cols);
    setRecipeColIds(colIds);
    setShowCollections(true);
  };

  const handleToggleCollection = async (colId: number) => {
    if (recipeColIds.includes(colId)) {
      await removeRecipeFromCollection(colId, recipe.id);
      setRecipeColIds((prev) => prev.filter((id) => id !== colId));
    } else {
      await addRecipeToCollection(colId, recipe.id);
      setRecipeColIds((prev) => [...prev, colId]);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────

  const lastCooked = cookLog[0];

  return (
    <View style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={26} color={Colors.text} />
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable onPress={handleKeepAwakeToggle} hitSlop={10} style={[styles.awakeBtn, keepAwake && styles.awakeBtnActive]}>
            <Ionicons name={keepAwake ? 'sunny' : 'moon-outline'} size={18} color={keepAwake ? Colors.white : Colors.textMuted} />
          </Pressable>
          <Pressable onPress={() => setConverter(true)} hitSlop={10}>
            <Ionicons name="calculator-outline" size={24} color={Colors.textMuted} />
          </Pressable>
          <Pressable onPress={handleFav} hitSlop={10}>
            <Ionicons name={recipe.isFavourite ? 'heart' : 'heart-outline'} size={24} color={recipe.isFavourite ? Colors.primary : Colors.textMuted} />
          </Pressable>
          <Pressable onPress={handleShare} hitSlop={10}>
            <Ionicons name="share-outline" size={24} color={Colors.textMuted} />
          </Pressable>
          <Pressable onPress={() => router.push(`/recipe/edit/${recipe.id}`)} hitSlop={10}>
            <Ionicons name="create-outline" size={24} color={Colors.primary} />
          </Pressable>
          <Pressable onPress={handleDelete} hitSlop={10}>
            <Ionicons name="trash-outline" size={24} color={Colors.danger} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Dish photo */}
        {recipe.originalImageUri && (
          <Pressable onPress={() => setPhotoModal(true)} style={styles.photoWrapper}>
            <Image source={{ uri: recipe.originalImageUri }} style={styles.photo} resizeMode="cover" />
            <View style={styles.photoExpandHint}>
              <Ionicons name="expand-outline" size={14} color={Colors.white} />
              <Text style={styles.photoExpandText}>Tap to expand</Text>
            </View>
          </Pressable>
        )}

        {/* Title & meta */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>{recipe.title}</Text>
          {(recipe.source || recipe.pageNumber) && (
            <Text style={styles.source}>
              📖 {recipe.source}{recipe.source && recipe.pageNumber ? ` · p.${recipe.pageNumber}` : recipe.pageNumber ? `p.${recipe.pageNumber}` : ''}
            </Text>
          )}

          {/* Meta row with tappable servings scaler */}
          <View style={styles.metaRow}>
            {recipe.servings ? (
              <Pressable onPress={() => { setServingInput(String(scaledServings)); setEditingServings(true); }} style={styles.metaBadge}>
                <Ionicons name="people-outline" size={14} color={scaledServings !== origServings ? Colors.primary : Colors.textMuted} />
                {editingServings ? (
                  <TextInput
                    style={styles.servingsInput}
                    value={servingInput}
                    onChangeText={setServingInput}
                    keyboardType="number-pad"
                    autoFocus
                    onBlur={applyServings}
                    onSubmitEditing={applyServings}
                  />
                ) : (
                  <Text style={[styles.metaBadgeText, scaledServings !== origServings && styles.metaBadgeScaled]}>
                    Serves {scaledServings}
                    {scaledServings !== origServings ? ` (orig. ${origServings})` : ''}
                  </Text>
                )}
                <Ionicons name="pencil-outline" size={11} color={Colors.textMuted} />
              </Pressable>
            ) : null}
            <MetaBadge icon="time-outline"  text={`Prep  ${recipe.prepTime  || '—'}`} />
            <MetaBadge icon="flame-outline" text={`Cook  ${recipe.cookTime  || '—'}`} />
          </View>

          {scaledServings !== origServings && (
            <Pressable onPress={() => setServings(origServings)} style={styles.resetServings}>
              <Ionicons name="refresh-outline" size={13} color={Colors.primary} />
              <Text style={styles.resetServingsText}>Reset to original ({origServings})</Text>
            </Pressable>
          )}

          {/* Star rating */}
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable key={star} onPress={() => handleRating(star)} hitSlop={6}>
                <Ionicons
                  name={star <= (recipe.rating ?? 0) ? 'star' : 'star-outline'}
                  size={28}
                  color={star <= (recipe.rating ?? 0) ? '#F5A623' : Colors.border}
                />
              </Pressable>
            ))}
            {recipe.rating > 0 && (
              <Text style={styles.ratingLabel}>
                {recipe.rating === 5 ? '★ Top rated!' : `${recipe.rating} / 5`}
              </Text>
            )}
          </View>

          {recipe.tags.length > 0 && (
            <View style={styles.tags}>
              {recipe.tags.map((t) => (
                <View key={t} style={styles.chip}><Text style={styles.chipText}>{t}</Text></View>
              ))}
            </View>
          )}
        </View>

        {/* Action buttons row */}
        <View style={styles.actionRow}>
          <ActionBtn icon="walk-outline"    label="Cook Mode" onPress={() => setCookMode(true)} />
          <ActionBtn icon="cart-outline"    label="Add to List" onPress={openShoppingPicker} />
          <ActionBtn icon="timer-outline"   label="Timers" onPress={() => setShowTimers((v) => !v)} active={showTimers} />
          <ActionBtn icon="calendar-outline" label="Made it!" onPress={() => setShowLog(true)} />
          <ActionBtn icon="folder-outline"  label="Collections" onPress={handleOpenCollections} />
        </View>

        {/* Last cooked notice */}
        {lastCooked && (
          <View style={styles.lastCooked}>
            <Ionicons name="checkmark-circle-outline" size={16} color={Colors.accent} />
            <Text style={styles.lastCookedText}>
              Last made {formatCookDate(lastCooked.cookedAt)}
              {cookLog.length > 1 ? ` · ${cookLog.length} times total` : ''}
            </Text>
          </View>
        )}

        {/* Timers panel */}
        {showTimers && <TimerPanel />}

        {/* Ingredients with checkboxes */}
        {recipe.ingredients.length > 0 && (
          <Section
            title="Ingredients"
            action={checkedIngredients.size > 0 ? (
              <Pressable onPress={() => setCheckedIngredients(new Set())} hitSlop={8}>
                <Text style={styles.clearChecks}>Clear</Text>
              </Pressable>
            ) : undefined}
          >
            {scaledIngredients.map((ing, i) => {
              const checked = checkedIngredients.has(i);
              return (
                <Pressable key={i} style={styles.ingredientRow} onPress={() => toggleIngredient(i)}>
                  <Ionicons
                    name={checked ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={checked ? Colors.accent : Colors.border}
                  />
                  <Text style={[styles.ingredientText, checked && styles.ingredientChecked]}>
                    {ing}
                  </Text>
                </Pressable>
              );
            })}
          </Section>
        )}

        {/* Method */}
        {recipe.method.length > 0 && (
          <Section title="Method">
            {recipe.method.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNumBadge}><Text style={styles.stepNum}>{i + 1}</Text></View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </Section>
        )}

        {/* Notes */}
        {recipe.notes ? (
          <Section title="Notes">
            <Text style={styles.notes}>{recipe.notes}</Text>
          </Section>
        ) : null}

        {/* Cooking log */}
        {cookLog.length > 0 && (
          <Section title="Cooking History">
            {cookLog.map((entry) => (
              <View key={entry.id} style={styles.logRow}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.accent} />
                <View style={styles.logInfo}>
                  <Text style={styles.logDate}>{formatCookDate(entry.cookedAt)}</Text>
                  {entry.notes ? <Text style={styles.logNote}>{entry.notes}</Text> : null}
                </View>
              </View>
            ))}
          </Section>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      {/* ── Modals ── */}

      <UnitConverterModal visible={converterVisible} onClose={() => setConverter(false)} />

      <CookModeModal
        visible={cookMode}
        steps={recipe.method}
        title={recipe.title}
        onClose={() => setCookMode(false)}
      />

      {/* Shopping list picker modal */}
      <Modal visible={showShoppingPicker} animationType="slide" presentationStyle="formSheet" transparent onRequestClose={() => setShowShoppingPicker(false)}>
        <Pressable style={styles.sheetBg} onPress={() => setShowShoppingPicker(false)}>
          <Pressable style={[styles.sheet, styles.shoppingSheet]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.shoppingHeader}>
              <Text style={styles.sheetTitle}>Choose ingredients to add</Text>
              <View style={styles.shoppingHeaderBtns}>
                <Pressable onPress={() => setShoppingSelection(new Set(scaledIngredients.map((_, i) => i)))} hitSlop={8}>
                  <Text style={styles.shoppingSelectAll}>All</Text>
                </Pressable>
                <Pressable onPress={() => setShoppingSelection(new Set())} hitSlop={8}>
                  <Text style={styles.shoppingSelectAll}>None</Text>
                </Pressable>
              </View>
            </View>
            <ScrollView style={styles.shoppingList} showsVerticalScrollIndicator={false}>
              {scaledIngredients.map((ingredient, idx) => (
                <Pressable
                  key={idx}
                  style={styles.shoppingPickerRow}
                  onPress={() => toggleShoppingItem(idx)}
                >
                  <Ionicons
                    name={shoppingSelection.has(idx) ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={shoppingSelection.has(idx) ? Colors.primary : Colors.border}
                  />
                  <Text style={styles.shoppingPickerText}>{ingredient}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              style={[styles.shoppingConfirmBtn, shoppingSelection.size === 0 && styles.importBtnDisabled]}
              onPress={handleConfirmShoppingList}
              disabled={shoppingSelection.size === 0}
            >
              <Ionicons name="cart-outline" size={18} color={Colors.white} />
              <Text style={styles.shoppingConfirmText}>
                Add {shoppingSelection.size} ingredient{shoppingSelection.size !== 1 ? 's' : ''} to list
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* "Made it!" log modal */}
      <Modal visible={showLog} animationType="slide" presentationStyle="formSheet" transparent onRequestClose={() => setShowLog(false)}>
        <Pressable style={styles.sheetBg} onPress={() => setShowLog(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Log cook — {recipe.title}</Text>
            <TextInput
              style={styles.noteInput}
              value={logNote}
              onChangeText={setLogNote}
              placeholder="Any notes? (optional) — e.g. added extra garlic"
              placeholderTextColor={Colors.textMuted}
              multiline
            />
            <Pressable style={styles.logBtn} onPress={handleLogCook}>
              <Ionicons name="checkmark-circle-outline" size={20} color={Colors.white} />
              <Text style={styles.logBtnText}>Mark as Made Today</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Collections modal */}
      <Modal visible={showCollections} animationType="slide" presentationStyle="formSheet" transparent onRequestClose={() => setShowCollections(false)}>
        <Pressable style={styles.sheetBg} onPress={() => setShowCollections(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Add to Collection</Text>
            {collections.length === 0 ? (
              <Text style={styles.sheetEmpty}>No collections yet. Create one in the Collections tab.</Text>
            ) : (
              collections.map((col) => {
                const inCol = recipeColIds.includes(col.id);
                return (
                  <Pressable key={col.id} style={styles.colRow} onPress={() => handleToggleCollection(col.id)}>
                    <Ionicons name={inCol ? 'checkbox' : 'square-outline'} size={22} color={inCol ? Colors.primary : Colors.border} />
                    <Text style={styles.colName}>{col.name}</Text>
                    <Text style={styles.colCount}>{col.recipeCount} recipes</Text>
                  </Pressable>
                );
              })
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Full-screen photo modal */}
      {recipe.originalImageUri && (
        <Modal visible={photoModal} transparent animationType="fade" onRequestClose={() => setPhotoModal(false)}>
          <View style={styles.modalBg}>
            <Pressable style={styles.modalClose} onPress={() => setPhotoModal(false)}>
              <Ionicons name="close-circle" size={36} color={Colors.white} />
            </Pressable>
            <Text style={styles.modalHint}>Pinch to zoom · tap ✕ to close</Text>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              maximumZoomScale={5}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              centerContent
            >
              <Image source={{ uri: recipe.originalImageUri }} style={styles.modalImage} resizeMode="contain" />
            </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action}
      </View>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function MetaBadge({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={styles.metaBadge}>
      <Ionicons name={icon} size={14} color={Colors.textMuted} />
      <Text style={styles.metaBadgeText}>{text}</Text>
    </View>
  );
}

function ActionBtn({ icon, label, onPress, active }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable style={[styles.actionBtn, active && styles.actionBtnActive]} onPress={onPress}>
      <Ionicons name={icon} size={20} color={active ? Colors.white : Colors.primary} />
      <Text style={[styles.actionBtnLabel, active && styles.actionBtnLabelActive]}>{label}</Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingTop: 56, paddingBottom: Spacing.sm,
  },
  backBtn: { padding: 4 },
  headerActions: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  awakeBtn: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  awakeBtnActive: { backgroundColor: Colors.warning, borderColor: Colors.warning },

  content: { padding: Spacing.md, gap: Spacing.md },

  photoWrapper: { borderRadius: Radius.md, overflow: 'hidden' },
  photo: { width: '100%', height: 220 },
  photoExpandHint: {
    position: 'absolute', bottom: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  photoExpandText: { color: Colors.white, fontSize: 12, fontWeight: '600' },

  titleSection: { gap: Spacing.sm },
  title: { ...Typography.h1 },
  source: { fontSize: 14, color: Colors.textMuted },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  metaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.chip, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  metaBadgeText: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  metaBadgeScaled: { color: Colors.primary },
  servingsInput: { fontSize: 13, fontWeight: '600', color: Colors.primary, minWidth: 30, padding: 0 },

  resetServings: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
  },
  resetServingsText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: Colors.chip, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 4 },
  chipText: { fontSize: 12, color: Colors.chipText, fontWeight: '600' },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  actionBtn: {
    flex: 1, minWidth: 60, alignItems: 'center', gap: 4,
    backgroundColor: Colors.white, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.primary,
    paddingVertical: 10, paddingHorizontal: 4,
  },
  actionBtnActive: { backgroundColor: Colors.primary },
  actionBtnLabel: { fontSize: 10, fontWeight: '700', color: Colors.primary, textAlign: 'center' },
  actionBtnLabelActive: { color: Colors.white },

  // Last cooked
  lastCooked: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#EAF4ED', borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
  },
  lastCookedText: { fontSize: 13, color: Colors.accent, fontWeight: '600', flex: 1 },

  section: { gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1.5, borderColor: Colors.border, paddingBottom: Spacing.xs },
  sectionTitle: { ...Typography.h2 },
  clearChecks: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  sectionContent: { gap: Spacing.xs },

  ingredientRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 3 },
  ingredientText: { flex: 1, ...Typography.body },
  ingredientChecked: { textDecorationLine: 'line-through', color: Colors.textMuted, opacity: 0.7 },

  starRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingLabel: { fontSize: 13, color: '#F5A623', fontWeight: '700', marginLeft: 6 },

  stepRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  stepNumBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 1,
  },
  stepNum: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  stepText: { flex: 1, ...Typography.body, lineHeight: 24 },

  notes: { ...Typography.body, color: Colors.textMuted, lineHeight: 24, fontStyle: 'italic' },

  // Log rows
  logRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  logInfo: { flex: 1 },
  logDate: { fontSize: 14, fontWeight: '600', color: Colors.text },
  logNote: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },

  // Sheet modals
  sheetBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40,
  },
  sheetTitle: { ...Typography.h2 },

  // Shopping picker
  shoppingSheet: { maxHeight: '80%', paddingBottom: 40 },
  shoppingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shoppingHeaderBtns: { flexDirection: 'row', gap: Spacing.md },
  shoppingSelectAll: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  shoppingList: { flexGrow: 0 },
  shoppingPickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 10, borderBottomWidth: 1, borderColor: Colors.border,
  },
  shoppingPickerText: { flex: 1, fontSize: 15, color: Colors.text },
  shoppingConfirmBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, marginTop: Spacing.sm,
  },
  shoppingConfirmText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  importBtnDisabled: { opacity: 0.45 },
  sheetEmpty: { color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.md },

  noteInput: {
    backgroundColor: Colors.background, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: 15, color: Colors.text, minHeight: 70, textAlignVertical: 'top',
  },
  logBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14,
  },
  logBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },

  colRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  colName: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  colCount: { fontSize: 13, color: Colors.textMuted },

  // Photo modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  modalClose: { position: 'absolute', top: 56, right: 20, zIndex: 10 },
  modalHint: { color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center', marginTop: 60, marginBottom: 4 },
  modalScroll: { flex: 1 },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  modalImage: { width: '100%', height: undefined, aspectRatio: 0.75 },
});
