/**
 * Barber "add a service" + manage-services screen (build-order step 7-8).
 *
 * Lists the barber's own services and lets them create/edit/delete a service
 * via the Stage 4 data layer (servicesData.ts). All authorization is enforced
 * server-side by RLS; this screen only does client-side input validation
 * (non-empty name, price >= 0, duration > 0) plus a soft, non-blocking
 * duplicate-name warning (duplicate names are allowed at the DB level per the
 * Stage 2 architect review).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../../../lib/supabase';
import { useTheme } from '../../theme/useTheme';
import type { ServiceRow } from '../../types';
import { createService, deleteService, listOwnServices, updateService } from '../servicesData';
import type { BarberStackParamList } from '../BarberNavigator';

type Props = NativeStackScreenProps<BarberStackParamList, 'Services'>;

interface FieldErrors {
  name?: string;
  price?: string;
  duration?: string;
}

function nameError(value: string): string | undefined {
  return value.trim().length === 0 ? 'Enter a service name.' : undefined;
}

function priceError(value: string): string | undefined {
  if (value.trim().length === 0) return 'Enter a price.';
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 'Enter a price of 0 or more.';
  return undefined;
}

function durationError(value: string): string | undefined {
  if (value.trim().length === 0) return 'Enter a duration.';
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return 'Enter a duration in whole minutes, greater than 0.';
  return undefined;
}

export default function ServicesScreen({ navigation }: Props) {
  const { colors, fonts } = useTheme();

  const [barberId, setBarberId] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadServices = useCallback(async (id: string) => {
    setListLoading(true);
    setListError(null);
    const result = await listOwnServices(id);
    setListLoading(false);
    if (result.status === 'ok') {
      setServices(result.services);
    } else {
      setListError(result.message);
    }
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const id = data.session?.user.id ?? null;
      setBarberId(id);
      if (id) {
        void loadServices(id);
      } else {
        setListLoading(false);
        setListError('We could not find your account. Try signing out and back in.');
      }
    });
    return () => {
      active = false;
    };
  }, [loadServices]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setName('');
    setPrice('');
    setDuration('');
    setFieldErrors({});
    setFormError(null);
  }, []);

  const startEdit = useCallback((service: ServiceRow) => {
    setEditingId(service.id);
    setName(service.name);
    setPrice(String(service.price));
    setDuration(String(service.duration_minutes));
    setFieldErrors({});
    setFormError(null);
  }, []);

  const isDuplicateName = useMemo(() => {
    const trimmed = name.trim().toLowerCase();
    if (trimmed.length === 0) return false;
    return services.some(
      (service) => service.id !== editingId && service.name.trim().toLowerCase() === trimmed
    );
  }, [name, services, editingId]);

  const onSubmit = useCallback(async () => {
    const errors: FieldErrors = {
      name: nameError(name),
      price: priceError(price),
      duration: durationError(duration),
    };
    setFieldErrors(errors);
    setFormError(null);
    if (errors.name || errors.price || errors.duration) return;
    if (!barberId) {
      setFormError('We could not find your account. Try signing out and back in.');
      return;
    }

    setSubmitting(true);
    const trimmedName = name.trim();
    const parsedPrice = Number(price);
    const parsedDuration = Number(duration);

    if (editingId) {
      const result = await updateService(editingId, {
        name: trimmedName,
        price: parsedPrice,
        durationMinutes: parsedDuration,
      });
      setSubmitting(false);
      if (result.status === 'ok') {
        resetForm();
        void loadServices(barberId);
      } else if (result.status === 'not_found') {
        setFormError('This service no longer exists.');
        void loadServices(barberId);
      } else {
        setFormError(result.message);
      }
    } else {
      const result = await createService({
        barberId,
        name: trimmedName,
        price: parsedPrice,
        durationMinutes: parsedDuration,
      });
      setSubmitting(false);
      if (result.status === 'ok') {
        resetForm();
        void loadServices(barberId);
      } else {
        setFormError(result.message);
      }
    }
  }, [name, price, duration, barberId, editingId, resetForm, loadServices]);

  const onDelete = useCallback(
    (service: ServiceRow) => {
      Alert.alert('Delete service', `Delete "${service.name}"? This cannot be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteService(service.id);
            if (result.status === 'ok' || result.status === 'not_found') {
              setServices((current) => current.filter((item) => item.id !== service.id));
              if (editingId === service.id) resetForm();
            } else {
              Alert.alert('Could not delete', result.message);
            }
          },
        },
      ]);
    },
    [editingId, resetForm]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} testID="barber-services-screen">
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={16}
          testID="barber-services-back"
        >
          <Text style={[styles.backText, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>
            {'‹ Back'}
          </Text>
        </Pressable>
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.heading }]}>
          Services
        </Text>
      </View>

      <FlatList
        data={services}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.formTitle, { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }]}>
              {editingId ? 'Edit service' : 'Add a service'}
            </Text>

            {formError ? (
              <View
                testID="barber-services-form-error"
                accessibilityRole="alert"
                style={[styles.notice, { borderColor: colors.error, backgroundColor: colors.background }]}
              >
                <Text style={[styles.noticeText, { color: colors.errorText, fontFamily: fonts.bodyMedium }]}>
                  {formError}
                </Text>
              </View>
            ) : null}

            <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>
              Name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Classic haircut"
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel="Name"
              style={[
                styles.input,
                {
                  color: colors.textPrimary,
                  borderColor: fieldErrors.name ? colors.error : colors.border,
                  fontFamily: fonts.body,
                },
              ]}
              testID="barber-services-name"
            />
            {fieldErrors.name ? (
              <Text style={[styles.errorText, { color: colors.errorText, fontFamily: fonts.body }]}>
                {fieldErrors.name}
              </Text>
            ) : isDuplicateName ? (
              <Text style={[styles.helperText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                You already have a service with this name. You can still save it.
              </Text>
            ) : null}

            <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>
              Price
            </Text>
            <TextInput
              value={price}
              onChangeText={setPrice}
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              accessibilityLabel="Price"
              style={[
                styles.input,
                {
                  color: colors.textPrimary,
                  borderColor: fieldErrors.price ? colors.error : colors.border,
                  fontFamily: fonts.body,
                },
              ]}
              testID="barber-services-price"
            />
            {fieldErrors.price ? (
              <Text style={[styles.errorText, { color: colors.errorText, fontFamily: fonts.body }]}>
                {fieldErrors.price}
              </Text>
            ) : null}

            <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>
              Duration (minutes)
            </Text>
            <TextInput
              value={duration}
              onChangeText={setDuration}
              placeholder="30"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              accessibilityLabel="Duration in minutes"
              style={[
                styles.input,
                {
                  color: colors.textPrimary,
                  borderColor: fieldErrors.duration ? colors.error : colors.border,
                  fontFamily: fonts.body,
                },
              ]}
              testID="barber-services-duration"
            />
            {fieldErrors.duration ? (
              <Text style={[styles.errorText, { color: colors.errorText, fontFamily: fonts.body }]}>
                {fieldErrors.duration}
              </Text>
            ) : null}

            <View style={styles.formActions}>
              <Pressable
                onPress={onSubmit}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel={editingId ? 'Save changes' : 'Add service'}
                testID="barber-services-submit"
                style={[styles.primaryButton, { backgroundColor: colors.accent, opacity: submitting ? 0.6 : 1 }]}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={colors.onAccent} />
                ) : (
                  <Text style={[styles.primaryButtonText, { color: colors.onAccent, fontFamily: fonts.bodySemiBold }]}>
                    {editingId ? 'Save changes' : 'Add service'}
                  </Text>
                )}
              </Pressable>
              {editingId ? (
                <Pressable
                  onPress={resetForm}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel edit"
                  testID="barber-services-cancel-edit"
                  style={styles.cancelButton}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>
                    Cancel
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <Text style={[styles.listTitle, { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }]}>
              Your services
            </Text>
            {listLoading ? <ActivityIndicator size="small" color={colors.accent} /> : null}
            {listError ? (
              <Text style={[styles.errorText, { color: colors.errorText, fontFamily: fonts.body }]}>
                {listError}
              </Text>
            ) : null}
            {!listLoading && !listError && services.length === 0 ? (
              <Text style={[styles.helperText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                You have not added any services yet.
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
            testID={`barber-services-row-${item.id}`}
          >
            <View style={styles.rowInfo}>
              <Text style={[styles.rowName, { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }]}>
                {item.name}
              </Text>
              <Text style={[styles.rowMeta, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                {`${item.price} · ${item.duration_minutes} min`}
              </Text>
            </View>
            <View style={styles.rowActions}>
              <Pressable
                onPress={() => startEdit(item)}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${item.name}`}
                hitSlop={8}
                testID={`barber-services-edit-${item.id}`}
              >
                <Text style={[styles.rowActionText, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>
                  Edit
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onDelete(item)}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${item.name}`}
                hitSlop={8}
                testID={`barber-services-delete-${item.id}`}
              >
                <Text style={[styles.rowActionText, { color: colors.errorText, fontFamily: fonts.bodyMedium }]}>
                  Delete
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 12, gap: 16 },
  backText: { fontSize: 15 },
  heading: { fontSize: 22 },
  listContent: { paddingHorizontal: 24, paddingBottom: 32 },
  form: { borderWidth: 0.5, borderRadius: 12, padding: 16, marginTop: 16, marginBottom: 16 },
  formTitle: { fontSize: 16, marginBottom: 12 },
  label: { fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 0.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  errorText: { fontSize: 13, marginTop: 4 },
  helperText: { fontSize: 13, marginTop: 4 },
  notice: { borderWidth: 0.5, borderRadius: 10, padding: 12, marginBottom: 12 },
  noticeText: { fontSize: 14 },
  formActions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16 },
  primaryButton: { borderRadius: 10, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontSize: 15 },
  cancelButton: { paddingVertical: 14, paddingHorizontal: 8 },
  cancelButtonText: { fontSize: 15 },
  listTitle: { fontSize: 15, marginTop: 24, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 0.5,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 15, marginBottom: 2 },
  rowMeta: { fontSize: 13 },
  rowActions: { flexDirection: 'row', gap: 16 },
  rowActionText: { fontSize: 14 },
});
