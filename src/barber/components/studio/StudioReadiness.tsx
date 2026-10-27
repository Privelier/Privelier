/**
 * The verification line at the top of Studio and the setup checklist that
 * shows until the profile is live. Every unfinished item opens the screen
 * that completes it.
 */
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { pressOpacity } from '../../../theme/motion';
import { HAIRLINE } from '../../../theme/spacing';
import { useTheme } from '../../../theme/useTheme';
import type { VerificationStatus } from '../../../types';
import type { DashboardView, ReadinessItem, ReadinessItemKey, ReadinessState } from '../../types';
import { SectionUnavailable } from './StudioParts';
import { studioStyles as styles } from './studioStyles';

const READINESS_ICONS: Record<ReadinessState, keyof typeof Feather.glyphMap> = {
  complete: 'check-circle',
  incomplete: 'circle',
  in_progress: 'clock',
  attention: 'alert-circle',
  unavailable: 'help-circle',
};

function verificationLine(status: VerificationStatus | null, de: boolean): string {
  switch (status) {
    case 'approved': return de ? 'Verifizierung bestätigt. Dein Profil kann in der Kundensuche erscheinen.' : 'Verification approved. Your profile can appear in customer search.';
    case 'pending': return de ? 'Deine Verifizierung wird persönlich geprüft.' : 'Verification is under manual review.';
    case 'rejected': return de ? 'Deine Verifizierung braucht deine Aufmerksamkeit.' : 'Verification needs your attention.';
    default: return de ? 'Verifiziere dein Profil, um in der Kundensuche zu erscheinen.' : 'Verify your profile to appear in customer search.';
  }
}

const UNAVAILABLE: Record<ReadinessItemKey, { en: string; de: string }> = {
  services: { en: 'Could not check services', de: 'Leistungen konnten nicht geprüft werden' },
  availability: { en: 'Could not check availability', de: 'Verfügbarkeit konnte nicht geprüft werden' },
  location: { en: 'Could not check location', de: 'Standort konnte nicht geprüft werden' },
  portfolio: { en: 'Could not check portfolio', de: 'Portfolio konnte nicht geprüft werden' },
  bio: { en: 'Could not check bio', de: 'Bio konnte nicht geprüft werden' },
  verification: { en: 'Could not check verification', de: 'Verifizierung konnte nicht geprüft werden' },
};

const DONE_TODO: Record<Exclude<ReadinessItemKey, 'verification'>, { done: [string, string]; todo: [string, string] }> = {
  services: { done: ['Services added', 'Leistungen angelegt'], todo: ['Add a service', 'Leistung hinzufügen'] },
  availability: { done: ['Availability set', 'Verfügbarkeit festgelegt'], todo: ['Set your availability', 'Verfügbarkeit festlegen'] },
  location: { done: ['Location added', 'Standort hinzugefügt'], todo: ['Add your location', 'Standort hinzufügen'] },
  portfolio: { done: ['Portfolio photos added', 'Portfoliobilder hinzugefügt'], todo: ['Add portfolio photos', 'Portfoliobilder hinzufügen'] },
  bio: { done: ['Bio added', 'Bio hinzugefügt'], todo: ['Add a short bio', 'Kurze Bio hinzufügen'] },
};

function readinessLabel(item: ReadinessItem, de: boolean): string {
  if (item.state === 'unavailable') return UNAVAILABLE[item.key][de ? 'de' : 'en'];
  if (item.key === 'verification') {
    if (item.state === 'complete') return de ? 'Verifiziert' : 'Verified';
    if (item.state === 'attention') return de ? 'Verifizierung braucht Aufmerksamkeit' : 'Verification needs attention';
    return de ? 'Verifizierung in Prüfung' : 'Verification in review';
  }
  const pair = DONE_TODO[item.key][item.state === 'complete' ? 'done' : 'todo'];
  return de ? pair[1] : pair[0];
}

