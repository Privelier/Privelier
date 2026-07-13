/**
 * PortfolioTile — the reusable, presentation-only portfolio image unit.
 *
 * An "ultra component": both apps consume it, it holds no state and calls no
 * data layer beyond the synchronous public-URL derivation. Pass the object
 * PATH stored in `portfolio.image_url`; the tile resolves the public URL.
 *
 * - onDelete present  → renders a floating destructive delete disc (barber's
 *   own grid). deleteDisabled dims and disables it (e.g. an upload in flight).
 * - onDelete absent    → read-only tile (customer's Portfolio tab).
 *
 * The colour-shaped surface placeholder sits UNDER the Image so a slow-loading
 * photo settles into a calm card, never a flash of nothing.
 */
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getPublicPortfolioUrl } from '../portfolioImages';
import { useTheme } from '../../theme/useTheme';
import { portfolioTileStyle } from './PortfolioGrid';

// Over-image constants — fixed light-on-dark by design (mirrors the hero
// scrim/text precedent), so the delete affordance reads over any photograph
// regardless of theme. Scrim opacity stays ≥0.55: contrast depends on it.
const DELETE_SCRIM = 'rgba(18,18,20,0.6)';
const DELETE_SCRIM_PRESSED = 'rgba(168,69,62,0.92)'; // brand error at high opacity
const DELETE_ICON = '#F5F1E8';

export interface PortfolioTileProps {
  /** Object PATH; the tile resolves it via getPublicPortfolioUrl. */
  imagePath: string;
  /** Present → renders the floating delete disc; absent → read-only. */
  onDelete?: () => void;
  /** Disables the disc (e.g. an upload is in flight). */
  deleteDisabled?: boolean;
  /** Preserves the per-screen image testID verbatim. */
  testID: string;
  /** Preserves the per-screen delete testID verbatim. */
  deleteTestID?: string;
  deleteAccessibilityLabel?: string;
}

export function PortfolioTile({
  imagePath,
  onDelete,
  deleteDisabled = false,
  testID,
  deleteTestID,
  deleteAccessibilityLabel = 'Delete portfolio image',
}: PortfolioTileProps) {
  const { colors } = useTheme();

  return (
    <View style={[portfolioTileStyle, { backgroundColor: colors.surface }]} testID={testID}>
      <Image
        source={{ uri: getPublicPortfolioUrl(imagePath) }}
        style={styles.image}
        resizeMode="cover"
      />
      {onDelete ? (
        <Pressable
          onPress={onDelete}
          disabled={deleteDisabled}
          accessibilityRole="button"
          accessibilityLabel={deleteAccessibilityLabel}
          accessibilityState={{ disabled: deleteDisabled }}
          hitSlop={8}
          testID={deleteTestID}
          style={({ pressed }) => [
            styles.deleteDisc,
            {
              // ~140ms ease-out feel via the pressed transform; the scrim flips
              // to brand error on press so the destructive intent is legible.
              backgroundColor: pressed ? DELETE_SCRIM_PRESSED : DELETE_SCRIM,
              opacity: deleteDisabled ? 0.4 : 1,
              transform: [{ scale: pressed ? 0.92 : 1 }],
            },
          ]}
        >
          <Feather name="trash-2" size={14} color={DELETE_ICON} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', height: '100%' },
  deleteDisc: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
