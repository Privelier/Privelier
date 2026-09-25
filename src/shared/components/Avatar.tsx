import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { duration } from '../../theme/motion';
import { HAIRLINE } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';

const WARM_TINTS = ['#6B4F45', '#5D5540', '#5B4650', '#4E554B', '#624B38', '#574C46'] as const;
const MONOGRAM_TEXT = '#F5F1E8';
const NEUTRAL_BLURHASH = 'A36Q|[={}?oL';

function initialsFor(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const selected = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]];
  return selected.map((word) => Array.from(word)[0]).join('').toUpperCase();
}

function tintFor(id: string): string {
  let hash = 2166136261;
  for (const character of id) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return WARM_TINTS[(hash >>> 0) % WARM_TINTS.length];
}

export function Avatar({
  id,
  name,
  imageUrl,
  size = 44,
  shape = 'circle',
  monogramFontSize,
  accessible = true,
  testID,
  accessibilityLabel,
  style,
}: {
  id: string;
  name: string | null | undefined;
  imageUrl?: string | null;
  size?: number;
  shape?: 'circle' | 'rounded';
  monogramFontSize?: number;
  accessible?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, fonts } = useTheme();
  const normalizedImageUrl = imageUrl?.trim() || null;
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const showsPhoto = normalizedImageUrl !== null && failedImageUrl !== normalizedImageUrl;
  const initials = initialsFor(name);
  const label = accessibilityLabel ?? (name?.trim() ? `Avatar for ${name.trim()}` : 'Profile avatar');
  const dimensions =
    shape === 'circle'
      ? { width: size, height: size, borderRadius: size / 2 }
      : { borderRadius: 8 };

  return (
    <View
      accessible={accessible}
      accessibilityRole={accessible ? 'image' : undefined}
      accessibilityLabel={accessible ? label : undefined}
      testID={testID}
      style={[
        styles.container,
        {
          ...dimensions,
          borderColor: colors.accent,
          backgroundColor: tintFor(id),
        },
        style,
      ]}
    >
      {showsPhoto ? (
        <Image
          source={{ uri: normalizedImageUrl }}
          placeholder={{ blurhash: NEUTRAL_BLURHASH, width: 16, height: 16 }}
          placeholderContentFit="cover"
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={id}
          transition={{ duration: duration.base, effect: 'cross-dissolve' }}
          accessible={false}
          testID={testID ? `${testID}-image` : undefined}
          style={styles.image}
          onError={() => setFailedImageUrl(normalizedImageUrl)}
        />
      ) : (
        <Text
          accessible={false}
          allowFontScaling={false}
          testID={testID ? `${testID}-monogram` : undefined}
          style={[
            styles.initials,
            {
              color: MONOGRAM_TEXT,
              fontFamily: fonts.bodySemiBold,
              fontSize: monogramFontSize ?? Math.max(12, Math.round(size * 0.32)),
            },
          ]}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: HAIRLINE,
  },
  image: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  initials: {
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
