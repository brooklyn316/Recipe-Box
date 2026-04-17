import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Image,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { recognizeText, parseOcrDraft } from '@/lib/ocr';
import { Colors, Spacing, Radius, Typography } from '@/lib/theme';

type Stage = 'pick' | 'processing' | 'preview';

export default function OcrScreen() {
  const [imageUri, setImageUri]   = useState<string | null>(null);
  const [rawText, setRawText]     = useState('');
  const [stage, setStage]         = useState<Stage>('pick');
  const [confidence, setConf]     = useState<'high' | 'medium' | 'low'>('low');

  // ── Copy image to app documents so it persists ─────────────────────────────
  const persistImage = async (uri: string): Promise<string> => {
    const dir = FileSystem.documentDirectory + 'recipe-photos/';
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const fileName = `recipe-${Date.now()}.jpg`;
    const dest = dir + fileName;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  };

  // ── Capture from camera ────────────────────────────────────────────────────
  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera Permission', 'Please allow camera access in Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      await processImage(result.assets[0].uri);
    }
  };

  // ── Import from gallery ────────────────────────────────────────────────────
  const handleGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      await processImage(result.assets[0].uri);
    }
  };

  // ── Run OCR ────────────────────────────────────────────────────────────────
  const processImage = async (uri: string) => {
    setStage('processing');
    try {
      const savedUri   = await persistImage(uri);
      const ocrResult  = await recognizeText(savedUri);
      setImageUri(savedUri);
      setRawText(ocrResult.rawText);
      setConf(ocrResult.confidence);
      setStage('preview');
    } catch (err) {
      console.error(err);
      Alert.alert('OCR Error', 'Could not read the image. Please try again with a clearer photo.');
      setStage('pick');
    }
  };

  // ── Navigate to form with parsed draft ────────────────────────────────────
  const handleContinue = () => {
    const draft = parseOcrDraft(rawText);
    // Pass draft via router params (serialized)
    router.push({
      pathname: '/recipe/new',
      params: {
        draft: JSON.stringify(draft),
        imageUri: imageUri ?? '',
      },
    });
  };

  const handleRetry = () => {
    setImageUri(null);
    setRawText('');
    setStage('pick');
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (stage === 'pick') {
    return (
      <View style={styles.container}>
        <View style={styles.hero}>
          <Ionicons name="camera-outline" size={80} color={Colors.primary} />
          <Text style={styles.heroTitle}>Scan a Recipe</Text>
          <Text style={styles.heroBody}>
            Take a photo of any recipe page — from a cookbook, magazine, or handwritten card.
            The app will read the text and fill in the form for you.
          </Text>
        </View>

        <View style={styles.btnGroup}>
          <Pressable style={styles.primaryBtn} onPress={handleCamera}>
            <Ionicons name="camera" size={22} color={Colors.white} />
            <Text style={styles.primaryBtnText}>Take Photo</Text>
          </Pressable>

          <Pressable style={styles.secondaryBtn} onPress={handleGallery}>
            <Ionicons name="images-outline" size={22} color={Colors.primary} />
            <Text style={styles.secondaryBtnText}>Import from Gallery</Text>
          </Pressable>
        </View>

        <Text style={styles.tip}>
          💡 Tip: For best results, lay the book flat in good light and keep the camera parallel to the page.
        </Text>
      </View>
    );
  }

  if (stage === 'processing') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.processingText}>Reading recipe text…</Text>
        <Text style={styles.processingSubtext}>This takes just a moment</Text>
      </View>
    );
  }

  // Preview stage
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.previewContent}>
        {/* Photo thumbnail */}
        {imageUri && (
          <Image source={{ uri: imageUri }} style={styles.thumb} resizeMode="cover" />
        )}

        {/* Confidence indicator */}
        <View style={[styles.confidenceBadge, styles[`conf_${confidence}`]]}>
          <Ionicons
            name={confidence === 'high' ? 'checkmark-circle' : confidence === 'medium' ? 'warning' : 'alert-circle'}
            size={16}
            color={Colors.white}
          />
          <Text style={styles.confidenceText}>
            {confidence === 'high'   ? 'Good scan — text looks clear' :
             confidence === 'medium' ? 'Partial scan — check the form carefully' :
                                       'Low confidence — you may need to fill in details manually'}
          </Text>
        </View>

        {/* Raw text preview */}
        <Text style={styles.sectionLabel}>Extracted Text Preview</Text>
        <View style={styles.textBox}>
          <Text style={styles.rawText} selectable>
            {rawText || '(No text detected — try a clearer photo)'}
          </Text>
        </View>

        <Text style={styles.hint}>
          Tap <Text style={{ fontWeight: '700' }}>Continue</Text> to review and edit the recipe before saving.
          The original photo will be saved alongside the recipe.
        </Text>

        <Pressable style={styles.primaryBtn} onPress={handleContinue}>
          <Ionicons name="create-outline" size={20} color={Colors.white} />
          <Text style={styles.primaryBtnText}>Continue to Edit Form →</Text>
        </Pressable>

        <Pressable style={styles.retryBtn} onPress={handleRetry}>
          <Ionicons name="refresh-outline" size={18} color={Colors.textMuted} />
          <Text style={styles.retryText}>Scan a different photo</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center' },
  hero: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.md },
  heroTitle: { ...Typography.h1, textAlign: 'center' },
  heroBody:  { ...Typography.body, textAlign: 'center', color: Colors.textMuted, lineHeight: 24 },

  btnGroup: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 15, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: Colors.white },
  secondaryBtn: {
    backgroundColor: Colors.white, borderRadius: Radius.md,
    paddingVertical: 15, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  secondaryBtnText: { fontSize: 16, fontWeight: '700', color: Colors.primary },

  tip: { ...Typography.small, textAlign: 'center', padding: Spacing.xl, lineHeight: 20 },

  processingText: { ...Typography.h3, textAlign: 'center', marginTop: Spacing.lg },
  processingSubtext: { ...Typography.body, textAlign: 'center', color: Colors.textMuted, marginTop: 4 },

  previewContent: { padding: Spacing.md, gap: Spacing.md },
  thumb: { width: '100%', height: 180, borderRadius: Radius.md },

  confidenceBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: Radius.md, padding: Spacing.sm,
  },
  conf_high:   { backgroundColor: Colors.accent },
  conf_medium: { backgroundColor: Colors.warning },
  conf_low:    { backgroundColor: Colors.danger },
  confidenceText: { color: Colors.white, fontSize: 13, fontWeight: '600', flex: 1 },

  sectionLabel: { ...Typography.label },
  textBox: {
    backgroundColor: Colors.white, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, maxHeight: 200,
  },
  rawText: { fontSize: 13, color: Colors.text, lineHeight: 20 },
  hint: { ...Typography.small, lineHeight: 20, textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: Spacing.sm,
  },
  retryText: { fontSize: 14, color: Colors.textMuted },
});
