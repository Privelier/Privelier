/** Discover's paged row of short brand messages, with page dots. */
import { useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GlassSurface } from '../../../shared/components/GlassSurface';
import { useTheme } from '../../../theme/useTheme';
import { getDiscoverBrandMessages } from '../../discoverPresentation';
import { discoverStyles as styles } from './discoverStyles';

const ICONS = ['scissors', 'clock', 'home', 'sun'] as const;

export function BrandCarousel() {
  const { colors, fonts } = useTheme();
  const { width: viewportWidth } = useWindowDimensions();
  const [active, setActive] = useState(0);
  const messages = getDiscoverBrandMessages(Intl.DateTimeFormat().resolvedOptions().locale);

  return (
    <View style={styles.messageCarousel} testID="customer-home-brand-carousel">
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        accessibilityLabel={`Privelier inspiration, ${active + 1} of ${messages.length}`}
        onMomentumScrollEnd={({ nativeEvent }) =>
          setActive(Math.max(0, Math.min(messages.length - 1, Math.round(nativeEvent.contentOffset.x / viewportWidth))))
        }
      >
        {messages.map((message, index) => (
          <View key={message} style={[styles.messagePage, { width: viewportWidth }]}>
            <GlassSurface style={styles.messageCard} testID={`customer-home-brand-message-${index + 1}`}>
              <Feather name={ICONS[index]} size={20} color={colors.accentText} />
              <Text style={[styles.messageCopy, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
                {message}
              </Text>
            </GlassSurface>
          </View>
        ))}
      </ScrollView>
      <View style={styles.messageDots} accessible accessibilityLabel={`Slide ${active + 1} of ${messages.length}`}>
        {messages.map((message, index) => (
          <View key={message} style={[styles.messageDot, { backgroundColor: index === active ? colors.accent : colors.border }]} />
        ))}
      </View>
    </View>
  );
}
