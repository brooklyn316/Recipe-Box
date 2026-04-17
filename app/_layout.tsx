import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initDb } from '@/lib/db';
import { Colors } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    async function setup() {
      try {
        await initDb();
      } catch (e) {
        console.error('DB init error:', e);
      } finally {
        await SplashScreen.hideAsync();
      }
    }
    setup();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" backgroundColor={Colors.background} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.primary,
          headerTitleStyle: { fontWeight: '700', color: Colors.text },
          contentStyle: { backgroundColor: Colors.background },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="ocr"
          options={{
            title: 'Scan Recipe',
            presentation: 'modal',
            headerStyle: { backgroundColor: Colors.text },
            headerTintColor: Colors.white,
            headerTitleStyle: { color: Colors.white },
          }}
        />
        <Stack.Screen
          name="recipe/[id]"
          options={{ title: 'Recipe', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="recipe/edit/[id]"
          options={{ title: 'Edit Recipe', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="recipe/new"
          options={{ title: 'New Recipe', headerBackTitle: 'Back' }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
