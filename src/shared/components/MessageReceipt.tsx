import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { getAppLanguage } from '../locale';

export type MessageReceiptState = 'sent' | 'read' | 'failed';

export function MessageReceipt({
  state,
  testID,
}: {
  state: MessageReceiptState;
  testID: string;
}) {
  const { colors } = useTheme();
  const isGerman = getAppLanguage() === 'de';
  const color = state === 'read' ? colors.accentText : colors.textSecondary;
  const count = state === 'failed' ? 1 : 2;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={state === 'read'
        ? isGerman ? 'Gelesen' : 'Read'
        : state === 'failed'
          ? isGerman ? 'Nicht gesendet, zum erneuten Senden tippen' : 'Not sent, tap to retry'
          : isGerman ? 'Gesendet, nicht gelesen' : 'Sent, not read'}
      testID={testID}
      style={styles.receipt}
    >
      {Array.from({ length: count }, (_, index) => (
        <Feather
          key={index}
          name="check"
          size={13}
          color={color}
          style={index > 0 ? styles.secondCheck : undefined}
          accessible={false}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  receipt: { flexDirection: 'row', alignItems: 'center', minHeight: 18 },
  secondCheck: { marginLeft: -6 },
});
