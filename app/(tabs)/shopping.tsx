import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, Alert, SectionList,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Calendar from 'expo-calendar';
import {
  getShoppingItems, toggleShoppingItem, clearCheckedItems,
  clearAllShoppingItems, deleteShoppingItem, addCustomShoppingItem, ShoppingItem,
} from '@/lib/db';
import { Colors, Spacing, Radius, Typography } from '@/lib/theme';

// ─── Reminders helper ─────────────────────────────────────────────────────────

async function sendToSupermarketList(items: ShoppingItem[]): Promise<void> {
  // Request permission
  const { status } = await Calendar.requestRemindersPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Permission needed',
      'Please allow Reminders access in Settings so Recipe Box can add items to your Supermarket List.'
    );
    return;
  }

  // Find the "Supermarket List" reminder list
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.REMINDER);
  const list = calendars.find(
    (c) => c.title.toLowerCase() === 'supermarket list'
  );

  if (!list) {
    Alert.alert(
      'List not found',
      'Could not find a Reminders list called "Supermarket List". Please create it in the Reminders app first, then try again.'
    );
    return;
  }

  // Add each unchecked item as a reminder
  const unchecked = items.filter((i) => !i.isChecked);
  let added = 0;
  for (const item of unchecked) {
    try {
      await Calendar.createReminderAsync(list.id, { title: item.text });
      added++;
    } catch { /* skip duplicates or errors */ }
  }

  Alert.alert(
    'Added to Reminders ✓',
    `${added} item${added !== 1 ? 's' : ''} added to your Supermarket List.`
  );
}

// ─── Category definitions ─────────────────────────────────────────────────────

type Category = {
  key: string;
  label: string;
  icon: string;
  keywords: RegExp;
};

const CATEGORIES: Category[] = [
  {
    key: 'produce',
    label: 'Fruit & Veg',
    icon: '🥬',
    keywords: /\b(apple|pear|banana|orange|lemon|lime|grape|berry|berries|strawberr|blueberr|raspberr|mango|avocado|kiwi|peach|plum|cherry|cherries|melon|watermelon|pineapple|coconut|fig|date|apricot|nectarine|tomato|tomatoes|potato|potatoes|onion|onions|garlic|carrot|carrots|celery|broccoli|cauliflower|spinach|lettuce|kale|cabbage|zucchini|courgette|capsicum|pepper|cucumber|eggplant|aubergine|pumpkin|squash|beetroot|beet|corn|pea|peas|bean|beans|leek|asparagus|mushroom|mushrooms|ginger|chilli|chili|herb|herbs|coriander|cilantro|parsley|basil|mint|thyme|rosemary|dill|spring onion|shallot|shallots|fennel|radish|turnip|swede|sweet potato|yam|silverbeet|bok choy|broccolini)\b/i,
  },
  {
    key: 'meat',
    label: 'Meat & Fish',
    icon: '🥩',
    keywords: /\b(chicken|beef|lamb|pork|mince|steak|sausage|sausages|bacon|ham|turkey|duck|veal|liver|kidney|salami|prosciutto|pancetta|chorizo|fish|salmon|tuna|cod|snapper|hoki|prawn|prawns|shrimp|mussel|mussels|squid|scallop|scallops|crab|lobster|anchov|sardine|seafood|meatball|meatballs|brisket|ribs|rump|schnitzel|fillet|fillet)\b/i,
  },
  {
    key: 'dairy',
    label: 'Dairy & Eggs',
    icon: '🧀',
    keywords: /\b(milk|cream|butter|cheese|cheddar|parmesan|mozzarella|brie|feta|ricotta|cottage cheese|mascarpone|gouda|edam|halloumi|yoghurt|yogurt|sour cream|crème fraîche|creme fraiche|egg|eggs|ghee|kefir|custard)\b/i,
  },
  {
    key: 'bakery',
    label: 'Bakery & Bread',
    icon: '🍞',
    keywords: /\b(bread|loaf|roll|rolls|bun|buns|bagel|croissant|pita|flatbread|sourdough|baguette|ciabatta|tortilla|wraps|wrap|crackers|cracker|breadcrumb|breadcrumbs|crouton)\b/i,
  },
  {
    key: 'pantry',
    label: 'Pantry',
    icon: '🥫',
    keywords: /\b(flour|sugar|salt|pepper|oil|olive oil|vinegar|soy sauce|sauce|paste|stock|broth|tin|can|canned|dried|pasta|rice|noodle|noodles|lentil|lentils|chickpea|chickpeas|kidney bean|black bean|oat|oats|cereal|honey|jam|vegemite|marmite|peanut butter|nutella|syrup|vanilla|cocoa|chocolate|chips|baking powder|baking soda|bicarb|yeast|cornflour|cornstarch|gelatin|gelatine|icing sugar|brown sugar|caster sugar|coconut milk|coconut cream|tomato paste|diced tomato|crushed tomato|tomato sauce|mustard|mayonnaise|ketchup|relish|chutney|curry paste|miso|tahini|worcestershire|oyster sauce|fish sauce|hoisin|sriracha|tabasco|cumin|paprika|turmeric|cinnamon|oregano|curry|spice|spices|herb|lemon juice|lime juice|sesame|poppy seed|almond|almonds|walnut|walnuts|cashew|cashews|pecan|peanut|peanuts|hazelnut|pine nut|sunflower seed|pumpkin seed|chia|flaxseed|raisin|sultana|currant|apricot|dried fruit|stock cube|bouillon)\b/i,
  },
  {
    key: 'frozen',
    label: 'Frozen',
    icon: '❄️',
    keywords: /\b(frozen|ice cream|gelato|sorbet|frozen pea|frozen corn|frozen vegetable|frozen spinach|frozen berry|frozen fish|frozen prawn)\b/i,
  },
  {
    key: 'drinks',
    label: 'Drinks',
    icon: '🥤',
    keywords: /\b(juice|water|sparkling|soda|cola|lemonade|coffee|tea|wine|beer|cider|spirits|gin|vodka|rum|whisky|whiskey|bourbon|champagne|prosecco|milk drink|oat milk|almond milk|soy milk|rice milk|coconut water)\b/i,
  },
];