export function VerificationLine({
  profile,
  retrying,
  de,
  onOpen,
  onRetry,
}: {
  profile: DashboardView['profile'];
  retrying: boolean;
  de: boolean;
  onOpen: () => void;
  onRetry: () => void;
}) {
  const { colors, fonts } = useTheme();
  if (profile.status !== 'ok') {
    return (
      <View testID="barber-dashboard-verification" style={styles.verification}>
        <SectionUnavailable label={de ? 'Verifizierungsstatus' : 'Verification status'} testID="barber-dashboard-verification-unavailable" onRetry={onRetry} retrying={retrying} de={de} />
      </View>
    );
  }
  const status = profile.data.verification;
  const text = verificationLine(status, de);
  const tone = status === 'rejected' ? colors.errorText : status === 'approved' ? colors.accentText : colors.textSecondary;
  return (
    <View testID="barber-dashboard-verification" style={styles.verification}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${text} View verification.`}
        style={({ pressed }) => [styles.verificationLink, { opacity: pressed ? pressOpacity.soft : 1 }]}
      >
        <Feather name={status === 'approved' ? 'check-circle' : status === 'rejected' ? 'alert-circle' : 'clock'} size={16} color={tone} />
        <Text style={[styles.verificationText, { color: status === 'rejected' ? colors.errorText : colors.textSecondary, fontFamily: fonts.body }]}>
          {text}
        </Text>
        <Feather name="chevron-right" size={16} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

export function StudioReadiness({
  readiness,
  retrying,
  de,
  onOpenItem,
  onRetry,
}: {
  readiness: DashboardView['readiness'];
  retrying: boolean;
  de: boolean;
  onOpenItem: (key: ReadinessItemKey) => void;
  onRetry: () => void;
}) {
  const { colors, fonts } = useTheme();
  return (
    <View testID="barber-dashboard-readiness" style={[styles.readiness, { borderTopColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>{de ? 'Studio einrichten' : 'Studio setup'}</Text>
      <Text style={[styles.readinessStatus, { color: colors.textSecondary, fontFamily: fonts.body }]}>
        {readiness.isLive === null
          ? `${readiness.completeCount} confirmed complete; ${readiness.unavailableCount} unavailable`
          : `${readiness.completeCount} of ${readiness.total} complete`}
      </Text>
      {readiness.unavailableCount > 0 ? (
        <SectionUnavailable label={de ? 'Einige Einrichtungsdetails' : 'Some setup details'} testID="barber-dashboard-readiness-unavailable" onRetry={onRetry} retrying={retrying} de={de} />
      ) : null}
      <View style={styles.meter} accessible={false} importantForAccessibility="no-hide-descendants">
        {readiness.items.map((item) => (
          <View key={item.key} style={[styles.meterSegment, { backgroundColor: item.state === 'complete' ? colors.accent : colors.border }]} />
        ))}
      </View>
      <View style={styles.readinessItems}>
        {readiness.items.map((item, index) => {
          const done = item.state === 'complete';
          const label = readinessLabel(item, de);
          return (
            <Pressable
              key={item.key}
              onPress={done ? undefined : () => onOpenItem(item.key)}
              disabled={done}
              accessibilityRole={done ? 'text' : 'button'}
              accessibilityState={{ disabled: done }}
              accessibilityLabel={label}
              testID={`barber-dashboard-readiness-${item.key}`}
              style={({ pressed }) => [
                styles.readinessRow,
                {
                  borderBottomWidth: index === readiness.items.length - 1 ? 0 : HAIRLINE,
                  borderColor: colors.border,
                  opacity: pressed && !done ? pressOpacity.soft : 1,
                },
              ]}
            >
              <Feather name={READINESS_ICONS[item.state]} size={17} color={item.state === 'attention' ? colors.errorText : colors.textSecondary} />
              <Text style={[styles.readinessLabel, { color: done ? colors.textSecondary : colors.textPrimary, fontFamily: done ? fonts.body : fonts.bodyMedium }]}>
                {label}
              </Text>
              {done ? null : <Feather name="chevron-right" size={16} color={colors.textSecondary} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
