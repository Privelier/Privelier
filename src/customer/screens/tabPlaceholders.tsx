/**
 * Calm placeholder screen for the Explore tab (discovery map — a later
 * build-order concern). A stable component (not an inline render
 * function) so the tab navigator never remounts them on parent re-renders.
 */
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/useTheme';

function TabPlaceholder({ title, blurb, testID }: { title: string; blurb: string; testID: string }) {
  const { colors, fonts } = useTheme();
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
      testID={testID}
    >
      <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
        {title}
      </Text>
      <View style={styles.body}>
        <Text style={[styles.blurb, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          {blurb}
        </Text>
      </View>
    </SafeAreaView>
  );
}

export function ExploreScreen() {
  return (
    <TabPlaceholder
      title="Explore"
      blurb="A map of masters around you is on its way."
      testID="customer-explore-screen"
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  heading: { fontSize: 24, marginTop: 24 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 96 },
  blurb: { fontSize: 14, textAlign: 'center' },
});
