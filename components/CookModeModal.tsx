import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, Pressable, StyleSheet,
  StatusBar, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Speech from 'expo-speech';
import { Colors, Spacing, Radius, Typography } from '@/lib/theme';

interface Props {
  visible: boolean;
  steps: string[];
  title: string;
  onClose: () => void;
}

const { width: SCREEN_W } = Dimensions.get('window');

export function CookModeModal({ visible, steps, title, onClose }: Props) {
  const [index, setIndex]       = useState(0);
  const [autoRead, setAutoRead] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const total = steps.length;

  // Keep awake + reset on open; stop speech on close
  useEffect(() => {
    if (visible) {
      activateKeepAwakeAsync();
      setIndex(0);
    } else {
      deactivateKeepAwake();
      Speech.stop();
      setSpeaking(false);
    }
    return () => {
      deactivateKeepAwake();
      Speech.stop();
    };
  }, [visible]);

  // Auto-read the current step whenever it changes (if auto-read is on)
  useEffect(() => {
    if (!visible || !autoRead) return;
    speakStep(steps[index]);
  }, [index, autoRead, visible]);

  if (!visible || total === 0) return null;

  const step     = steps[index];
  const isFirst  = index === 0;
  const isLast   = index === total - 1;
  const progress = (index + 1) / total;

  // ── Speech helpers ──────────────────────────────────────────────────────────

  const speakStep = (text: string) => {
    Speech.stop();
    setSpeaking(true);
    Speech.speak(text, {
      language: 'en',
      rate: 0.92,
      onDone:  () => setSpeaking(false),
      onError: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
    });
  };

  const handleSpeakToggle = () => {
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
    } else {
      speakStep(step);
    }
  };

  const handleAutoReadToggle = () => {
    const next = !autoRead;
    setAutoRead(next);
    if (next) {
      speakStep(step);   // read current step immediately
    } else {
      Speech.stop();
      setSpeaking(false);
    }
  };

  const goNext = () => {
    Speech.stop();
    setSpeaking(false);
    setIndex((i) => Math.min(total - 1, i + 1));
  };

  const goPrev = () => {
    Speech.stop();
    setSpeaking(false);
    setIndex((i) => Math.max(0, i - 1));
  };

  const handleClose = () => {
    Speech.stop();
    setSpeaking(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={handleClose}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <View style={styles.screen}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={handleClose} hitSlop={16} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={Colors.white} />
          </Pressable>
          <Text style={styles.recipeTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.stepCounter}>{index + 1} / {total}</Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        {/* Step content */}
        <View style={styles.contentArea}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>Step {index + 1}</Text>
          </View>

          <Text style={styles.stepText}>{step}</Text>
        </View>

        {/* TTS controls */}
        <View style={styles.ttsRow}>
          {/* Read this step */}
          <Pressable style={[styles.ttsBtn, speaking && styles.ttsBtnActive]} onPress={handleSpeakToggle} hitSlop={8}>
            <Ionicons
              name={speaking ? 'stop-circle-outline' : 'volume-high-outline'}
              size={20}
              color={speaking ? Colors.primary : 'rgba(255,255,255,0.75)'}
            />
            <Text style={[styles.ttsBtnText, speaking && styles.ttsBtnTextActive]}>
              {speaking ? 'Stop' : 'Read step'}
            </Text>
          </Pressable>

          {/* Auto-read toggle */}
          <Pressable style={[styles.ttsBtn, autoRead && styles.ttsBtnActive]} onPress={handleAutoReadToggle} hitSlop={8}>
            <Ionicons
              name={autoRead ? 'mic' : 'mic-outline'}
              size={20}
              color={autoRead ? Colors.primary : 'rgba(255,255,255,0.75)'}
            />
            <Text style={[styles.ttsBtnText, autoRead && styles.ttsBtnTextActive]}>
              {autoRead ? 'Auto-read on' : 'Auto-read'}
            </Text>
          </Pressable>
        </View>

        {/* Navigation */}
        <View style={styles.navBar}>
          <Pressable
            style={[styles.navBtn, isFirst && styles.navBtnDisabled]}
            onPress={goPrev}
            disabled={isFirst}
          >
            <Ionicons name="arrow-back-circle" size={52} color={isFirst ? Colors.border : Colors.white} />
            <Text style={[styles.navLabel, isFirst && styles.navLabelDisabled]}>Previous</Text>
          </Pressable>

          {isLast ? (
            <Pressable style={styles.doneBtn} onPress={handleClose}>
              <Ionicons name="checkmark-circle" size={52} color={Colors.accent} />
              <Text style={styles.doneBtnText}>Done!</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.navBtn} onPress={goNext}>
              <Ionicons name="arrow-forward-circle" size={52} color={Colors.white} />
              <Text style={styles.navLabel}>Next</Text>
            </Pressable>
          )}
        </View>

        {/* Step dots */}
        {total <= 20 && (
          <View style={styles.dots}>
            {steps.map((_, i) => (
              <Pressable key={i} onPress={() => { Speech.stop(); setSpeaking(false); setIndex(i); }}>
                <View style={[styles.dot, i === index && styles.dotActive, i < index && styles.dotDone]} />
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.primary },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 56, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  closeBtn: { padding: 4 },
  recipeTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  stepCounter: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '600', minWidth: 40, textAlign: 'right' },

  progressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.25)', marginHorizontal: Spacing.lg },
  progressFill: { height: 4, backgroundColor: Colors.white, borderRadius: 2 },

  contentArea: {
    flex: 1, justifyContent: 'center', alignItems: 'flex-start',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.xl, gap: Spacing.lg,
  },
  stepBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: Radius.full,
    paddingHorizontal: 16, paddingVertical: 6,
  },
  stepBadgeText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  stepText: { fontSize: 26, lineHeight: 40, color: Colors.white, fontWeight: '500' },

  ttsRow: {
    flexDirection: 'row', justifyContent: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md,
  },
  ttsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
  },
  ttsBtnActive: { backgroundColor: Colors.white, borderColor: Colors.white },
  ttsBtnText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  ttsBtnTextActive: { color: Colors.primary },

  navBar: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl,
  },
  navBtn: { alignItems: 'center', gap: 4 },
  navBtnDisabled: { opacity: 0.3 },
  navLabel: { color: Colors.white, fontSize: 13, fontWeight: '600' },
  navLabelDisabled: { color: 'rgba(255,255,255,0.4)' },
  doneBtn: { alignItems: 'center', gap: 4 },
  doneBtnText: { color: Colors.accent, fontSize: 16, fontWeight: '800' },

  dots: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: 6, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { backgroundColor: Colors.white, transform: [{ scale: 1.3 }] },
  dotDone: { backgroundColor: 'rgba(255,255,255,0.6)' },
});
