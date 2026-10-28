/**
 * "Did they get your look?" on the review screen (Looks S2, flag-gated):
 * the style the client wanted, then exact / close / miss. Optional; only
 * "exact" counts as a hit in the barber's rate (L7).
 */
import { StyleSheet, Text, View } from 'react-native';
import { GlassChip } from '../../../shared/components/GlassChip';
import type { LookStyle, LookVerdict } from '../../../looks/types';
import { space } from '../../../theme/spacing';
import { useTheme } from '../../../theme/useTheme';

const VERDICTS: readonly LookVerdict[] = ['exact', 'close', 'miss'];

function verdictLabel(verdict: LookVerdict, de: boolean): string {
  switch (verdict) {
    case 'exact': return de ? 'Genau getroffen' : 'Spot on';
    case 'close': return de ? 'Fast' : 'Close';
    case 'miss': return de ? 'Nein' : 'Missed it';
  }
}

export function LookFeedbackField({ styles: lookStyles, style, onStyle, verdict, onVerdict, de, disabled }: {
  styles: readonly LookStyle[];
  style: string | null;
  onStyle: (key: string) => void;
  verdict: LookVerdict | null;
  onVerdict: (verdict: LookVerdict) => void;
  de: boolean;
  disabled: boolean;
}) {
  const { colors, fonts } = useTheme();
  if (lookStyles.length === 0) return null;
  const label = [styles.label, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }];
  return (
    <View testID="customer-review-look">
      <Text style={label}>{de ? 'Hat er deinen Look getroffen? (optional)' : 'Did they get your look? (optional)'}</Text>
      <Text style={[styles.hint, { color: colors.textSecondary, fontFamily: fonts.body }]}>{de ? 'Welchen Stil wolltest du?' : 'Which style did you want?'}</Text>
      <View style={styles.row}>
        {lookStyles.map((item) => (
          <GlassChip
            key={item.key}
            label={de ? item.label_de : item.label_en}
            selected={style === item.key}
            onPress={() => { if (!disabled) onStyle(item.key); }}
            size="compact"
            testID={`customer-review-look-style-${item.key}`}
          />
        ))}
      </View>
      <View style={[styles.row, styles.verdicts]}>
        {VERDICTS.map((item) => (
          <GlassChip
            key={item}
            label={verdictLabel(item, de)}
            selected={verdict === item}
            onPress={() => { if (!disabled) onVerdict(item); }}
            testID={`customer-review-look-verdict-${item}`}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, marginTop: 28, marginBottom: space.sm },
  hint: { fontSize: 12, lineHeight: 16, marginBottom: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  verdicts: { marginTop: space.md },
});
