/**
 * The ETA hero shared by both trip screens: one large, calm number (serif,
 * tabular), the clock time it lands on, distance left, a status chip with a
 * breathing live dot, and a brass progress track with a small marker riding
 * along it. Designed to be read at a glance from arm's length.
 *
 * Accessibility: the whole hero is one element with a sentence label
 * ("Arrives in 8 minutes, at 14:32, 2.4 kilometres away"), announced
 * politely when the minute value changes — not on every GPS tick.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../theme/useTheme';
import { numericText, typeScale } from '../../../theme/typography';
import { radius, space } from '../../../theme/spacing';
import { useReducedMotionPreference } from '../../motion/useReducedMotionPreference';
import { formatDistance, formatEta } from '../../tracking/eta';
import { getAppLanguage } from '../../locale';

export type TripPhase = 'starting' | 'en_route' | 'arriving' | 'arrived' | 'stale' | 'ended';

interface Props {
  phase: TripPhase;
  etaS: number | null;
  remainingM: number | null;
  progress: number | null;
  /** Shown under the number, e.g. "Marco is on the way". */
  caption: string;
  testID?: string;
}

function arrivalClock(etaS: number, de: boolean): string {
  const at = new Date(Date.now() + etaS * 1000);
  return at.toLocaleTimeString(de ? 'de-DE' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function TripStatusPanel({ phase, etaS, remainingM, progress, caption, testID }: Props) {
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const reduceMotion = useReducedMotionPreference();

  const chip = useMemo(() => {
    switch (phase) {
      case 'starting': return { label: de ? 'Wird gestartet' : 'Starting', tone: colors.textSecondary };
      case 'arriving': return { label: de ? 'Gleich da' : 'Almost there', tone: colors.accent };
      case 'arrived': return { label: de ? 'Angekommen' : 'Arrived', tone: colors.successText };
      case 'stale': return { label: de ? 'Signal verloren' : 'Signal lost', tone: colors.textSecondary };
      case 'ended': return { label: de ? 'Beendet' : 'Ended', tone: colors.textSecondary };
      default: return { label: de ? 'Live unterwegs' : 'Live on the way', tone: colors.accent };
    }
  }, [phase, de, colors]);

  const showEta = etaS != null && (phase === 'en_route' || phase === 'arriving' || phase === 'stale');
  const bigText =
    phase === 'arrived' ? (de ? 'Da' : 'Here') : showEta ? formatEta(etaS!, de) : '—';
  const minuteKey = showEta ? Math.ceil((etaS ?? 0) / 60) : -1;

  // Announce minute changes only, never every 5-second tick.
  const lastAnnounced = useRef<number | null>(null);
  useEffect(() => {
    if (minuteKey < 0 || lastAnnounced.current === minuteKey) return;
    if (lastAnnounced.current !== null) {
      AccessibilityInfo.announceForAccessibility(de ? `Ankunft in ${minuteKey} Minuten` : `Arriving in ${minuteKey} minutes`);
    }
    lastAnnounced.current = minuteKey;
  }, [minuteKey, de]);

  const label = phase === 'arrived'
    ? (de ? 'Angekommen' : 'Arrived')
    : showEta
      ? de
        ? `Ankunft in ${formatEta(etaS!, true)}, um ${arrivalClock(etaS!, true)}${remainingM != null ? `, noch ${formatDistance(remainingM, true)}` : ''}`
        : `Arrives in ${formatEta(etaS!, false)}, at ${arrivalClock(etaS!, false)}${remainingM != null ? `, ${formatDistance(remainingM, false)} away` : ''}`
      : chip.label;

  return (
    <View testID={testID} accessible accessibilityLabel={`${caption}. ${label}`} accessibilityLiveRegion="polite">
      <View style={styles.chipRow}>
        <LiveDot color={chip.tone} pulsing={!reduceMotion && (phase === 'en_route' || phase === 'arriving')} />
        <Text style={[styles.chipText, { color: chip.tone, fontFamily: fonts.bodySemiBold }]}>{chip.label}</Text>
      </View>
      <View style={styles.heroRow}>
        <Text
          style={[styles.hero, numericText, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}
          adjustsFontSizeToFit
          numberOfLines={1}
          testID={testID ? `${testID}-eta` : undefined}
        >
          {bigText}
        </Text>
        {showEta ? (
          <View style={styles.heroSide}>
            <Text style={[styles.sideLabel, { color: colors.textSecondary, fontFamily: fonts.body }]}>{de ? 'Ankunft' : 'Arrives'}</Text>
            <Text style={[styles.sideValue, numericText, { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }]}>
              {arrivalClock(etaS!, de)}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.caption, { color: colors.textSecondary, fontFamily: fonts.body }]} numberOfLines={2}>
        {caption}
        {remainingM != null && showEta ? ` · ${formatDistance(remainingM, de)}` : ''}
      </Text>
      <ProgressTrack progress={phase === 'arrived' ? 1 : progress} reduceMotion={reduceMotion} />
    </View>
  );
}

function LiveDot({ color, pulsing }: { color: string; pulsing: boolean }) {
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!pulsing) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, pulsing]);
  return (
    <View style={styles.dotWrap}>
      <Animated.View
        style={[
          styles.dotHalo,
          { backgroundColor: color, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }] },
        ]}
      />
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
}

function ProgressTrack({ progress, reduceMotion }: { progress: number | null; reduceMotion: boolean }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [value] = useState(() => new Animated.Value(progress ?? 0));
  useEffect(() => {
    if (progress == null) return;
    if (reduceMotion) value.setValue(progress);
    else Animated.timing(value, { toValue: progress, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [progress, reduceMotion, value]);
  if (progress == null) return <View style={[styles.track, { backgroundColor: colors.border }]} />;
  const fill = value.interpolate({ inputRange: [0, 1], outputRange: [0, width] });
  return (
    <View style={[styles.track, { backgroundColor: colors.border }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Animated.View style={[styles.fill, { backgroundColor: colors.accent, width: fill }]} />
      <Animated.View
        style={[styles.rider, { borderColor: colors.accent, backgroundColor: colors.background, transform: [{ translateX: Animated.subtract(fill, 7) }] }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chipText: { fontSize: 13 },
  dotWrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  dotHalo: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: space.sm, gap: space.md },
  hero: { fontSize: 52, lineHeight: 60, flexShrink: 1 },
  heroSide: { alignItems: 'flex-end', paddingBottom: 8 },
  sideLabel: { fontSize: 12 },
  sideValue: { ...typeScale.title3 },
  caption: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  track: { height: 4, borderRadius: radius.pill, marginTop: space.lg, overflow: 'visible', justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 999 },
  rider: { position: 'absolute', left: 0, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
});
