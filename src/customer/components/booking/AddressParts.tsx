/**
 * Booking address step pieces: the saved-address shortcuts, a labeled
 * single-line address field and the "save for later" checkbox.
 */
import type { Ref } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { HAIRLINE, space } from '../../../theme/spacing';
import { useTheme } from '../../../theme/useTheme';
import type { SavedAddress } from '../../personalData';

export const addressStyles = StyleSheet.create({
  label: { fontSize: 14, marginTop: space['2xl'], marginBottom: 6, letterSpacing: 0.2 },
});

export function SavedAddressList({ addresses, de, onUse, onRemove }: {
  addresses: SavedAddress[];
  de: boolean;
  onUse: (saved: SavedAddress) => void;
  onRemove: (saved: SavedAddress) => void;
}) {
  const { colors, fonts } = useTheme();
  return (
    <View style={styles.block} testID="customer-booking-location-saved">
      <Text style={[addressStyles.label, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>{de ? 'Gespeicherte Adressen' : 'Saved addresses'}</Text>
      {addresses.map((saved) => (
        <View key={saved.id} style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Pressable
            onPress={() => onUse(saved)}
            accessibilityRole="button"
            accessibilityLabel={`${de ? 'Adresse verwenden' : 'Use address'}: ${saved.address}`}
            testID={`customer-booking-location-saved-${saved.id}`}
            style={({ pressed }) => [styles.use, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Feather name="map-pin" size={16} color={colors.accentText} />
            <Text numberOfLines={2} style={[styles.text, { color: colors.textPrimary, fontFamily: fonts.body }]}>{saved.address}</Text>
          </Pressable>
          <Pressable
            onPress={() => onRemove(saved)}
            accessibilityRole="button"
            accessibilityLabel={`${de ? 'Adresse entfernen' : 'Remove address'}: ${saved.address}`}
            hitSlop={6}
            testID={`customer-booking-location-saved-remove-${saved.id}`}
            style={styles.remove}
          >
            <Feather name="x" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      ))}
      <Text style={[styles.orNew, { color: colors.textSecondary, fontFamily: fonts.body }]}>{de ? 'Oder gib eine neue Adresse ein:' : 'Or enter a new address:'}</Text>
    </View>
  );
}

export function AddressField({ label, value, onChangeText, inputRef, focused, onFocus, onBlur, onSubmitEditing, returnKeyType, testID }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  inputRef: Ref<TextInputInstance>;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onSubmitEditing: () => void;
  returnKeyType: 'next' | 'done';
  testID: string;
}) {
  const { colors, fonts } = useTheme();
  return (
    <View>
      <Text style={[addressStyles.label, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>{label}</Text>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType}
        accessibilityLabel={label}
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.accent}
        style={[styles.singleInput, { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: focused ? colors.accent : colors.inputBorder, fontFamily: fonts.body }]}
        testID={testID}
      />
    </View>
  );
}

export function SaveForLaterToggle({ checked, de, onToggle }: { checked: boolean; de: boolean; onToggle: () => void }) {
  const { colors, fonts } = useTheme();
  const label = de ? 'Adresse für später speichern' : 'Save this address for later';
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      testID="customer-booking-location-save-toggle"
      style={styles.saveToggle}
    >
      <View style={[styles.saveBox, { borderColor: checked ? colors.accent : colors.inputBorder, backgroundColor: checked ? colors.accent : 'transparent' }]}>
        {checked ? <Feather name="check" size={14} color={colors.onAccent} /> : null}
      </View>
      <Text style={[styles.saveText, { color: colors.textSecondary, fontFamily: fonts.body }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: space.base, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, borderWidth: HAIRLINE, borderRadius: 12, paddingLeft: space.base },
  use: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: space.xs },
  text: { flex: 1, fontSize: 15, lineHeight: 21 },
  orNew: { fontSize: 13, marginTop: space.sm },
  singleInput: { borderWidth: HAIRLINE, borderRadius: 14, paddingHorizontal: 14, paddingVertical: space.md, fontSize: 16, minHeight: 54 },
  saveToggle: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44, marginBottom: space.sm },
  saveBox: { width: 22, height: 22, borderRadius: 5, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 14 },
});
