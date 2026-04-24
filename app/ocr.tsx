import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Image,
  ScrollView, ActivityIndicator, Alert, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { recognizeText, parseOcrDraft, scrapeRecipeFromUrl } from '@/lib/ocr';
import { Colors, Spacing, Radius, Typography } from '@/lib/theme';

type Stage = 'pick' | 'processing' | 'preview' | 'link';

export default function OcrScreen() {
  const [imageUris, setImageUris]   = useState<string[]>([]);
  const [allRawText, setAllRawText] = useState('');
  const [stage, setStage]           = useState<Stage>('pick');
  const [confidence, setConf]       = useState<'high' | 'medium' | 'low'>('low');
  const [linkUrl, setLinkUrl]       = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [pasteText, setPasteText]   = useState('');
  const [showPaste, setShowPaste]   = useState(false);

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
      mediaTypes: ['images'],
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
      mediaTypes: ['images'],
      quality: 0.9,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      await processImage(result.assets[0].uri);
    }
  };

  // ── Run OCR and accumulate text ────────────────────────────────────────────
  const processImage = async (uri: string) => {
    setStage('processing');
    try {
      const savedUri  = await persistImage(uri);
      const ocrResult = await recognizeText(savedUri);
      setImageUris(prev => [...prev, savedUri]);
      setAllRawText(prev => prev ? prev + '\n\n' + ocrResult.rawText : ocrResult.rawText);
      setConf(ocrResult.confidence);
      setStage('preview');
    } catch (err) {
      console.error(err);
      Alert.alert('OCR Error', 'Could not read the image. Please try again with a clearer photo.');
      setStage('pick');
    }
  };

  // ── Add another photo ──────────────────────────────────────────────────────
  const handleAddAnother = () => {
    setStage('pick');
  };

  // ── Import from link ───────────────────────────────────────────────────────
  const handleLinkImport = async () => {
    const url = linkUrl.trim();
    if (!url.startsWith('http')) {
      Alert.alert('Invalid Link', 'Please paste a full web address starting with https://');
      return;
    }
    setLinkLoading(true);
    try {
      const draft = await scrapeRecipeFromUrl(url);
      router.replace({
        pathname: '/recipe/new',
        params: { draft: JSON.stringify(draft), imageUri: '' },
      });
    } catch (err: any) {
      Alert.alert('Could Not Import', err.message ?? 'Something went wrong.');
    } finally {
      setLinkLoading(false);
    }
  };

  // ── Import from pasted text ────────────────────────────────────────────────
  const handlePasteImport = () => {
    const text = pasteText.trim();
    if (!text) return;
    const draft = parseOcrDraft(text);
    setPasteText('');
    setShowPaste(false);
    router.replace({
      pathname: '/recipe/new',
      params: { draft: JSON.stringify(draft), imageUri: '' },
    });
  };

  // ── Navigate to form with all combined text ────────────────────────────────
  const handleContinue = () => {
    const draft = parseOcrDraft(allRawText);
    router.replace({
      pathname: '/recipe/new',
      params: {
        draft: JSON.stringify(draft),
        imageUri: imageUris[0] ?? '',
      },
    });
  };

  const handleRetry = () => {
    setImageUris([]);
    setAllRawText('');
    setStage('pick');
  };

  // ── Pick screen ────────────────────────────────────────────────────────────
  if (stage === 'pick') {
    const isAddingMore = imageUris.length > 0;

    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={80}
      >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Back button */}
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>

        <View style={styles.hero}>
          <Ionicons name="camera-outline" size={64} color={Colors.primary} />
          <Text style={styles.heroTitle}>
            {isAddingMore ? `Page ${imageUris.length + 1}` : 'Add a Recipe'}
          </Text>
          {isAddingMore && (
            <View style={styles.pageCountBadge}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.accent} />
              <Text style={styles.pageCountText}>
                {imageUris.length} page{imageUris.length > 1 ? 's' : ''} scanned
              </Text>
            </View>
          )}
        </View>

        {/* Camera / Gallery */}
        <View style={styles.optionCard}>
          <Text style={styles.optionHeading}>
            {isAddingMore ? '📷  Scan the next page' : '📷  Photo of a recipe page'}
          </Text>
          <Text style={styles.optionDesc}>
            {isAddingMore
              ? 'Take another photo to continue scanning. All pages will be combined automatically.'
              : 'Take a photo of any cookbook or magazine page — the app will read the text and fill in the form.'}
          </Text>
          <View style={styles.btnGroup}>
            <Pressable style={styles.primaryBtn} onPress={handleCamera}>
              <Ionicons name="camera" size={20} color={Colors.white} />
              <Text style={styles.primaryBtnText}>Take Photo</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={handleGallery}>
              <Ionicons name="images-outline" size={20} color={Colors.primary} />
              <Text style={styles.secondaryBtnText}>Choose from Gallery</Text>
            </Pressable>
          </View>

          {!isAddingMore && (
            <View style={styles.tipsBox}>
              <Text style={styles.tipsHeading}>📸  Tips for best results</Text>
              <Text style={styles.tipLine}>• Lay the book flat so the page isn't curved</Text>
              <Text style={styles.tipLine}>• Use bright, even lighting — avoid shadows across the text</Text>
              <Text style={styles.tipLine}>• Hold the phone directly above the page (not at an angle)</Text>
              <Text style={styles.tipLine}>• Get close enough so the text fills most of the frame</Text>
              <Text style={styles.tipLine}>• Small fractions like ¼ and ½ read best in bright light</Text>
            </View>
          )}

          {!isAddingMore && (
            <Text style={styles.tip}>
              💡 For Instagram or TikTok: take a screenshot on your phone, then tap "Choose from Gallery"
            </Text>
          )}

          {isAddingMore && (
            <Pressable style={styles.secondaryBtn} onPress={() => setStage('preview')}>
              <Ionicons name="checkmark-outline" size={20} color={Colors.primary} />
              <Text style={styles.secondaryBtnText}>I'm done — Continue to form</Text>
            </Pressable>
          )}
        </View>

        {/* Paste text import — only show on first page */}
        {!isAddingMore && (
          <View style={styles.optionCard}>
            <Text style={styles.optionHeading}>📋  Paste recipe text</Text>
            <Text style={styles.optionDesc}>
              Great for Facebook posts, Instagram captions, or anything you can copy and paste.
            </Text>
            {!showPaste ? (
              <Pressable style={styles.secondaryBtn} onPress={() => setShowPaste(true)}>
                <Ionicons name="clipboard-outline" size={20} color={Colors.primary} />
                <Text style={styles.secondaryBtnText}>Paste Recipe Text</Text>
              </Pressable>
            ) : (
              <>
                <TextInput
                  style={styles.pasteInput}
                  value={pasteText}
                  onChangeText={setPasteText}
                  placeholder={"Paste the recipe text here…\n\nWorks with Facebook posts, Instagram captions, or any copied text."}
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  autoCorrect={false}
                  autoCapitalize="sentences"
                  textAlignVertical="top"
                />
                <View style={styles.btnGroup}>
                  <Pressable
                    style={[styles.primaryBtn, !pasteText.trim() && styles.btnDisabled]}
                    onPress={handlePasteImport}
                    disabled={!pasteText.trim()}
                  >
                    <Ionicons name="create-outline" size={20} color={Colors.white} />
                    <Text style={styles.primaryBtnText}>Parse Recipe →</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryBtn} onPress={() => { setShowPaste(false); setPasteText(''); }}>
                    <Text style={styles.secondaryBtnText}>Cancel</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        )}

        {/* Link import — only show on first page */}
        {!isAddingMore && (
          <View style={styles.optionCard}>
            <Text style={styles.optionHeading}>🔗  Paste a website link</Text>
            <Text style={styles.optionDesc}>
              Works with most recipe websites — Taste.com.au, BBC Good Food, AllRecipes, Dish, and many more.
            </Text>
            <TextInput
              style={styles.linkInput}
              value={linkUrl}
              onChangeText={setLinkUrl}
              placeholder="https://www.taste.com.au/recipes/..."
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={handleLinkImport}
            />
            <Pressable
              style={[styles.primaryBtn, (!linkUrl.trim() || linkLoading) && styles.btnDisabled]}
              onPress={handleLinkImport}
              disabled={!linkUrl.trim() || linkLoading}
            >
              {linkLoading
                ? <ActivityIndicator color={Colors.white} size="small" />
                : <><Ionicons name="download-outline" size={20} color={Colors.white} /><Text style={styles.primaryBtnText}>Import Recipe</Text></>
              }
            </Pressable>
          </View>
        )}

        {/* Manual — only show on first page */}
        {!isAddingMore && (
          <Pressable style={styles.manualBtn} onPress={() => router.push('/recipe/new')}>
            <Ionicons name="create-outline" size={18} color={Colors.accent} />
            <Text style={styles.manualBtnText}>Type recipe in manually</Text>
          </Pressable>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (stage === 'processing') {
    return (
      <View style={styles.centred}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.processingText}>
          Reading page {imageUris.length + 1}…
        </Text>
        <Text style={styles.processingSubtext}>This takes just a moment</Text>
      </View>
    );
  }

  // Preview stage
  return (
    <View style={styles.scroll}>
      <ScrollView contentContainerStyle={styles.previewContent}>

        {/* Photo thumbnails */}
        {imageUris.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbScroll}>
            {imageUris.map((uri, i) => (
              <View key={uri} style={styles.thumbWrap}>
                <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
                <Text style={styles.thumbLabel}>Page {i + 1}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Page count */}
        <View style={styles.pageCountBadge}>
          <Ionicons name="documents-outline" size={16} color={Colors.accent} />
          <Text style={styles.pageCountText}>
            {imageUris.length} page{imageUris.length > 1 ? 's' : ''} scanned — text combined
          </Text>
        </View>

        <View style={[styles.confidenceBadge, styles[`conf_${confidence}`]]}>
          <Ionicons
            name={confidence === 'high' ? 'checkmark-circle' : confidence === 'medium' ? 'warning' : 'alert-circle'}
            size={16} color={Colors.white}
          />
          <Text style={styles.confidenceText}>
            {confidence === 'high'   ? 'Good scan — text looks clear' :
             confidence === 'medium' ? 'Partial scan — check the form carefully' :
                                       'Low confidence — you may need to fill in details manually'}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Extracted Text Preview</Text>
        <View style={styles.textBox}>
          <Text style={styles.rawText} selectable>
            {allRawText || '(No text detected — try a clearer photo)'}
          </Text>
        </View>

        <Text style={styles.hint}>
          Need to scan more pages? Tap <Text style={{ fontWeight: '700' }}>Scan Another Page</Text> to add more.
          Otherwise tap <Text style={{ fontWeight: '700' }}>Continue</Text> when you're done.
        </Text>

        {/* Scan another page */}
        <Pressable style={styles.secondaryBtn} onPress={handleAddAnother}>
          <Ionicons name="camera-outline" size={20} color={Colors.primary} />
          <Text style={styles.secondaryBtnText}>Scan Another Page</Text>
        </Pressable>

        <Pressable style={styles.primaryBtn} onPress={handleContinue}>
          <Ionicons name="create-outline" size={20} color={Colors.white} />
          <Text style={styles.primaryBtnText}>Continue to Edit Form →</Text>
        </Pressable>

        <Pressable style={styles.retryBtn} onPress={handleRetry}>
          <Ionicons name="refresh-outline" size={18} color={Colors.textMuted} />
          <Text style={styles.retryText}>Start over</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  container: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 60 },
  centred: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },

  backBtn: { paddingTop: 56, paddingLeft: Spacing.md, paddingBottom: Spacing.sm, alignSelf: 'flex-start' },
  hero: { alignItems: 'center', paddingTop: Spacing.sm, paddingBottom: Spacing.sm, gap: Spacing.sm },
  heroTitle: { ...Typography.h1 },

  pageCountBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.accentLight, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'center',
  },
  pageCountText: { fontSize: 13, fontWeight: '600', color: Colors.accent },

  optionCard: {
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.sm,
  },
  optionHeading: { fontSize: 16, fontWeight: '700', color: Colors.text },
  optionDesc: { ...Typography.body, color: Colors.textMuted, lineHeight: 22 },

  btnGroup: { gap: Spacing.sm },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 13, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  secondaryBtn: {
    backgroundColor: Colors.white, borderRadius: Radius.md,
    paddingVertical: 13, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  btnDisabled: { opacity: 0.45 },

  tip: { ...Typography.small, lineHeight: 18, color: Colors.textMuted },

  tipsBox: {
    backgroundColor: Colors.accentLight, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.accent,
    padding: Spacing.sm, gap: 4,
  },
  tipsHeading: { fontSize: 13, fontWeight: '700', color: Colors.accent, marginBottom: 2 },
  tipLine: { fontSize: 13, color: Colors.text, lineHeight: 20 },

  linkInput: {
    backgroundColor: Colors.background, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: 14, color: Colors.text,
  },
  pasteInput: {
    backgroundColor: Colors.background, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: 14, color: Colors.text,
    minHeight: 160, textAlignVertical: 'top',
  },

  manualBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: Spacing.sm,
  },
  manualBtnText: { fontSize: 14, color: Colors.accent, fontWeight: '600' },

  processingText: { ...Typography.h3, textAlign: 'center', marginTop: Spacing.lg },
  processingSubtext: { ...Typography.body, textAlign: 'center', color: Colors.textMuted, marginTop: 4 },

  previewContent: { padding: Spacing.md, gap: Spacing.md },

  thumbScroll: { marginBottom: 4 },
  thumbWrap: { marginRight: Spacing.sm, alignItems: 'center' },
  thumb: { width: 120, height: 160, borderRadius: Radius.md },
  thumbLabel: { fontSize: 12, color: Colors.textMuted, marginTop: 4, fontWeight: '600' },

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
