import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  categories,
  convert,
  defaultSelections,
  formatNumber,
  getCategory,
  parseNumericInput,
  type CategoryId,
  type UnitDefinition,
} from '../lib/conversions';

function UnitChoices({
  units,
  selected,
  onSelect,
}: {
  units: readonly UnitDefinition[];
  selected: string;
  onSelect: (unitId: string) => void;
}) {
  return (
    <View style={styles.unitGrid}>
      {units.map((unit) => {
        const active = unit.id === selected;
        return (
          <Pressable
            key={unit.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${unit.name}, ${unit.symbol}`}
            onPress={() => onSelect(unit.id)}
            style={({ pressed }) => [
              styles.unitButton,
              active && styles.unitButtonSelected,
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.unitSymbol, active && styles.unitSymbolSelected]}>
              {unit.symbol}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.unitName, active && styles.unitNameSelected]}>
              {unit.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ConverterApp() {
  const [categoryId, setCategoryId] = useState<CategoryId>('length');
  const [fromUnit, setFromUnit] = useState(defaultSelections.length.from);
  const [toUnit, setToUnit] = useState(defaultSelections.length.to);
  const [input, setInput] = useState('1');

  const category = getCategory(categoryId);
  const parsedInput = parseNumericInput(input);
  const result = useMemo(
    () =>
      parsedInput === null
        ? null
        : convert(parsedInput, categoryId, fromUnit, toUnit),
    [categoryId, fromUnit, parsedInput, toUnit],
  );
  const oneUnitResult = convert(1, categoryId, fromUnit, toUnit);
  const from = category.units.find((unit) => unit.id === fromUnit)!;
  const to = category.units.find((unit) => unit.id === toUnit)!;

  const chooseCategory = (nextCategory: CategoryId) => {
    const defaults = defaultSelections[nextCategory];
    setCategoryId(nextCategory);
    setFromUnit(defaults.from);
    setToUnit(defaults.to);
    setInput('1');
  };

  const swap = () => {
    if (result !== null) {
      setInput(formatNumber(result));
    }
    setFromUnit(toUnit);
    setToUnit(fromUnit);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>UNIT CONVERTER</Text>
          <Text style={styles.heading}>Convert without the clutter.</Text>
          <Text style={styles.subtitle}>Offline, deterministic, and quick to leave.</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}>
            {categories.map((candidate) => {
              const active = candidate.id === categoryId;
              return (
                <Pressable
                  key={candidate.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => chooseCategory(candidate.id)}
                  style={({ pressed }) => [
                    styles.categoryButton,
                    active && styles.categoryButtonSelected,
                    pressed && styles.pressed,
                  ]}>
                  <Text
                    style={[
                      styles.categoryText,
                      active && styles.categoryTextSelected,
                    ]}>
                    {candidate.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.valuePanel}>
            <Text style={styles.fieldLabel}>FROM</Text>
            <View style={styles.valueRow}>
              <TextInput
                accessibilityLabel="Value to convert"
                keyboardType="decimal-pad"
                onChangeText={setInput}
                selectTextOnFocus
                style={styles.valueInput}
                value={input}
              />
              <Text style={styles.valueUnit}>{from.symbol}</Text>
            </View>
            <Text style={styles.valueName}>{from.name}</Text>

            <View style={styles.resultDivider} />

            <Text style={styles.fieldLabel}>TO</Text>
            <View style={styles.valueRow}>
              <Text
                accessibilityLabel="Converted value"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={styles.resultValue}>
                {result === null ? '—' : formatNumber(result)}
              </Text>
              <Text style={styles.valueUnit}>{to.symbol}</Text>
            </View>
            <Text style={styles.valueName}>{to.name}</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Swap units"
            onPress={swap}
            style={({ pressed }) => [styles.swapButton, pressed && styles.pressed]}>
            <Text style={styles.swapText}>⇅ Swap units</Text>
          </Pressable>

          <View style={styles.selectionSection}>
            <Text style={styles.selectionHeading}>From</Text>
            <UnitChoices
              units={category.units}
              selected={fromUnit}
              onSelect={setFromUnit}
            />
          </View>

          <View style={styles.selectionSection}>
            <Text style={styles.selectionHeading}>To</Text>
            <UnitChoices
              units={category.units}
              selected={toUnit}
              onSelect={setToUnit}
            />
          </View>

          <Text style={styles.equivalence}>
            1 {from.symbol} = {formatNumber(oneUnitResult)} {to.symbol}
          </Text>
          <Text style={styles.footer}>
            Currency is excluded because exchange rates are not fixed units.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#f5f3ed' },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 48,
  },
  eyebrow: {
    color: '#657067',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  heading: {
    color: '#1f2921',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 39,
    marginTop: 8,
  },
  subtitle: {
    color: '#687068',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 7,
  },
  categoryRow: {
    gap: 8,
    paddingTop: 22,
    paddingBottom: 4,
  },
  categoryButton: {
    borderColor: '#cfd3cc',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  categoryButtonSelected: {
    backgroundColor: '#243c2b',
    borderColor: '#243c2b',
  },
  categoryText: { color: '#687068', fontSize: 13, fontWeight: '700' },
  categoryTextSelected: { color: '#ffffff' },
  valuePanel: {
    borderColor: '#d7d9d2',
    borderWidth: 1,
    borderRadius: 22,
    backgroundColor: '#faf9f5',
    marginTop: 18,
    padding: 18,
  },
  fieldLabel: {
    color: '#777e78',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginTop: 4,
  },
  valueInput: {
    flex: 1,
    minWidth: 0,
    color: '#1f2921',
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -1.2,
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  resultValue: {
    flex: 1,
    color: '#1f2921',
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -1.2,
    lineHeight: 48,
  },
  valueUnit: { color: '#355540', fontSize: 22, fontWeight: '800' },
  valueName: { color: '#7a817a', fontSize: 12, marginTop: 1 },
  resultDivider: {
    height: 1,
    backgroundColor: '#dcddd7',
    marginVertical: 16,
  },
  swapButton: {
    alignSelf: 'center',
    borderColor: '#bfc7bf',
    borderWidth: 1,
    borderRadius: 999,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  swapText: { color: '#355540', fontSize: 13, fontWeight: '800' },
  selectionSection: { marginTop: 24 },
  selectionHeading: {
    color: '#3f4941',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10,
  },
  unitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  unitButton: {
    minWidth: 86,
    flexGrow: 1,
    borderColor: '#d0d4ce',
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: '#faf9f5',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  unitButtonSelected: {
    backgroundColor: '#e2ebe1',
    borderColor: '#adc0ad',
  },
  unitSymbol: { color: '#263029', fontSize: 15, fontWeight: '800' },
  unitSymbolSelected: { color: '#294331' },
  unitName: { color: '#777e78', fontSize: 11, marginTop: 2 },
  unitNameSelected: { color: '#526a58' },
  equivalence: {
    color: '#4d5850',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 26,
  },
  footer: {
    color: '#868b86',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  pressed: { opacity: 0.68 },
});
