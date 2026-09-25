import { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { ReduceMotion } from 'react-native-reanimated';
import { HAIRLINE, radius, space } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';

type ConfirmSheetProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  destructive?: boolean;
  testID: string;
};

export function ConfirmSheet({ open, title, message, confirmLabel, cancelLabel, onConfirm, onClose, destructive = false, testID }: ConfirmSheetProps) {
  const { colors, fonts } = useTheme();
  const sheet = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (open) sheet.current?.present();
    else sheet.current?.dismiss();
  }, [open]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={sheet}
      enableDynamicSizing
      enablePanDownToClose
      keyboardBehavior="interactive"
      overrideReduceMotion={ReduceMotion.System}
      backgroundStyle={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: HAIRLINE }}
      handleIndicatorStyle={{ backgroundColor: colors.accent, width: 32 }}
      backdropComponent={renderBackdrop}
      onDismiss={onClose}
    >
      <BottomSheetView style={styles.content} testID={testID}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
          {title}
        </Text>
        <Text style={[styles.message, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          {message}
        </Text>
        <View style={styles.actions}>
          <Pressable
            testID={`${testID}-keep`}
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
            onPress={onClose}
            style={[styles.button, { borderColor: colors.border }]}
          >
            <Text style={[styles.buttonText, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{cancelLabel}</Text>
          </Pressable>
          <Pressable
            testID={`${testID}-confirm`}
            accessibilityRole="button"
            accessibilityLabel={confirmLabel}
            onPress={onConfirm}
            style={[styles.button, { borderColor: destructive ? colors.error : colors.accent }]}
          >
            <Text style={[styles.buttonText, { color: destructive ? colors.errorText : colors.accentText, fontFamily: fonts.bodySemiBold }]}>
              {confirmLabel}
            </Text>
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.xl, paddingTop: space.base, paddingBottom: space['3xl'] },
  title: { fontSize: 24, lineHeight: 30 },
  message: { fontSize: 14, lineHeight: 21, marginTop: space.sm },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
  button: {
    minHeight: 52,
    flex: 1,
    borderWidth: HAIRLINE,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
  },
  buttonText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
