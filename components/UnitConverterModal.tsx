import React, { useState } from 'react';
import {
  Modal, View, Text, Pressable, TextInput,
  ScrollView, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '@/lib/theme';

// ─── Conversion data ──────────────────────────────────────────────────────────

type UnitCategory = 'volume' | 'weight' | 'temp';

interface Unit {
  label: string;
  abbr: string;
  category: UnitCategory;
  toMetric: (v: number) => { value: number; unit: string };
}

const UNITS: Unit[] = [
  // Volume
  { label: 'Cup',         abbr: 'cup',   category: 'volume', toMetric: (v) => ({ value: Math.round(v * 240),    unit: 'ml' }) },
  { label: 'Tablespoon',  abbr: 'tbsp',  category: 'volume', toMetric: (v) => ({ value: Math.round(v * 15),     unit: 'ml' }) },
  { label: 'Teaspoon',    abbr: 'tsp',   category: 'volume', toMetric: (v) => ({ value: Math.round(v * 5),      unit: 'ml' }) },
  { label: 'Fluid oz',    abbr: 'fl oz', category: 'volume', toMetric: (v) => ({ value: Math.round(v * 30),     unit: 'ml' }) },
  // Weight
  { label: 'Ounce',       abbr: 'oz',    category: 'weight', toMetric: (v) => ({ value: Math.round(v * 28.35),  unit: 'g'  }) },
  { label: 'Pound',       abbr: 'lb',    category: 'weight', toMetric: (v) => ({ value: Math.round(v * 453.6),  unit: 'g'  }) },
  // Temperature
  { label: '°Fahrenheit', abbr: '°F',    category: 'temp',   toMetric: (v) => ({ value: Math.round((v - 32) * 5 / 9), unit: '°C' }) },
];

const QUICK_REF = [
  { from: '¼ cup',   to: '60 ml'   },
  { from: '⅓ cup',   to: '80 ml'   },
  { from: '½ cup',   to: '120 ml'  },
  { from: '1 cup',   to: '240 ml'  },
  { from: '1 tbsp',  to: '15 ml'   },
  { from: '1 tsp',   to: '5 ml'    },
  { from: '1 fl oz', to: '30 ml'   },
  { from: '1 oz',    to: '28 g'    },
  { from: '1 lb',    to: '454 g'   },
  { from: '325°F',   to: '165°C'   },
  { from: '350°F',   to: '180°C'   },
  { from: '375°F',   to: '190°C'   },
  { from: '400°F',   to: '200°C'   },
  { from: '425°F',   to: '220°C'   },
  { from: '450°F',   to: '230°C'   },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function UnitConverterModal({ visible, onClose }: Props) {
  const [amount, setAmount]         = useState('');
  const [selectedUnit, setSelected] = useState<Unit>(UNITS[0]);
  const [tab, setTab]               = useState<'calculator' | 'reference'>('calculator');

  const numVal  = parseFloat(amount);
  const result  = !isNaN(numVal) && numVal > 0 ? selectedUnit.toMetric(numVal) : null;

  const categoryLabel: Record<UnitCategory, string> = {
    volume: '💧 Volume',
    weight: '⚖️  Weight',
    temp:   '🌡️  Temperature',
  };

  const categories: UnitCategory[] = ['volume', 'weight', 'temp'];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🔄  Unit Converter</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={26} color={Colors.text} />
          </Pressable>
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tab, tab === 'calculator' && styles.tabActive]}
            onPress={() => setTab('calculator')}
          >
            <Text style={[styles.tabText, tab === 'calculator' && styles.tabTextActive]}>Calculator</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === 'reference' && styles.tabActive]}
            onPress={() => setTab('reference')}
          >
            <Text style={[styles.tabText, tab === 'reference' && styles.tabTextActive]}>Quick Reference</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">

          {tab === 'calculator' ? (
            <>
              {/* Amount input */}
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Amount</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 2.5"
                  placeholderTextColor={Colors.textMuted}
                  autoFocus
                />
              </View>

              {/* Unit picker */}
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Unit to convert</Text>
                {categories.map((cat) => (
                  <View key={cat} style={styles.unitGroup}>
                    <Text style={styles.unitGroupLabel}>{categoryLabel[cat]}</Text>
                    <View style={styles.unitRow}>
                      {UNITS.filter((u) => u.category === cat).map((u) => (
                        <Pressable
                          key={u.abbr}
                          style={[styles.unitChip, selectedUnit.abbr === u.abbr && styles.unitChipActive]}
                          onPress={() => setSelected(u)}
                        >
                          <Text style={[styles.unitChipText, selectedUnit.abbr === u.abbr && styles.unitChipTextActive]}>
                            {u.abbr}
                          </Text>
                          <Text style={[styles.unitChipSub, selectedUnit.abbr === u.abbr && styles.unitChipTextActive]}>
                            {u.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))}
              </View>

              {/* Result */}
              <View style={[styles.card, styles.resultCard]}>
                {result ? (
                  <>
                    <Text style={styles.resultLabel}>Result</Text>
                    <Text style={styles.resultValue}>
                      {amount} {selectedUnit.abbr}  =
                    </Text>
                    <Text style={styles.resultMetric}>
                      {result.value} {result.unit}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.resultPlaceholder}>
                    Enter an amount above to see the conversion
                  </Text>
                )}
              </View>
            </>
          ) : (
            /* Quick reference table */
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Common conversions</Text>
              {QUICK_REF.map((row, i) => (
                <View
                  key={i}
                  style={[styles.refRow, i % 2 === 0 && styles.refRowAlt]}
                >
                  <Text style={styles.refFrom}>{row.from}</Text>
                  <Ionicons name="arrow-forward" size={14} color={Colors.textMuted} />
                  <Text style={styles.refTo}>{row.to}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingTop: 20, paddingBottom: Spacing.sm,
    borderBottomWidth: 1, borderColor: Colors.border,
  },
  headerTitle: { ...Typography.h2 },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderColor: Colors.border,
  },
  tab: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderBottomWidth: 2, borderColor: 'transparent',
  },
  tabActive: { borderColor: Colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.primary },

  body: { flex: 1 },
  bodyContent: { padding: Spacing.md, gap: Spacing.md },

  card: {
    backgroundColor: Colors.white, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.sm,
  },
  cardLabel: { ...Typography.label },

  amountInput: {
    backgroundColor: Colors.background, borderRadius: Radius.sm,
    borderWidth: 1.5, borderColor: Colors.primary,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    fontSize: 28, fontWeight: '700', color: Colors.text,
    textAlign: 'center',
  },

  unitGroup: { gap: 6 },
  unitGroupLabel: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  unitChip: {
    backgroundColor: Colors.background, borderRadius: Radius.sm,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 8,
    alignItems: 'center', minWidth: 64,
  },
  unitChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  unitChipText: { fontSize: 14, fontWeight: '700', color: Colors.text },
  unitChipSub: { fontSize: 11, color: Colors.textMuted },
  unitChipTextActive: { color: Colors.white },

  resultCard: { alignItems: 'center', paddingVertical: Spacing.lg },
  resultLabel: { ...Typography.label, textAlign: 'center' },
  resultValue: { fontSize: 18, color: Colors.textMuted, fontWeight: '500' },
  resultMetric: { fontSize: 40, fontWeight: '800', color: Colors.primary },
  resultPlaceholder: { color: Colors.textMuted, textAlign: 'center', fontSize: 14 },

  refRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 8, gap: 12,
    borderRadius: Radius.sm,
  },
  refRowAlt: { backgroundColor: Colors.background },
  refFrom: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text, textAlign: 'right' },
  refTo: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.primary },
});
