import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { FoodConfirmList } from '@/src/components/diet';
import { AppText, Card, Screen } from '@/src/components/ui';
import { searchFoods } from '@/src/services/food-database';
import { makeFoodLogId, MEAL_SLOTS, todayLocalISODate } from '@/src/services/food-log';
import type { ParsedFood } from '@/src/services/food-logging';
import { useUserDataStore } from '@/src/store/user-data-store';
import { colors, fonts, fontSizes, radius, spacing } from '@/src/theme/theme';
import type { FoodItem, MealSlot } from '@/src/types/user-data';

function asMealSlot(value: string | undefined): MealSlot {
  return (MEAL_SLOTS as readonly string[]).includes(value ?? '')
    ? (value as MealSlot)
    : 'snack';
}

/**
 * Food database search (Open Food Facts). Type → search → pick a result
 * → review servings/meal → log. Results are per-100g, so the confirm
 * step is where portions get real.
 */
export default function FoodSearchScreen() {
  const { meal: mealParam } = useLocalSearchParams<{ meal?: string }>();
  const logFood = useUserDataStore((s) => s.logFood);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<FoodItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<FoodItem | null>(null);

  async function handleSearch() {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setError(null);
    setPicked(null);
    try {
      setResults(await searchFoods(q));
    } catch (e) {
      setResults(null);
      setError(e instanceof Error ? e.message : 'Search failed.');
    } finally {
      setSearching(false);
    }
  }

  function handleConfirm(foods: ParsedFood[]) {
    for (const parsed of foods) {
      logFood({
        id: makeFoodLogId(),
        loggedAt: Date.now(),
        forDate: todayLocalISODate(),
        meal: parsed.meal ?? asMealSlot(mealParam),
        source: 'database',
        servings: parsed.servings,
        item: parsed.item,
      });
    }
    router.back();
  }

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.backButton}
            testID="search-back"
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <AppText variant="title">Search foods</AppText>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="e.g. peanut butter"
            placeholderTextColor={colors.muted}
            style={styles.input}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            autoCorrect={false}
            testID="search-input"
          />
          <Pressable
            onPress={handleSearch}
            accessibilityRole="button"
            accessibilityLabel="Search"
            style={styles.searchButton}
            testID="search-go"
          >
            {searching ? (
              <ActivityIndicator size="small" color={colors.base} />
            ) : (
              <Ionicons name="search" size={20} color={colors.base} />
            )}
          </Pressable>
        </View>

        {error && (
          <Card style={styles.errorCard}>
            <AppText variant="caption" color={colors.warning}>
              {error} You can still add the food manually.
            </AppText>
          </Card>
        )}

        {picked ? (
          <FoodConfirmList
            foods={[{ item: picked, servings: 1 }]}
            defaultMeal={asMealSlot(mealParam)}
            onConfirm={handleConfirm}
          />
        ) : (
          results !== null &&
          (results.length === 0 ? (
            <AppText variant="caption" color={colors.muted}>
              Nothing found for that. Try a simpler term, or add it manually.
            </AppText>
          ) : (
            results.map((item, i) => (
              <Pressable
                key={`${item.barcode ?? item.name}-${i}`}
                onPress={() => setPicked(item)}
                accessibilityRole="button"
                testID={`search-result-${i}`}
              >
                <Card style={styles.resultCard}>
                  <AppText variant="body">{item.name}</AppText>
                  <AppText variant="caption" color={colors.muted}>
                    {[item.brand, `${item.caloriesPerServing} kcal / 100 g`]
                      .filter(Boolean)
                      .join(' · ')}
                  </AppText>
                </Card>
              </Pressable>
            ))
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  backButton: {
    padding: spacing.xs,
  },
  searchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: fontSizes.body,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 4,
  },
  searchButton: {
    width: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    borderColor: colors.warning,
  },
  resultCard: {
    gap: 2,
  },
});
