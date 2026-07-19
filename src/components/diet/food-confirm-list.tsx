import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Button, Card, Select } from '@/src/components/ui';
import { getCharacter } from '@/src/content/characters';
import { isClaudeConfigured } from '@/src/services/claude';
import { MEAL_SLOTS } from '@/src/services/food-log';
import { getFoodFromLabel, type ParsedFood } from '@/src/services/food-logging';
import { useUserStore } from '@/src/store/user-store';
import {
  caloriesLabel,
  defaultMode,
  defaultValue,
  measure,
  quantityModes,
  rescaleNutrition,
  toServings,
  type QuantityMode,
} from '@/src/services/food-quantity';
import { colors, fonts, fontSizes, radius, spacing } from '@/src/theme/theme';
import type { FoodItem, MealSlot, ServingUnit } from '@/src/types/user-data';

type FoodConfirmListProps = {
  /** The foods as parsed/estimated — the user gets the last word. */
  foods: ParsedFood[];
  /** Default meal slot for items the parser didn't assign. */
  defaultMeal: MealSlot;
  /** Called with the reviewed foods when the user confirms. */
  onConfirm: (foods: ParsedFood[]) => void;
  /**
   * Called (before onConfirm's foods land) for each confirmed item whose
   * nutrition the user changed from what the database said — the hook
   * for remembering per-barcode fixes. Only fires for items that carry
   * a barcode.
   */
  onCorrection?: (item: FoodItem) => void;
  confirmLabel?: string;
};

/** The editor's measured-in choice — g/ml, or counted in servings only. */
type DraftUnit = ServingUnit | 'none';

/** Editable working copy of one parsed food. */
type DraftFood = {
  name: string;
  calories: string;
  /** How the amount below is expressed — servings, g/ml, whole pack. */
  mode: QuantityMode;
  quantity: string;
  meal: MealSlot;
  /** "Something's not right" panel open? */
  expanded: boolean;
  protein: string;
  carbs: string;
  fats: string;
  servingDesc: string;
  /** The item's measurable identity — all user-fixable. */
  unit: DraftUnit;
  servingQty: string;
  packageQty: string;
  /** Sugar/fiber/sodium transcribed from a label photo (no UI fields). */
  labelExtras?: Partial<FoodItem>;
  /** The NS's one-liner (or error) from the last label read. */
  labelNote?: string;
  base: ParsedFood;
};

