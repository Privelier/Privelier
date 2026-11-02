import { StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { typeScale } from '../../theme/typography';
import { space } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import Brandmark from './Brandmark';

/**
 * The quiet sign-off at the very bottom of Account (customer) and Settings
 * (barber): the mark alone, decorative, and the app version.
 */
export function Colophon({ testID }: { testID: string }) {
  const { colors, fonts } = useTheme();
  const version = Constants.expoConfig?.version;
  return (
    <View style={styles.container} testID={testID}>
      <Brandmark lockup="mark" size="sm" decorative />
      {version ? (
        <Text style={[styles.version, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          {`Version ${version}`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: space.sm, marginTop: space['2xl'] },
  version: { ...typeScale.caption },
});
