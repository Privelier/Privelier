/**
 * Requests header entry to the look wishes in the barber's city (Looks S5,
 * shown only with the looks flag).
 */
import { Pressable, StyleSheet, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { pressOpacity } from '../../../theme/motion';
import { space } from '../../../theme/spacing';
import { useTheme } from '../../../theme/useTheme';

export function LookWishesLink({ de, onPress }: { de: boolean; onPress: () => void }) {
  const { colors, fonts } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={de ? 'Look-Wünsche in deiner Stadt' : 'Look wishes in your city'}
      testID="barber-requests-look-wishes"
      style={({ pressed }) => [styles.link, { opacity: pressed ? pressOpacity.soft : 1 }]}
    >
      <Feather name="scissors" size={15} color={colors.accentText} />
      <Text style={{ color: colors.accentText, fontFamily: fonts.bodyMedium, fontSize: 14 }}>{de ? 'Look-Wünsche in deiner Stadt' : 'Look wishes in your city'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'flex-start' },
});
