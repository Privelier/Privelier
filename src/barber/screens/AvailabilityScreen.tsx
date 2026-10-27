/**
 * Barber availability: days off, the add/edit form and the list of weekly
 * and one-date windows. State and writes live in useAvailabilityForm; the
 * form is components/availability/AvailabilityForm.
 */
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ConfirmSheet } from '../../shared/components/ConfirmSheet';
import { BackButton } from '../../shared/components/ScreenBackHeader';
import { RowListSkeleton } from '../../shared/components/ScreenSkeletons';
import { getAppLanguage } from '../../shared/locale';
import { pressOpacity } from '../../theme/motion';
import { HAIRLINE } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import type { AvailabilityRow } from '../../types';
import { AvailabilityForm } from '../components/availability/AvailabilityForm';
import { availabilityStyles as styles, dayLabels } from '../components/availability/availabilityStyles';
import { DaysOffStrip } from '../components/DaysOffStrip';
import { toHm, useAvailabilityForm } from '../hooks/useAvailabilityForm';
import type { BarberStackParamList } from '../BarberNavigator';

type Props = NativeStackScreenProps<BarberStackParamList, 'Availability'>;

function windowLabel(window: AvailabilityRow, de: boolean): string {
  return window.day_of_week !== null ? dayLabels(de)[window.day_of_week] : (window.specific_date ?? '');
}

function WindowRow({ item, index, de, onEdit, onDelete }: {
  item: AvailabilityRow;
  index: number;
  de: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { colors, fonts } = useTheme();
  const label = windowLabel(item, de);
  const hours = `${toHm(item.start_time)}–${toHm(item.end_time)}`;
  return (
    <View style={[styles.row, index > 0 ? { borderTopWidth: HAIRLINE, borderTopColor: colors.border } : null]} testID={`barber-availability-row-${item.id}`}>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowName, { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }]}>{label}</Text>
        <Text style={[styles.rowMeta, { color: colors.textSecondary, fontFamily: fonts.body }]}>{`${toHm(item.start_time)} – ${toHm(item.end_time)}`}</Text>
      </View>
      <View style={styles.rowActions}>
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={`${de ? 'Bearbeiten' : 'Edit'}: ${label} ${hours}`}
          hitSlop={14}
          testID={`barber-availability-edit-${item.id}`}
          style={({ pressed }) => (pressed ? { opacity: pressOpacity.soft } : null)}
        >
          {/* Plain, not brass: brass is kept for the one primary action. */}
          <Text style={[styles.rowActionText, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{de ? 'Bearbeiten' : 'Edit'}</Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={`${de ? 'Löschen' : 'Delete'}: ${label} ${hours}`}
          hitSlop={14}
          testID={`barber-availability-delete-${item.id}`}
          style={({ pressed }) => (pressed ? { opacity: pressOpacity.firm } : null)}
        >
          <Text style={[styles.rowActionText, { color: colors.errorText, fontFamily: fonts.bodyMedium }]}>{de ? 'Löschen' : 'Delete'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function AvailabilityScreen({ navigation }: Props) {
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const { barberId, windows, listLoading, listError, pendingDelete, setPendingDelete, confirmDelete, form, startEdit } = useAvailabilityForm(de);
  const pendingDeleteLabel = pendingDelete ? windowLabel(pendingDelete, de) : '';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} testID="barber-availability-screen">
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} testID="barber-availability-back" />
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>{de ? 'Verfügbarkeit' : 'Availability'}</Text>
      </View>

      <FlatList
        data={windows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <DaysOffStrip barberId={barberId} />
            <AvailabilityForm form={form} de={de} />
            <View style={styles.listHeader}>
              <Text style={[styles.listTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>{de ? 'Deine Verfügbarkeit' : 'Your availability'}</Text>
              {listLoading ? <RowListSkeleton testID="barber-availability-loading" label={de ? 'Verfügbarkeit wird geladen' : 'Loading your availability'} /> : null}
              {listError ? <Text style={[styles.errorText, { color: colors.errorText, fontFamily: fonts.body }]}>{listError}</Text> : null}
              {!listLoading && !listError && windows.length === 0 ? (
                <Text style={[styles.helperText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                  {de ? 'Du hast noch keine Verfügbarkeit angelegt.' : 'You have not added any availability yet.'}
                </Text>
              ) : null}
            </View>
          </>
        }
        renderItem={({ item, index }) => (
          <WindowRow item={item} index={index} de={de} onEdit={() => startEdit(item)} onDelete={() => setPendingDelete(item)} />
        )}
      />
      <ConfirmSheet
        open={pendingDelete !== null}
        title={de ? 'Zeitfenster löschen' : 'Delete availability'}
        message={de
          ? `Das Zeitfenster am ${pendingDeleteLabel} löschen? Das kann nicht rückgängig gemacht werden.`
          : `Delete the window on ${pendingDeleteLabel}? This cannot be undone.`}
        confirmLabel={de ? 'Löschen' : 'Delete'}
        cancelLabel={de ? 'Abbrechen' : 'Cancel'}
        destructive
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
        testID="barber-availability-delete-confirm"
      />
    </SafeAreaView>
  );
}
