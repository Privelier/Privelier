/**
 * One look photo: a local picked file or a short-lived signed URL. With
 * onRemove it carries a remove disc (the barber's draft); without it is
 * read-only (the customer's confirmation). A neutral surface sits under the
 * image so an expired or slow URL settles into a calm card.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { portfolioTileStyle } from '../../shared/components/PortfolioGrid';
import { OVER_IMAGE_BG, OVER_IMAGE_ICON } from '../../shared/components/ScreenBackHeader';
import { useTheme } from '../../theme/useTheme';

export function LookPhotoTile({ uri, label, testID, onRemove, removeLabel, removeDisabled = false }: {
  uri: string | null;
  label: string;
  testID: string;
  onRemove?: () => void;
  removeLabel?: string;
  removeDisabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[portfolioTileStyle, { backgroundColor: colors.surface }]}
      testID={testID}
      accessible={!onRemove}
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      {uri ? <Image source={{ uri }} style={styles.fill} contentFit="cover" recyclingKey={uri} accessible={false} /> : null}
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          disabled={removeDisabled}
          accessibilityRole="button"
          accessibilityLabel={removeLabel ?? label}
          accessibilityState={{ disabled: removeDisabled }}
          hitSlop={8}
          testID={`${testID}-remove`}
          style={[styles.disc, { backgroundColor: OVER_IMAGE_BG, opacity: removeDisabled ? 0.4 : 1 }]}
        >
          <Feather name="x" size={14} color={OVER_IMAGE_ICON} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  disc: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
