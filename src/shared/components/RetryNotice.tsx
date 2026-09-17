import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { pressOpacity } from '../../theme/motion';
import { Notice } from './Notice';

export function RetryNotice({ message, testID, onRetry, style }: {
  message: string;
  testID: string;
  onRetry: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, fonts } = useTheme();
  return (
    <Notice message={message} testID={testID} style={style}>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Try again"
        testID={`${testID}-retry`}
        style={({ pressed }) => [styles.action, pressed ? { opacity: pressOpacity.soft } : null]}
      >
        <Text style={{ color: colors.accentText, fontFamily: fonts.bodyMedium }}>Try again</Text>
      </Pressable>
    </Notice>
  );
}

const styles = StyleSheet.create({ action: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' } });
