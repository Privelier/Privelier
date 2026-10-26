/**
 * The bottom sheet used for short action lists and small forms (safety menu,
 * reports): glass background, dynamic height, dismiss on pan or backdrop.
 */
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { ReduceMotion } from 'react-native-reanimated';
import { HAIRLINE, space } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { SheetGlassBackground } from './SheetGlassBackground';

export function ActionSheet({ open, onClose, testID, children }: { open: boolean; onClose: () => void; testID: string; children: ReactNode }) {
  const { colors } = useTheme();
  const sheet = useRef<BottomSheetModal>(null);
  useEffect(() => {
    if (open) sheet.current?.present();
    else sheet.current?.dismiss();
  }, [open]);
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />,
    []
  );
  return (
    <BottomSheetModal
      ref={sheet}
      enableDynamicSizing
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      overrideReduceMotion={ReduceMotion.System}
      backgroundComponent={SheetGlassBackground}
      handleIndicatorStyle={{ backgroundColor: colors.accent, width: 32 }}
      backdropComponent={renderBackdrop}
      onDismiss={onClose}
    >
      <BottomSheetView style={styles.sheet} testID={testID}>{children}</BottomSheetView>
    </BottomSheetModal>
  );
}

export function SheetAction({ icon, label, onPress, destructive = false, testID }: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  testID: string;
}) {
  const { colors, fonts } = useTheme();
  const tone = destructive ? colors.errorText : colors.textPrimary;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} testID={testID} style={[styles.action, { borderColor: colors.border }]}>
      <Feather name={icon} size={18} color={tone} />
      <Text style={[styles.actionText, { color: tone, fontFamily: fonts.bodyMedium }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: space.xl, paddingTop: space.base, paddingBottom: space['3xl'], gap: space.md },
  action: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space.md, borderBottomWidth: HAIRLINE },
  actionText: { fontSize: 16 },
});
