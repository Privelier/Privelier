/**
 * Auth secondary button, text link and OAuth provider button. The primary
 * CTA is the shared PrimaryButton.
 */
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { Button, ButtonText } from '../../../components/ui/button';
import { AuthProviderLogo } from '../../shared/components/AuthProviderLogo';
import { getAppLanguage } from '../../shared/locale';
import { radius, space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import { useTheme } from '../../theme/useTheme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  testID: string;
  loading?: boolean;
  disabled?: boolean;
}

export function SecondaryButton({ label, onPress, testID, loading = false, disabled = false }: ButtonProps) {
  const { colors, fonts } = useTheme();
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      testID={testID}
      style={({ pressed }) => [
        buttonStyles.secondary,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: inactive ? 0.6 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.textPrimary} />
      ) : (
        <Text
          style={[buttonStyles.secondaryLabel, { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function TextLink({ label, onPress, testID, disabled = false }: ButtonProps) {
  const { colors, fonts } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={8}
      testID={testID}
      style={({ pressed }) => [buttonStyles.link, { opacity: pressed || disabled ? 0.7 : 1 }]}
    >
      <Text style={[buttonStyles.linkLabel, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function OAuthButton({
  provider,
  onPress,
  testID,
  loading = false,
  disabled = false,
}: {
  provider: 'google' | 'apple';
  onPress: () => void;
  testID: string;
  loading?: boolean;
  disabled?: boolean;
}) {
  const { colors, fonts } = useTheme();
  const inactive = disabled || loading;
  const name = provider === 'google' ? 'Google' : 'Apple';
  const label = getAppLanguage() === 'de' ? `Weiter mit ${name}` : `Continue with ${name}`;
  return (
    <Button
      onPress={onPress}
      isDisabled={inactive}
      variant="outline"
      size="lg"
      className="rounded-full"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      testID={testID}
      style={[buttonStyles.oauth, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      {loading ? <ActivityIndicator size="small" color={colors.textPrimary} /> : (
        <>
          <AuthProviderLogo provider={provider} size={18} color={colors.textPrimary} />
          <ButtonText style={[buttonStyles.oauthLabel, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{label}</ButtonText>
        </>
      )}
    </Button>
  );
}

const buttonStyles = StyleSheet.create({
  secondary: {
    borderRadius: radius.pill,
    borderWidth: 0.5,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  secondaryLabel: { fontSize: typeScale.bodyLarge.fontSize },
  oauth: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    paddingVertical: 16,
    minHeight: 52,
  },
  oauthLabel: { fontSize: typeScale.bodyLarge.fontSize },
  link: { alignSelf: 'center', paddingVertical: 8 },
  linkLabel: typeScale.body,
});