const OTHER_CATEGORY = { key: 'other', label: 'Other', icon: '🛒' };

function categorise(text: string): Category {
  const lower = text.toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.keywords.test(lower)) return cat;
  }
  return OTHER_CATEGORY as Category;
}

// ─── Component ────────────────────────────────────────────────────────────────

type Section = { title: string; icon: string; data: ShoppingItem[] };

export default function ShoppingScreen() {
  const [items, setItems]     = useState<ShoppingItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [groupBy, setGroupBy] = useState<'category' | 'recipe'>('category');

  const load = useCallback(async () => {
    setItems(await getShoppingItems());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleToggle = async (id: number) => {
    await toggleShoppingItem(id);
    await load();
  };

  const handleDelete = async (id: number) => {
    await deleteShoppingItem(id);
    await load();
  };

  const handleAddCustom = async () => {
    const text = newItem.trim();
    if (!text) return;
    await addCustomShoppingItem(text);
    setNewItem('');
    await load();
  };

  const handleClearChecked = () => {
    Alert.alert('Clear ticked items?', 'This removes all ticked items from the list.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => { await clearCheckedItems(); await load(); } },
    ]);
  };

  const handleClearAll = () => {
    Alert.alert('Clear everything?', 'This will remove the entire shopping list.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear all', style: 'destructive', onPress: async () => { await clearAllShoppingItems(); await load(); } },
    ]);
  };

  const handleSendToReminders = async () => {
    const unchecked = items.filter((i) => !i.isChecked);
    if (unchecked.length === 0) {
      Alert.alert('Nothing to send', 'All items are already ticked off.');
      return;
    }
    await sendToSupermarketList(items);
  };

  // ── Build sections ─────────────────────────────────────────────────────────

  const unchecked = items.filter((i) => !i.isChecked);
  const checked   = items.filter((i) => i.isChecked);
  const sections: Section[] = [];

  if (groupBy === 'category') {
    // Group by supermarket aisle
    const catMap = new Map<string, { cat: Category; items: ShoppingItem[] }>();
    for (const item of unchecked) {
      const cat = categorise(item.text);
      if (!catMap.has(cat.key)) catMap.set(cat.key, { cat, items: [] });
      catMap.get(cat.key)!.items.push(item);
    }
    // Sort by the defined category order
    const catOrder = [...CATEGORIES.map((c) => c.key), OTHER_CATEGORY.key];
    const sorted = [...catMap.entries()].sort(
      (a, b) => catOrder.indexOf(a[0]) - catOrder.indexOf(b[0])
    );
    for (const [, { cat, items: data }] of sorted) {
      sections.push({ title: cat.label, icon: cat.icon, data });
    }
  } else {
    // Group by recipe name
    const recipeMap = new Map<string, ShoppingItem[]>();
    for (const item of unchecked) {
      const key = item.recipeName || 'Custom items';
      if (!recipeMap.has(key)) recipeMap.set(key, []);
      recipeMap.get(key)!.push(item);
    }
    recipeMap.forEach((data, title) => sections.push({ title, icon: '📖', data }));
  }

  if (checked.length > 0) {
    sections.push({ title: `Ticked (${checked.length})`, icon: '✓', data: checked });
  }

  const checkedCount = checked.length;
  const totalCount   = items.length;

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🛒  Shopping List</Text>
        <View style={styles.headerActions}>
          {totalCount > 0 && (
            <>
              <Pressable style={styles.remindersBtn} onPress={handleSendToReminders} hitSlop={8}>
                <Ionicons name="checkmark-circle-outline" size={16} color={Colors.white} />
                <Text style={styles.remindersBtnText}>Supermarket List</Text>
              </Pressable>
              {checkedCount > 0 && (
                <Pressable onPress={handleClearChecked} hitSlop={8}>
                  <Text style={styles.clearBtn}>Clear ticked</Text>
                </Pressable>
              )}
              <Pressable onPress={handleClearAll} hitSlop={8}>
                <Ionicons name="trash-outline" size={22} color={Colors.danger} />
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* Group-by toggle */}
      {totalCount > 0 && (
        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggleBtn, groupBy === 'category' && styles.toggleBtnActive]}
            onPress={() => setGroupBy('category')}
          >
            <Ionicons name="grid-outline" size={14} color={groupBy === 'category' ? Colors.white : Colors.textMuted} />
            <Text style={[styles.toggleBtnText, groupBy === 'category' && styles.toggleBtnTextActive]}>By aisle</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, groupBy === 'recipe' && styles.toggleBtnActive]}
            onPress={() => setGroupBy('recipe')}
          >
            <Ionicons name="book-outline" size={14} color={groupBy === 'recipe' ? Colors.white : Colors.textMuted} />
            <Text style={[styles.toggleBtnText, groupBy === 'recipe' && styles.toggleBtnTextActive]}>By recipe</Text>
          </Pressable>
        </View>
      )}

      {/* Add custom item */}
      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          value={newItem}
          onChangeText={setNewItem}
          placeholder="Add an item…"
          placeholderTextColor={Colors.textMuted}
          returnKeyType="done"
          onSubmitEditing={handleAddCustom}
        />
        <Pressable
          style={[styles.addBtn, !newItem.trim() && styles.addBtnDisabled]}
          onPress={handleAddCustom}
          disabled={!newItem.trim()}
        >
          <Ionicons name="add" size={22} color={Colors.white} />
        </Pressable>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="cart-outline" size={64} color={Colors.border} />
          <Text style={styles.emptyTitle}>List is empty</Text>
          <Text style={styles.emptyHint}>
            Open a recipe and tap <Text style={{ fontWeight: '700' }}>Add to List</Text> to add its ingredients here.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderIcon}>{section.icon}</Text>
              <Text style={styles.sectionHeader}>{section.title}</Text>
              <Text style={styles.sectionCount}>{section.data.length}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.itemRow, item.isChecked && styles.itemRowChecked]}
              onPress={() => handleToggle(item.id)}
            >
              <Ionicons
                name={item.isChecked ? 'checkbox' : 'square-outline'}
                size={22}
                color={item.isChecked ? Colors.accent : Colors.border}
              />
              <View style={styles.itemContent}>
                <Text style={[styles.itemText, item.isChecked && styles.itemTextChecked]}>
                  {item.text}
                </Text>
                {groupBy === 'category' && item.recipeName ? (
                  <Text style={styles.itemRecipe}>{item.recipeName}</Text>
                ) : null}
              </View>
              <Pressable onPress={() => handleDelete(item.id)} hitSlop={10}>
                <Ionicons name="close" size={18} color={Colors.textMuted} />
              </Pressable>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingTop: 60, paddingBottom: Spacing.sm,
  },
  headerTitle: { ...Typography.h1, fontSize: 22 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  remindersBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.accent, borderRadius: Radius.full,
    paddingVertical: 5, paddingHorizontal: 10,
  },
  remindersBtnText: { fontSize: 12, fontWeight: '700', color: Colors.white },
  clearBtn: { fontSize: 14, color: Colors.primary, fontWeight: '600' },

  toggleRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm,
  },
  toggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.chip,
  },
  toggleBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleBtnText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  toggleBtnTextActive: { color: Colors.white },

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

  list: { paddingHorizontal: Spacing.md, paddingBottom: 40 },

  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingTop: Spacing.md, paddingBottom: 6,
  },
  sectionHeaderIcon: { fontSize: 15 },
  sectionHeader: { ...Typography.label, flex: 1 },
  sectionCount: {
    fontSize: 12, fontWeight: '700', color: Colors.white,
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden',
  },

  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.white, borderRadius: Radius.sm,
    padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
    marginBottom: 4,
  },
  itemRowChecked: { backgroundColor: Colors.background, borderColor: Colors.border, opacity: 0.65 },
  itemContent: { flex: 1 },
  itemText: { fontSize: 15, color: Colors.text },
  itemTextChecked: { textDecorationLine: 'line-through', color: Colors.textMuted },
  itemRecipe: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.xl },
  emptyTitle: { ...Typography.h2, color: Colors.textMuted },
  emptyHint: { ...Typography.body, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
});
