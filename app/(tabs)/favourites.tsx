import React, { useCallback, useState } from 'react';
import { View, FlatList, Text, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getFavourites, toggleFavourite } from '@/lib/db';
import { Recipe } from '@/lib/types';
import { RecipeCard } from '@/components/RecipeCard';
import { Colors, Spacing, Typography } from '@/lib/theme';

export default function FavouritesScreen() {
  const [recipes, setRecipes]       = useState<Recipe[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const data = await getFavourites();
    setRecipes(data);
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const onToggle = async (id: number) => { await toggleFavourite(id); await load(); };

  return (
    <View style={styles.container}>
      <FlatList
        data={recipes}
        keyExtractor={(r) => String(r.id)}
        renderItem={({ item }) => <RecipeCard recipe={item} onToggleFavourite={onToggle} />}
        contentContainerStyle={recipes.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="heart-outline" size={64} color={Colors.border} />
            <Text style={styles.emptyTitle}>No favourites yet</Text>
            <Text style={styles.emptyBody}>Tap the heart on any recipe to save it here.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { paddingVertical: Spacing.sm, paddingBottom: 40 },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16, marginTop: 80 },
  emptyTitle: { ...Typography.h2, textAlign: 'center' },
  emptyBody: { ...Typography.body, textAlign: 'center', color: Colors.textMuted },
});
