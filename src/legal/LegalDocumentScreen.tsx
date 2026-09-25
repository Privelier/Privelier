import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import { space } from '../theme/spacing';
import type { LegalDocument } from './legalConfig';
import impressum from './documents/impressum';
import privacy from './documents/privacy';
import customerTerms from './documents/customerTerms';
import barberTerms from './documents/barberTerms';

const DOCUMENTS: Record<LegalDocument, string> = { impressum, privacy, customerTerms, barberTerms };

interface Props {
  route: { params: { document: LegalDocument } };
  navigation: { goBack: () => void };
}

export default function LegalDocumentScreen({ route, navigation }: Props) {
  const { colors, fonts } = useTheme();
  const document = route.params.document;
  const text = DOCUMENTS[document];
  const lines = text.split('\n');
  const title = lines[2] ?? 'Rechtliche Informationen';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']} testID="legal-document-screen">
      <View style={styles.header}>
        <Pressable
          onPress={navigation.goBack}
          accessibilityRole="button"
          accessibilityLabel="Zurück"
          hitSlop={10}
          testID="legal-document-back"
          style={styles.back}
        >
          <Feather name="arrow-left" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>{title}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.draft, { color: colors.accentText, fontFamily: fonts.bodyMedium }]} testID="legal-document-draft">
          Entwurf, noch nicht rechtsverbindlich
        </Text>
        <Text selectable style={[styles.body, { color: colors.textPrimary, fontFamily: fonts.body }]} testID={`legal-document-${document}-content`}>
          {text}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, gap: space.md },
  back: { width: 44, height: 44, justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 20 },
  content: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space['2xl'] },
  draft: { fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: space.lg },
  body: { fontSize: 16, lineHeight: 27 },
});
