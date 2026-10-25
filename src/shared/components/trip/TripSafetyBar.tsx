/**
 * Safety row on both trip screens: "Share trip" and a press-and-hold SOS.
 *
 * SOS is hold-to-activate (1.5 s, a ring fills while holding) so it can never
 * fire from a pocket or a stray tap, yet needs no menus in a stressful
 * moment. Release early and nothing happens. Screen readers get a plain
 * double-tap action with an explicit label instead of the hold gesture.
 */
import { useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../../theme/useTheme';
import { HAIRLINE, radius, space } from '../../../theme/spacing';
import { haptics } from '../../haptics';
import { getAppLanguage } from '../../locale';
import { emergencyNumber, triggerSos } from '../../tracking/safety';
import { useToast } from '../ToastProvider';

const HOLD_MS = 1500;

interface Props {
  bookingId: string;
  onShare: () => void;
  testIDPrefix: string;
}

export function TripSafetyBar({ bookingId, onShare, testIDPrefix }: Props) {
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const { showToast } = useToast();
  const [fill] = useState(() => new Animated.Value(0));
  const holding = useRef<Animated.CompositeAnimation | null>(null);
  const number = emergencyNumber();

  const fire = async () => {
    void haptics.warning();
    const called = await triggerSos(bookingId);
    if (!called) {
      showToast({ message: de ? `Dieses Gerät kann nicht anrufen. Wähle ${number} auf einem Telefon.` : `This device cannot place calls. Dial ${number} from a phone.` });
    }
  };

  const onPressIn = () => {
    void haptics.selection();
    holding.current = Animated.timing(fill, { toValue: 1, duration: HOLD_MS, easing: Easing.linear, useNativeDriver: false });
    holding.current.start(({ finished }) => {
      if (finished) {
        fill.setValue(0);
        void fire();
      }
    });
  };
  const onPressOut = () => {
    holding.current?.stop();
    Animated.timing(fill, { toValue: 0, duration: 180, useNativeDriver: false }).start();
  };

  const onAccessibilityAction = async () => {
    // Screen readers: activation is already deliberate (focus + double tap).
    const screenReader = await AccessibilityInfo.isScreenReaderEnabled();
    if (screenReader) void fire();
  };

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onShare}
        accessibilityRole="button"
        accessibilityLabel={de ? 'Fahrt mit einem Kontakt teilen' : 'Share trip with a contact'}
        testID={`${testIDPrefix}-share`}
        style={({ pressed }) => [styles.button, { borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
      >
        <Feather name="share-2" size={16} color={colors.textPrimary} />
        <Text style={[styles.label, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{de ? 'Fahrt teilen' : 'Share trip'}</Text>
      </Pressable>
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={() => void onAccessibilityAction()}
        accessibilityRole="button"
        accessibilityLabel={de ? `Notruf ${number} anrufen` : `Call emergency services, ${number}`}
        accessibilityHint={de ? 'Zum Auslösen gedrückt halten.' : 'Press and hold to call.'}
        testID={`${testIDPrefix}-sos`}
        style={[styles.button, styles.sos, { borderColor: colors.error }]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.sosFill,
            { backgroundColor: colors.error, width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]}
        />
        <Feather name="alert-octagon" size={16} color={colors.errorText} />
        <Text style={[styles.label, { color: colors.errorText, fontFamily: fonts.bodySemiBold }]}>
          {de ? 'SOS halten' : 'Hold for SOS'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  button: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderWidth: HAIRLINE,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    overflow: 'hidden',
  },
  sos: { borderWidth: 1 },
  sosFill: { position: 'absolute', left: 0, top: 0, bottom: 0, opacity: 0.35 },
  label: { fontSize: 14 },
});
