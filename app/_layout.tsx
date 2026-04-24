import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { initDb } from '../lib/db';
import { Colors } from '../lib/theme';

function handleIncomingUrl(url: string | null, isReady: boolean) {
  if (!url || !isReady) return;
  // Handle .recipebox files opened via AirDrop / Files / Share Sheet
  if (url.includes('.recipebox') || url.includes('recipebox')) {
    router.push({
      pathname: '/import-recipe',
      params: { fileUri: encodeURIComponent(url) },
    });
  }
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initDb()
      .then(() => setReady(true))
      .catch((err) => {
        console.error('DB init failed:', err);
        setReady(true);
      });
  }, []);

  // Handle file opened while app was already running
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleIncomingUrl(url, ready);
    });
    return () => subscription.remove();
  }, [ready]);

  // Handle file opened to launch the app cold
  useEffect(() => {
    if (!ready) return;
    Linking.getInitialURL().then((url) => {
      handleIncomingUrl(url, true);
    });
  }, [ready]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
