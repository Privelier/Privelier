/**
 * "Real looks in your city" on Discover (Looks S3, flag-gated). Proof looks
 * open their detail with the proof chain; portfolio tiles that fill a thin
 * feed say "Portfolio, not verified" and open the barber's profile. Hidden
 * entirely until the feed answered, so Discover never shows a broken rail.
 * With nothing to show yet, only the title and the two entries remain: look
 * search (S4) and the client's look pass (S6).
 *
 * Maestro contract: customer-home-looks / -search / -pass / -style-all /
 * -style-{key} / -tile-{lookId} / -portfolio-{id}.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { GlassChip } from '../../../shared/components/GlassChip';
import { haptics } from '../../../shared/haptics';
import { pressOpacity } from '../../../theme/motion';
import { radius, space } from '../../../theme/spacing';
import { typeScale } from '../../../theme/typography';
import { useTheme } from '../../../theme/useTheme';
import type { BarberDirectoryRow } from '../../../types';
import { useLooksFeed } from '../../hooks/useLooksFeed';

const TILE_WIDTH = 148;

export function LooksFeedRail({ barbers, cityName, de, onOpenLook, onOpenBarber, onSearch, onOpenPass }: {
  barbers: readonly BarberDirectoryRow[];
  cityName: string | null;
  de: boolean;
  onOpenLook: (lookId: string) => void;
  onOpenBarber: (barberId: string) => void;
  onSearch: (style: string | null) => void;
  onOpenPass: () => void;
}) {
  const { colors, fonts } = useTheme();
  const feed = useLooksFeed(barbers.map((barber) => barber.id));
  if (!feed.ready) return null;
  const empty = feed.tiles.length === 0 && !feed.style;

  const nameOf = (barberId: string) =>
    feed.looks.find((look) => look.barber_id === barberId)?.barber_name ?? barbers.find((b) => b.id === barberId)?.name ?? '';

  const action = (label: string, a11y: string, testID: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      testID={testID}
      style={({ pressed }) => [styles.action, { opacity: pressed ? pressOpacity.soft : 1 }]}
    >
      <Text style={{ color: colors.accentText, fontFamily: fonts.bodyMedium, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );

  return (
    <View testID="customer-home-looks">
      <Text accessibilityRole="header" style={[typeScale.title3, styles.title, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
        {de ? `Echte Looks${cityName ? ` in ${cityName}` : ''}` : `Real looks${cityName ? ` in ${cityName}` : ''}`}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: fonts.body }]}>
        {empty
          ? (de ? 'Noch keine bestätigten Looks in deiner Stadt. Die Suche findet trotzdem Barber mit Beweis.' : 'No confirmed looks in your city yet. Search still finds barbers with proof.')
          : (de ? 'Von Kunden als ihr Schnitt bestätigt.' : 'Confirmed by clients as their cut.')}
      </Text>
      <View style={styles.actions}>
        {action(de ? 'Look suchen, wer ist wann frei' : 'Find a look, who is free when', de ? 'Look suchen: wer ist wann frei' : 'Find a look: who is free when', 'customer-home-looks-search', () => onSearch(feed.style))}
        {action(de ? 'Dein Look-Pass' : 'Your look pass', de ? 'Dein Look-Pass: deine Looks privat' : 'Your look pass: your looks, private', 'customer-home-looks-pass', onOpenPass)}
      </View>
      {empty ? null : (
      <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <GlassChip label={de ? 'Alle' : 'All'} selected={feed.style === null} onPress={() => feed.setStyle(null)} size="compact" testID="customer-home-looks-style-all" />
        {feed.styles.map((style) => (
          <GlassChip
            key={style.key}
            label={de ? style.label_de : style.label_en}
            selected={feed.style === style.key}
            onPress={() => feed.setStyle(style.key)}
            size="compact"
            testID={`customer-home-looks-style-${style.key}`}
          />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {feed.tiles.length === 0 ? (
          <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {de ? 'Noch keine bestätigten Looks in diesem Stil.' : 'No confirmed looks in this style yet.'}
          </Text>
        ) : null}
        {feed.tiles.map((tile) => {
          const name = nameOf(tile.barberId);
          const proof = tile.kind === 'proof';
          const badge = proof ? (de ? 'Bestätigt' : 'Verified') : (de ? 'Portfolio, nicht bestätigt' : 'Portfolio, not verified');
          return (
            <Pressable
              key={tile.key}
              onPress={() => {
                void haptics.selection();
                if (proof && tile.lookId) onOpenLook(tile.lookId);
                else onOpenBarber(tile.barberId);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${badge}. ${name}`}
              accessibilityHint={proof ? (de ? 'Öffnet den Look mit seinen Belegen' : 'Opens the look and its proof') : (de ? 'Öffnet das Barber-Profil' : 'Opens the barber profile')}
              testID={proof ? `customer-home-looks-tile-${tile.lookId}` : `customer-home-looks-portfolio-${tile.key.replace('portfolio-', '')}`}
              style={({ pressed }) => [styles.tile, { opacity: pressed ? pressOpacity.soft : 1 }]}
            >
              <View style={[styles.image, { backgroundColor: colors.surface }]}>
                {tile.imageUri ? <Image source={{ uri: tile.imageUri }} style={styles.fill} contentFit="cover" recyclingKey={tile.key} accessible={false} /> : null}
              </View>
              <Text numberOfLines={1} style={[styles.name, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{name}</Text>
              <Text numberOfLines={1} style={[styles.badge, { color: proof ? colors.accentText : colors.textSecondary, fontFamily: fonts.body }]}>{badge}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: space.xl },
  subtitle: { paddingHorizontal: space.xl, marginTop: space.xs, fontSize: 13, lineHeight: 19 },
  chips: { gap: space.sm, paddingHorizontal: space.xl, paddingTop: space.md },
  row: { gap: space.md, paddingHorizontal: space.xl, paddingTop: space.md },
  tile: { width: TILE_WIDTH },
  image: { width: TILE_WIDTH, aspectRatio: 3 / 4, borderRadius: radius.md, overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
  name: { fontSize: 14, marginTop: space.sm },
  badge: { fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, paddingHorizontal: space.xl },
  action: { minHeight: 44, justifyContent: 'center' },
});
