/**
 * Barber "Days off" for the next 30 days (migration 0046). Tapping a
 * date toggles it; the change is optimistic and rolls back if the write
 * fails. The booking validator refuses requests on these dates, so a day off
 * is binding, not cosmetic. Existing bookings on a day are not cancelled —
 * the copy says so.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HAIRLINE, radius, space } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { numericText } from '../../theme/typography';
import { getAppLanguage } from '../../shared/locale';
import { haptics } from '../../shared/haptics';
import { useToast } from '../../shared/components/ToastProvider';
import { listOwnDaysOff, setDayOff } from '../availabilityData';

const LOOKAHEAD = 30;

function localKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function DaysOffStrip({ barberId }: { barberId: string | null }) {
  const { colors, fonts } = useTheme();
  const language = getAppLanguage();
  const de = language === 'de';
  const { showToast } = useToast();
  const [daysOff, setDaysOff] = useState<Set<string> | null>(null);
  const pendingRef = useRef(new Set<string>());

  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: LOOKAHEAD }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      return {
        key: localKey(d),
        weekday: d.toLocaleDateString(de ? 'de-DE' : 'en-GB', { weekday: 'short' }),
        day: d.getDate(),
        label: d.toLocaleDateString(de ? 'de-DE' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
      };
    });
  }, [de]);

  useEffect(() => {
    if (!barberId) return;
    let active = true;
    void listOwnDaysOff(barberId, days[0].key).then((result) => {
      if (active) setDaysOff(result);
    });
    return () => { active = false; };
  }, [barberId, days]);

  const toggle = useCallback(async (key: string) => {
    if (!barberId || !daysOff || pendingRef.current.has(key)) return;
    pendingRef.current.add(key);
    const off = !daysOff.has(key);
    void haptics.selection();
    setDaysOff((current) => {
      const next = new Set(current ?? []);
      if (off) next.add(key); else next.delete(key);
      return next;
    });
    const ok = await setDayOff(barberId, key, off);
    pendingRef.current.delete(key);
    if (!ok) {
      setDaysOff((current) => {
        const next = new Set(current ?? []);
        if (off) next.delete(key); else next.add(key);
        return next;
      });
      showToast({ message: de ? 'Das hat nicht geklappt. Versuch es noch einmal.' : 'That did not save. Try again.' });
    }
  }, [barberId, daysOff, showToast, de]);

  return (
    <View style={styles.section} testID="barber-availability-days-off">
      <Text style={[styles.title, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
        {de ? 'Freie Tage' : 'Days off'}
      </Text>
      <Text style={[styles.hint, { color: colors.textSecondary, fontFamily: fonts.body }]}>
        {daysOff === null && barberId
          ? de ? 'Freie Tage konnten nicht geladen werden.' : 'Days off could not be loaded.'
          : de
            ? 'Tippe auf einen Tag, an dem du nicht arbeitest. Kunden können ihn dann nicht buchen; bestehende Termine bleiben bestehen.'
            : 'Tap a day you are not working. Customers cannot book it; bookings you already have stay in place.'}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {days.map((d) => {
          const off = daysOff?.has(d.key) ?? false;
          return (
            <Pressable
              key={d.key}
              onPress={() => void toggle(d.key)}
              disabled={daysOff === null}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: off, disabled: daysOff === null }}
              accessibilityLabel={`${d.label}${off ? (de ? ', frei' : ', day off') : ''}`}
              testID={`barber-availability-day-off-${d.key}`}
              style={[
                styles.chip,
                { borderColor: off ? colors.error : colors.border, backgroundColor: off ? 'rgba(168,69,62,0.16)' : colors.surface },
              ]}
            >
              <Text style={[styles.weekday, { color: off ? colors.errorText : colors.textSecondary, fontFamily: fonts.body }]}>{d.weekday}</Text>
              <Text style={[styles.dayNumber, numericText, { color: off ? colors.errorText : colors.textPrimary }]}>{d.day}</Text>
              <Text style={[styles.state, { color: off ? colors.errorText : 'transparent', fontFamily: fonts.bodyMedium }]}>
                {de ? 'frei' : 'off'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.xl },
  title: { fontSize: 20, lineHeight: 26 },
  hint: { fontSize: 13, lineHeight: 19, marginTop: space.xs },
  row: { gap: space.sm, paddingVertical: space.md },
  chip: { width: 56, minHeight: 72, borderWidth: HAIRLINE, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 2 },
  weekday: { fontSize: 12 },
  dayNumber: { fontSize: 18 },
  state: { fontSize: 11 },
});