/** '' → undefined, junk → undefined, sane number → number. */
function optNum(v: string): number | undefined {
  const trimmed = v.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * The item as the draft currently describes it — every label, measure
 * mode, and conversion reads THIS, so a unit fix immediately reshapes
 * the portion UI. The serving description follows a measure change
 * ("200 ml"); otherwise the original label text is kept.
 */
function draftItem(d: DraftFood): FoodItem {
  const base = d.base.item;
  const calories = Number(d.calories);
  const shared = {
    ...base,
    ...d.labelExtras,
    name: d.name.trim() || base.name,
    caloriesPerServing:
      Number.isFinite(calories) && calories > 0 ? calories : base.caloriesPerServing,
    proteinG: optNum(d.protein),
    carbsG: optNum(d.carbs),
    fatsG: optNum(d.fats),
  };
  if (d.unit === 'none') {
    return {
      ...shared,
      servingDescription: d.servingDesc.trim() || base.servingDescription,
      servingUnit: undefined,
      servingQuantity: undefined,
      packageQuantity: undefined,
    };
  }
  const baseMeasure = measure(base);
  const qty = optNum(d.servingQty);
  const measureChanged = d.unit !== baseMeasure?.unit || qty !== baseMeasure?.servingQty;
  return {
    ...shared,
    servingDescription:
      measureChanged && qty !== undefined ? `${qty} ${d.unit}` : base.servingDescription,
    servingUnit: d.unit,
    servingQuantity: qty,
    packageQuantity: optNum(d.packageQty),
  };
}

/**
 * Did the review change the item's nutritional identity? Measures are
 * compared through measure() so a legacy '100 g' row normalizing into
 * explicit unit fields doesn't read as a user edit.
 */
function itemEdited(edited: FoodItem, original: FoodItem): boolean {
  const em = measure(edited);
  const om = measure(original);
  return (
    edited.name !== original.name ||
    edited.caloriesPerServing !== original.caloriesPerServing ||
    edited.proteinG !== original.proteinG ||
    edited.carbsG !== original.carbsG ||
    edited.fatsG !== original.fatsG ||
    edited.sugarG !== original.sugarG ||
    edited.fiberG !== original.fiberG ||
    edited.sodiumMg !== original.sodiumMg ||
    edited.servingDescription !== original.servingDescription ||
    em?.unit !== om?.unit ||
    em?.servingQty !== om?.servingQty ||
    em?.packageQty !== om?.packageQty
  );
}

/**
 * Review-before-log list used by the photo, barcode, and search flows.
 * AI and database estimates are drafts; the user can rename, fix
 * calories, set the amount in whatever measure the item's data honestly
 * supports (label servings, g/ml, the whole package), switch the meal,
 * or drop an item entirely before anything hits the log.
 */
export function FoodConfirmList({
  foods,
  defaultMeal,
  onConfirm,
  onCorrection,
  confirmLabel = 'Log it',
}: FoodConfirmListProps) {
  const [drafts, setDrafts] = useState<DraftFood[]>([]);
  /** Index currently having its label photo read, if any. */
  const [readingLabel, setReadingLabel] = useState<number | null>(null);
  const nsId = useUserStore((s) => s.nsId);
  const userName = useUserStore((s) => s.name);
  const nsName = nsId ? getCharacter(nsId).name : null;

  useEffect(() => {
    setDrafts(
      foods.map((f) => {
        const mode = defaultMode(f.item);
        const m = measure(f.item);
        return {
          name: f.item.name,
          calories: String(Math.round(f.item.caloriesPerServing)),
          mode,
          quantity: String(defaultValue(mode, f.servings, f.item)),
          meal: f.meal ?? defaultMeal,
          expanded: false,
          protein: f.item.proteinG !== undefined ? String(f.item.proteinG) : '',
          carbs: f.item.carbsG !== undefined ? String(f.item.carbsG) : '',
          fats: f.item.fatsG !== undefined ? String(f.item.fatsG) : '',
          servingDesc: f.item.servingDescription ?? '',
          unit: (m?.unit ?? 'none') as DraftUnit,
          servingQty: m ? String(m.servingQty) : '',
          packageQty: m?.packageQty !== undefined ? String(m.packageQty) : '',
          base: f,
        };
      }),
    );
  }, [foods, defaultMeal]);

  function patch(index: number, part: Partial<DraftFood>) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...part } : d)));
  }

  /** Mode switch — carries the current amount over into the new measure. */
  function switchMode(index: number, mode: QuantityMode) {
    setDrafts((prev) =>
      prev.map((d, i) => {
        if (i !== index || d.mode === mode) return d;
        const item = draftItem(d);
        const servings = toServings(d.mode, Number(d.quantity), item) ?? d.base.servings;
        return { ...d, mode, quantity: String(defaultValue(mode, servings, item)) };
      }),
    );
  }

  /**
   * A measured-in / serving-size fix changes what "one serving" means:
   * nutrition prefills rescale to the new basis (the user overrides
   * with the label's numbers after), and the amount input resets to one
   * serving of the new measure. Rescaling always derives from the BASE
   * item's numbers — never the draft's — so typing "200" digit by digit
   * ("2" → "20" → "200") can't compound rounding, and a bare g↔ml flip
   * (basis quantity unchanged) leaves manual edits alone.
   */
  function patchMeasure(index: number, part: Pick<Partial<DraftFood>, 'unit' | 'servingQty'>) {
    setDrafts((prev) =>
      prev.map((d, i) => {
        if (i !== index) return d;
        const next: DraftFood = { ...d, ...part };
        const newQty = optNum(next.servingQty);
        const baseQty = measure(d.base.item)?.servingQty;
        if (next.unit !== 'none' && newQty !== undefined && newQty !== baseQty) {
          const scaled = rescaleNutrition(d.base.item, newQty);
          next.calories = String(scaled.caloriesPerServing);
          next.protein = scaled.proteinG !== undefined ? String(scaled.proteinG) : next.protein;
          next.carbs = scaled.carbsG !== undefined ? String(scaled.carbsG) : next.carbs;
          next.fats = scaled.fatsG !== undefined ? String(scaled.fatsG) : next.fats;
        }
        const after = draftItem(next);
        next.mode = defaultMode(after);
        next.quantity = String(defaultValue(next.mode, 1, after));
        return next;
      }),
    );
  }

  function removeAt(index: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  /**
   * The database is wrong and the truth is printed on the package: the
   * NS reads a photo of the nutrition label and every field — measure
   * included — takes the label's values. The user still gets the last
   * word before logging, and the fix saves per-barcode like any edit.
   */
  async function readLabel(index: number) {
    if (!nsId) return;
    const picked = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      base64: true,
      quality: 0.8, // label tables are small print — keep them legible
      exif: false,
    });
    const asset = picked.canceled ? undefined : picked.assets[0];
    if (!asset?.base64) return;
    setReadingLabel(index);
    const note = (labelNote: string) =>
      setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, labelNote } : d)));
    try {
      const mediaType =
        asset.mimeType === 'image/png' || asset.mimeType === 'image/webp'
          ? asset.mimeType
          : 'image/jpeg';
      const read = await getFoodFromLabel(
        nsId,
        userName,
        asset.base64,
        mediaType,
        drafts[index]?.name,
      );
      if (!read.item) {
        note(read.reply || "Couldn't read that label — try a closer, sharper shot.");
        return;
      }
      const it = read.item;
      setDrafts((prev) =>
        prev.map((d, i) => {
          if (i !== index) return d;
          const next: DraftFood = {
            ...d,
            calories: String(it.caloriesPerServing),
            protein: it.proteinG !== undefined ? String(it.proteinG) : '',
            carbs: it.carbsG !== undefined ? String(it.carbsG) : '',
            fats: it.fatsG !== undefined ? String(it.fatsG) : '',
            unit: (it.servingUnit ?? 'none') as DraftUnit,
            servingQty: it.servingQuantity !== undefined ? String(it.servingQuantity) : '',
            packageQty: it.packageQuantity !== undefined ? String(it.packageQuantity) : d.packageQty,
            servingDesc: it.servingDescription ?? d.servingDesc,
            labelExtras: { sugarG: it.sugarG, fiberG: it.fiberG, sodiumMg: it.sodiumMg },
            labelNote: read.reply || 'Read it off the label.',
          };
          const after = draftItem(next);
          next.mode = defaultMode(after);
          next.quantity = String(defaultValue(next.mode, 1, after));
          return next;
        }),
      );
    } catch (e) {
      console.error('Label read failed:', e);
      note("Couldn't reach the label reader just now — you can still type the fixes.");
    } finally {
      setReadingLabel(null);
    }
  }

  function handleConfirm() {
    const reviewed: ParsedFood[] = [];
    for (const d of drafts) {
      const calories = Number(d.calories);
      if (!d.name.trim() || !Number.isFinite(calories) || calories <= 0) continue;
      const item = draftItem(d);
      const modes = quantityModes(item);
      const mode = modes.some((o) => o.mode === d.mode) ? d.mode : modes[0].mode;
      const servings = toServings(mode, Number(d.quantity), item) ?? d.base.servings;
      if (item.barcode && itemEdited(item, d.base.item)) onCorrection?.(item);
      reviewed.push({ item, servings, meal: d.meal });
    }
    if (reviewed.length > 0) onConfirm(reviewed);
  }

  if (drafts.length === 0) return null;

  return (
    <View style={styles.container}>
      {drafts.map((draft, i) => {
        const item = draftItem(draft);
        const options = quantityModes(item);
        const option = options.find((o) => o.mode === draft.mode) ?? options[0];
        return (
          <Card key={`${draft.base.item.name}-${i}`} style={styles.card}>
            <View style={styles.nameRow}>
              <TextInput
                value={draft.name}
                onChangeText={(v) => patch(i, { name: v })}
                style={[styles.input, styles.nameInput]}
                testID={`confirm-name-${i}`}
              />
              <Pressable
                onPress={() => removeAt(i)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${draft.name}`}
                style={styles.remove}
                testID={`confirm-remove-${i}`}
              >
                <Ionicons name="close" size={18} color={colors.muted} />
              </Pressable>
            </View>

            <View style={styles.numbersRow}>
              <View style={styles.numberField}>
                <AppText variant="caption" color={colors.muted}>
                  {caloriesLabel(item)}
                </AppText>
                <TextInput
                  value={draft.calories}
                  onChangeText={(v) => patch(i, { calories: v })}
                  style={styles.input}
                  keyboardType="numeric"
                  testID={`confirm-calories-${i}`}
                />
              </View>
              <View style={styles.numberField}>
                <AppText variant="caption" color={colors.muted}>
                  {option.fieldLabel}
                </AppText>
                {option.needsValue ? (
                  <TextInput
                    value={draft.quantity}
                    onChangeText={(v) => patch(i, { quantity: v })}
                    style={styles.input}
                    keyboardType="numeric"
                    testID={`confirm-quantity-${i}`}
                  />
                ) : (
                  <View style={[styles.input, styles.fixedAmount]}>
                    <AppText variant="body" testID={`confirm-fixed-${i}`}>
                      {item.packageQuantity}
                    </AppText>
                  </View>
                )}
              </View>
            </View>

            {options.length > 1 ? (
              <Select
                options={options.map((o) => ({ value: o.mode, label: o.label }))}
                value={draft.mode}
                onChange={(mode) => switchMode(i, mode)}
                label="Measure"
                testID={`confirm-mode-${i}`}
              />
            ) : (
              item.servingDescription &&
              draft.mode === 'servings' && (
                <AppText variant="caption" color={colors.muted}>
                  1 serving = {item.servingDescription}
                </AppText>
              )
            )}

            <Pressable
              onPress={() => patch(i, { expanded: !draft.expanded })}
              accessibilityRole="button"
              style={styles.editToggle}
              testID={`confirm-edit-toggle-${i}`}
            >
              <AppText variant="caption" color={colors.primary}>
                {draft.expanded ? 'Hide the details' : 'Something’s not right? Edit the details'}
              </AppText>
            </Pressable>

            {draft.expanded && (
              <View style={styles.editPanel}>
                <View style={styles.measureRow}>
                  <AppText variant="caption" color={colors.muted}>
                    measured in
                  </AppText>
                  {(
                    [
                      ['g', 'g'],
                      ['ml', 'ml'],
                      ['none', 'servings'],
                    ] as const
                  ).map(([value, label]) => (
                    <Pressable
                      key={value}
                      onPress={() => patchMeasure(i, { unit: value })}
                      style={[styles.mealChip, draft.unit === value && styles.mealChipActive]}
                      testID={`confirm-unit-${value}-${i}`}
                    >
                      <AppText
                        variant="caption"
                        color={draft.unit === value ? colors.text : colors.muted}
                      >
                        {label}
                      </AppText>
                    </Pressable>
                  ))}
                </View>

                {draft.unit === 'none' ? (
                  <View style={styles.numberField}>
                    <AppText variant="caption" color={colors.muted}>
                      serving size
                    </AppText>
                    <TextInput
                      value={draft.servingDesc}
                      onChangeText={(v) => patch(i, { servingDesc: v })}
                      placeholder="e.g. 1 bar, 1 plate"
                      placeholderTextColor={colors.muted}
                      style={styles.input}
                      testID={`confirm-servingdesc-${i}`}
                    />
                  </View>
                ) : (
                  <View style={styles.numbersRow}>
                    <View style={styles.numberField}>
                      <AppText variant="caption" color={colors.muted}>
                        1 serving = ({draft.unit})
                      </AppText>
                      <TextInput
                        value={draft.servingQty}
                        onChangeText={(v) => patchMeasure(i, { servingQty: v })}
                        placeholder="e.g. 200"
                        placeholderTextColor={colors.muted}
                        style={styles.input}
                        keyboardType="numeric"
                        testID={`confirm-servingqty-${i}`}
                      />
                    </View>
                    <View style={styles.numberField}>
                      <AppText variant="caption" color={colors.muted}>
                        whole pack ({draft.unit})
                      </AppText>
                      <TextInput
                        value={draft.packageQty}
                        onChangeText={(v) => patch(i, { packageQty: v })}
                        placeholder="Optional"
                        placeholderTextColor={colors.muted}
                        style={styles.input}
                        keyboardType="numeric"
                        testID={`confirm-packageqty-${i}`}
                      />
                    </View>
                  </View>
                )}

                <View style={styles.numbersRow}>
                  {(
                    [
                      ['protein', 'protein g', draft.protein],
                      ['carbs', 'carbs g', draft.carbs],
                      ['fats', 'fat g', draft.fats],
                    ] as const
                  ).map(([key, label, value]) => (
                    <View key={key} style={styles.numberField}>
                      <AppText variant="caption" color={colors.muted}>
                        {label}
                      </AppText>
                      <TextInput
                        value={value}
                        onChangeText={(v) => patch(i, { [key]: v })}
                        style={styles.input}
                        keyboardType="numeric"
                        testID={`confirm-${key}-${i}`}
                      />
                    </View>
                  ))}
                </View>
                {!!draft.base.item.barcode && nsName && isClaudeConfigured() && (
                  readingLabel === i ? (
                    <AppText variant="caption" color={colors.muted} testID={`confirm-label-busy-${i}`}>
                      {nsName} is reading the label…
                    </AppText>
                  ) : (
                    <Button
                      label={`Photograph the label — ${nsName} reads it`}
                      variant="secondary"
                      onPress={() => void readLabel(i)}
                      disabled={readingLabel !== null}
                      testID={`confirm-label-${i}`}
                    />
                  )
                )}
                {!!draft.labelNote && (
                  <AppText variant="caption" color={colors.muted} testID={`confirm-labelnote-${i}`}>
                    {draft.labelNote}
                  </AppText>
                )}
                {!!draft.base.item.barcode && (
                  <AppText variant="caption" color={colors.muted}>
                    Your fixes are saved for this barcode — next scan uses them.
                  </AppText>
                )}
              </View>
            )}

            <View style={styles.mealRow}>
              {MEAL_SLOTS.map((slot) => (
                <Pressable
                  key={slot}
                  onPress={() => patch(i, { meal: slot })}
                  style={[styles.mealChip, draft.meal === slot && styles.mealChipActive]}
                  testID={`confirm-meal-${slot}-${i}`}
                >
                  <AppText
                    variant="caption"
                    color={draft.meal === slot ? colors.text : colors.muted}
                  >
                    {slot}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </Card>
        );
      })}

      <Button label={confirmLabel} onPress={handleConfirm} testID="confirm-log" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  card: {
    gap: spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  nameInput: {
    flex: 1,
  },
  remove: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numbersRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  numberField: {
    flex: 1,
    gap: spacing.xs,
  },
  input: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: fontSizes.body,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  fixedAmount: {
    justifyContent: 'center',
  },
  editToggle: {
    alignSelf: 'flex-start',
  },
  editPanel: {
    gap: spacing.sm,
  },
  measureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  mealRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  mealChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  mealChipActive: {
    borderColor: colors.primary,
  },
});
