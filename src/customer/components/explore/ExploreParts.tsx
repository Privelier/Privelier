/**
 * Explore tab pieces: the list/map toggle and the honest empty-map card.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GlassSurface } from '../../../shared/components/GlassSurface';
import { pressOpacity } from '../../../theme/motion';
import { useTheme } from '../../../theme/useTheme';
import { typeScale } from '../../../theme/typography';

export type ViewMode = 'list' | 'map';

export function ViewModeToggle({ viewMode, de, onChange }: { viewMode: ViewMode; de: boolean; onChange: (mode: ViewMode) => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.toggle, { borderColor: colors.border }]}>
      {(['list', 'map'] as const).map((mode) => {
        const active = viewMode === mode;
        return (
          <Pressable
            key={mode}
            onPress={() => onChange(mode)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={mode === 'list' ? (de ? 'Listenansicht' : 'List view') : (de ? 'Kartenansicht' : 'Map view')}
            testID={`customer-explore-toggle-${mode}`}
            style={({ pressed }) => [styles.toggleButton, active && { backgroundColor: colors.surface }, pressed ? { opacity: pressOpacity.soft } : null]}
          >
            <Feather name={mode === 'list' ? 'list' : 'map'} size={14} color={active ? colors.accentText : colors.textSecondary} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Shown instead of the map when no filtered barber has a pin. */
export function MapEmptyCard({ hasBarbers, de, onShowList }: { hasBarbers: boolean; de: boolean; onShowList: () => void }) {
  const { colors, fonts } = useTheme();
  const message = hasBarbers
    ? de
      ? 'Sobald Barber ihren Standort hinterlegen, erscheinen sie hier. Bis dahin kannst du die Liste nutzen.'
      : 'Barbers appear here once they set their location. Use the list view meanwhile.'
    : de ? 'Keine Barber passen zu diesem Filter.' : 'No barbers match this filter.';
  return (
    <View style={styles.fallbackArea} testID="customer-explore-map-empty">
      <GlassSurface style={styles.card} testID="customer-explore-map-preview-card">
        <Feather name="map-pin" size={22} color={colors.textSecondary} />
        <Text style={[styles.title, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
          {de ? 'Noch keine Barber auf der Karte' : 'No barbers on the map yet'}
        </Text>
        <Text style={[styles.blurb, { color: colors.textSecondary, fontFamily: fonts.body }]}>{message}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={de ? 'Zur Liste wechseln' : 'Switch to list view'}
          testID="customer-explore-map-switch-to-list"
          onPress={onShowList}
          style={({ pressed }) => [styles.listAction, { borderColor: colors.border }, pressed ? { opacity: pressOpacity.soft } : null]}
        >
          <Text style={[styles.listActionText, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>{de ? 'Zur Liste' : 'Show list'}</Text>
        </Pressable>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', borderWidth: 0.5, borderRadius: 8, overflow: 'hidden' },
  toggleButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  fallbackArea: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 12 },
  card: { alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 420, paddingHorizontal: 24, paddingVertical: 16, gap: 10 },
  title: { fontSize: 18, textAlign: 'center' },
  blurb: { ...typeScale.secondary, textAlign: 'center' },
  listAction: {
    minHeight: 44,
    paddingHorizontal: 18,
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listActionText: { fontSize: 14 },
});
