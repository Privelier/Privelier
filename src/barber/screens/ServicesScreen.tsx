/**
 * Barber "add a service" + manage-services screen: the add/edit form and the
 * list of the barber's own services. State, validation and writes live in
 * useServicesForm; the form is components/services/ServiceForm. All
 * authorization is enforced server-side by RLS.
 */
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ConfirmSheet } from '../../shared/components/ConfirmSheet';
import { BackButton } from '../../shared/components/ScreenBackHeader';
import { RowListSkeleton } from '../../shared/components/ScreenSkeletons';
import { formatMoney } from '../../shared/format';
import { getAppLanguage } from '../../shared/locale';
import { RevealItem } from '../../shared/motion/Reveal';
import { pressOpacity } from '../../theme/motion';
import { HAIRLINE } from '../../theme/spacing';
import { numericText } from '../../theme/typography';
import { useTheme } from '../../theme/useTheme';
import type { ServiceRow } from '../../types';
import { ServiceForm } from '../components/services/ServiceForm';
import { servicesStyles as styles } from '../components/services/servicesStyles';
import { useServicesForm } from '../hooks/useServicesForm';
import type { BarberStackParamList } from '../BarberNavigator';

type Props = NativeStackScreenProps<BarberStackParamList, 'Services'>;

function ServiceRowItem({ item, index, de, onEdit, onDelete }: {
  item: ServiceRow;
  index: number;
  de: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { colors, fonts } = useTheme();
  return (
    <RevealItem index={index}>
      <View style={[styles.row, index > 0 ? { borderTopWidth: HAIRLINE, borderTopColor: colors.border } : null]} testID={`barber-services-row-${item.id}`}>
        <View style={styles.rowInfo}>
          <Text style={[styles.rowName, { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }]}>{item.name}</Text>
          <Text style={[styles.rowMeta, numericText, { color: colors.textSecondary }]}>{`${formatMoney(item.price)} · ${item.duration_minutes} min`}</Text>
        </View>
        <View style={styles.rowActions}>
          <Pressable
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel={de ? `${item.name} bearbeiten` : `Edit ${item.name}`}
            hitSlop={14}
            testID={`barber-services-edit-${item.id}`}
            style={({ pressed }) => (pressed ? { opacity: pressOpacity.soft } : null)}
          >
            {/* Plain, not brass: brass is kept for live states, not a repeated per-row link. */}
            <Text style={[styles.rowActionText, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{de ? 'Bearbeiten' : 'Edit'}</Text>
          </Pressable>
          <Pressable
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel={de ? `${item.name} löschen` : `Delete ${item.name}`}
            hitSlop={14}
            testID={`barber-services-delete-${item.id}`}
            style={({ pressed }) => (pressed ? { opacity: pressOpacity.firm } : null)}
          >
            <Text style={[styles.rowActionText, { color: colors.errorText, fontFamily: fonts.bodyMedium }]}>{de ? 'Löschen' : 'Delete'}</Text>
          </Pressable>
        </View>
      </View>
    </RevealItem>
  );
}

export default function ServicesScreen({ navigation }: Props) {
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const { services, listLoading, listError, pendingDelete, setPendingDelete, confirmDelete, startEdit, form } = useServicesForm(de);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} testID="barber-services-screen">
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} testID="barber-services-back" />
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>{de ? 'Leistungen' : 'Services'}</Text>
      </View>

      <FlatList
        data={services}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <ServiceForm form={form} de={de} />
            <View style={styles.listHeader}>
              <Text style={[styles.listTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>{de ? 'Deine Leistungen' : 'Your services'}</Text>
              {listLoading ? <RowListSkeleton testID="barber-services-loading" label={de ? 'Leistungen werden geladen' : 'Loading your services'} /> : null}
              {listError ? <Text style={[styles.errorText, { color: colors.errorText, fontFamily: fonts.body }]}>{listError}</Text> : null}
              {!listLoading && !listError && services.length === 0 ? (
                <Text style={[styles.helperText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                  {de ? 'Du hast noch keine Leistungen angelegt.' : 'You have not added any services yet.'}
                </Text>
              ) : null}
            </View>
          </>
        }
        renderItem={({ item, index }) => (
          <ServiceRowItem item={item} index={index} de={de} onEdit={() => startEdit(item)} onDelete={() => setPendingDelete(item)} />
        )}
      />
      <ConfirmSheet
        open={pendingDelete !== null}
        title={de ? 'Leistung löschen' : 'Delete service'}
        message={de
          ? `„${pendingDelete?.name ?? ''}“ löschen? Das kann nicht rückgängig gemacht werden.`
          : `Delete "${pendingDelete?.name ?? ''}"? This cannot be undone.`}
        confirmLabel={de ? 'Löschen' : 'Delete'}
        cancelLabel={de ? 'Abbrechen' : 'Cancel'}
        destructive
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
        testID="barber-services-delete-confirm"
      />
    </SafeAreaView>
  );
}
