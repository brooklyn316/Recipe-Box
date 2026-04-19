import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, TextInput, StyleSheet,
  ScrollView, Vibration, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '@/lib/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimerEntry {
  id: number;
  label: string;
  totalSeconds: number;
  remainingSeconds: number;
  running: boolean;
  done: boolean;
}

let nextId = 1;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function parseMinutes(s: string): number {
  const n = parseInt(s, 10);
  return isNaN(n) || n <= 0 ? 0 : Math.min(n, 999);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TimerPanel() {
  const [timers, setTimers]   = useState<TimerEntry[]>([]);
  const [label, setLabel]     = useState('');
  const [minutes, setMinutes] = useState('');
  const intervalRef           = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick every second
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTimers((prev) => prev.map((t) => {
        if (!t.running || t.done) return t;
        const next = t.remainingSeconds - 1;
        if (next <= 0) {
          Vibration.vibrate([0, 500, 200, 500]);
          return { ...t, remainingSeconds: 0, running: false, done: true };
        }
        return { ...t, remainingSeconds: next };
      }));
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const addTimer = () => {
    const mins = parseMinutes(minutes);
    if (mins === 0) {
      Alert.alert('Enter minutes', 'Please enter a duration in minutes.');
      return;
    }
    const entry: TimerEntry = {
      id: nextId++,
      label: label.trim() || `Timer ${nextId - 1}`,
      totalSeconds: mins * 60,
      remainingSeconds: mins * 60,
      running: true,
      done: false,
    };
    setTimers((prev) => [...prev, entry]);
    setLabel('');
    setMinutes('');
  };

  const toggleTimer = (id: number) => {
    setTimers((prev) => prev.map((t) =>
      t.id === id && !t.done ? { ...t, running: !t.running } : t
    ));
  };

  const resetTimer = (id: number) => {
    setTimers((prev) => prev.map((t) =>
      t.id === id ? { ...t, remainingSeconds: t.totalSeconds, running: false, done: false } : t
    ));
  };

  const removeTimer = (id: number) => {
    setTimers((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>
        <Ionicons name="timer-outline" size={16} color={Colors.primary} /> Timers
      </Text>

      {/* Add new timer */}
      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, styles.labelInput]}
          value={label}
          onChangeText={setLabel}
          placeholder="Label (e.g. Pasta)"
          placeholderTextColor={Colors.textMuted}
        />
        <TextInput
          style={[styles.input, styles.minInput]}
          value={minutes}
          onChangeText={setMinutes}
          placeholder="Min"
          placeholderTextColor={Colors.textMuted}
          keyboardType="number-pad"
          returnKeyType="done"
          onSubmitEditing={addTimer}
        />
        <Pressable style={styles.addBtn} onPress={addTimer}>
          <Ionicons name="add" size={20} color={Colors.white} />
        </Pressable>
      </View>

      {/* Timer list */}
      {timers.length === 0 ? (
        <Text style={styles.emptyText}>No timers running. Add one above.</Text>
      ) : (
        <View style={styles.timerList}>
          {timers.map((t) => (
            <View key={t.id} style={[styles.timerRow, t.done && styles.timerRowDone]}>
              <View style={styles.timerInfo}>
                <Text style={styles.timerLabel}>{t.label}</Text>
                <Text style={[styles.timerTime, t.done && styles.timerTimeDone]}>
                  {t.done ? '⏰ Done!' : formatTime(t.remainingSeconds)}
                </Text>
                {!t.done && (
                  <View style={styles.timerTrack}>
                    <View style={[
                      styles.timerFill,
                      { width: `${(t.remainingSeconds / t.totalSeconds) * 100}%` },
                    ]} />
                  </View>
                )}
              </View>
              <View style={styles.timerActions}>
                {!t.done && (
                  <Pressable onPress={() => toggleTimer(t.id)} hitSlop={8}>
                    <Ionicons
                      name={t.running ? 'pause-circle-outline' : 'play-circle-outline'}
                      size={28} color={Colors.primary}
                    />
                  </Pressable>
                )}
                <Pressable onPress={() => resetTimer(t.id)} hitSlop={8}>
                  <Ionicons name="refresh-outline" size={24} color={Colors.textMuted} />
                </Pressable>
                <Pressable onPress={() => removeTimer(t.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={22} color={Colors.danger} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  panel: {
    backgroundColor: Colors.white, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.sm,
  },
  panelTitle: { ...Typography.h3, fontSize: 15 },

  addRow: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'center' },
  input: {
    backgroundColor: Colors.background, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 14, color: Colors.text,
  },
  labelInput: { flex: 1 },
  minInput: { width: 60, textAlign: 'center' },
  addBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.sm,
    padding: 9, alignItems: 'center', justifyContent: 'center',
  },

  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.sm },

  timerList: { gap: Spacing.sm },
  timerRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.background, borderRadius: Radius.sm,
    padding: Spacing.sm, gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  timerRowDone: { borderColor: Colors.accent, backgroundColor: '#EAF4ED' },
  timerInfo: { flex: 1, gap: 4 },
  timerLabel: { fontSize: 13, fontWeight: '600', color: Colors.text },
  timerTime: { fontSize: 22, fontWeight: '800', color: Colors.primary, fontVariant: ['tabular-nums'] },
  timerTimeDone: { color: Colors.accent, fontSize: 18 },
  timerTrack: { height: 3, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' },
  timerFill: { height: 3, backgroundColor: Colors.primary, borderRadius: 2 },
  timerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
