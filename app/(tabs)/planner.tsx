import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '@/lib/theme';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function PlannerScreen() {
  // Phase 3 — coming soon
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="calendar-outline" size={48} color={Colors.primary} />
        <Text style={styles.title}>Weekly Meal Planner</Text>
        <Text style={styles.sub}>Coming in Phase 2</Text>
      </View>

      <View style={styles.preview}>
        {DAYS.map((day) => (
          <View key={day} style={styles.dayRow}>
            <Text style={styles.dayName}>{day}</Text>
            <View style={styles.daySlot}>
              <Ionicons name="add-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.daySlotText}>Add dinner</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.note}>
        Once you have a recipe collection, you'll be able to assign recipes to each day,
        scale servings, and generate a shopping list automatically.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.lg },
  header: { alignItems: 'center', gap: 8, marginBottom: Spacing.xl },
  title: { ...Typography.h1 },
  sub: { ...Typography.body, color: Colors.primary, fontWeight: '600' },
  preview: { gap: Spacing.xs, marginBottom: Spacing.lg },
  dayRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: 10,
    padding: Spacing.md, gap: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  dayName: { width: 90, fontWeight: '600', color: Colors.text },
  daySlot: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed',
    borderRadius: 6, padding: 8,
  },
  daySlotText: { color: Colors.textMuted, fontSize: 13 },
  note: { ...Typography.body, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
});
