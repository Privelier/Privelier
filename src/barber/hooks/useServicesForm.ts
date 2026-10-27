/**
 * The barber's own services and the add/edit form state. Writes go through
 * servicesData.ts; RLS is the authority. Client-side validation only checks
 * a non-empty name, price >= 0 and a whole-minute duration > 0, plus a soft,
 * non-blocking duplicate-name warning (duplicates are allowed in the DB).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../shared/components/ToastProvider';
import type { ServiceRow } from '../../types';
import { createService, deleteService, listOwnServices, updateService } from '../servicesData';

export interface FieldErrors {
  name?: string;
  price?: string;
  duration?: string;
}

export type FieldName = 'name' | 'price' | 'duration';

function nameError(value: string, de: boolean): string | undefined {
  return value.trim().length === 0 ? (de ? 'Gib einen Namen für die Leistung ein.' : 'Enter a service name.') : undefined;
}

function priceError(value: string, de: boolean): string | undefined {
  if (value.trim().length === 0) return de ? 'Gib einen Preis ein.' : 'Enter a price.';
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return de ? 'Gib einen Preis von 0 oder mehr ein.' : 'Enter a price of 0 or more.';
  return undefined;
}

function durationError(value: string, de: boolean): string | undefined {
  if (value.trim().length === 0) return de ? 'Gib eine Dauer ein.' : 'Enter a duration.';
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return de ? 'Gib die Dauer in ganzen Minuten an, größer als 0.' : 'Enter a duration in whole minutes, greater than 0.';
  return undefined;
}

function accountMissing(de: boolean): string {
  return de ? 'Dein Konto wurde nicht gefunden. Melde dich ab und wieder an.' : 'We could not find your account. Try signing out and back in.';
}

export function useServicesForm(de: boolean) {
  const { showToast } = useToast();
  const [pendingDelete, setPendingDelete] = useState<ServiceRow | null>(null);

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
  const [focusedField, setFocusedField] = useState<FieldName | null>(null);

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
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const id = data.session?.user.id ?? null;
      setBarberId(id);
      if (id) {
        void loadServices(id);
      } else {
        setListLoading(false);
        setListError(accountMissing(de));
      }
    });
    return () => {
      active = false;
    };
  }, [loadServices, de]);

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
    return services.some((service) => service.id !== editingId && service.name.trim().toLowerCase() === trimmed);
  }, [name, services, editingId]);

  const onSubmit = useCallback(async () => {
    const errors: FieldErrors = {
      name: nameError(name, de),
      price: priceError(price, de),
      duration: durationError(duration, de),
    };
    setFieldErrors(errors);
    setFormError(null);
    if (errors.name || errors.price || errors.duration) return;
    if (!barberId) {
      setFormError(accountMissing(de));
      return;
    }

    setSubmitting(true);
    const fields = { name: name.trim(), price: Number(price), durationMinutes: Number(duration) };

    if (editingId) {
      const result = await updateService(editingId, fields);
      setSubmitting(false);
      if (result.status === 'ok') {
        resetForm();
        void loadServices(barberId);
      } else if (result.status === 'not_found') {
        setFormError(de ? 'Diese Leistung gibt es nicht mehr.' : 'This service no longer exists.');
        void loadServices(barberId);
      } else {
        setFormError(result.message);
      }
    } else {
      const result = await createService({ barberId, ...fields });
      setSubmitting(false);
      if (result.status === 'ok') {
        resetForm();
        void loadServices(barberId);
      } else {
        setFormError(result.message);
      }
    }
  }, [name, price, duration, barberId, editingId, resetForm, loadServices, de]);

  const confirmDelete = useCallback(async () => {
    const service = pendingDelete;
    setPendingDelete(null);
    if (!service) return;
    const result = await deleteService(service.id);
    if (result.status === 'ok' || result.status === 'not_found') {
      setServices((current) => current.filter((item) => item.id !== service.id));
      if (editingId === service.id) resetForm();
      showToast({ message: de ? `„${service.name}“ gelöscht.` : `Deleted "${service.name}".` });
    } else {
      showToast({ message: `${de ? 'Löschen fehlgeschlagen.' : 'Could not delete.'} ${result.message}` });
    }
  }, [pendingDelete, editingId, resetForm, showToast, de]);

  return {
    services,
    listLoading,
    listError,
    pendingDelete,
    setPendingDelete,
    confirmDelete,
    startEdit,
    form: {
      editingId,
      name,
      setName,
      price,
      setPrice,
      duration,
      setDuration,
      fieldErrors,
      formError,
      submitting,
      focusedField,
      setFocusedField,
      isDuplicateName,
      onSubmit,
      resetForm,
    },
  };
}

export type ServicesFormState = ReturnType<typeof useServicesForm>['form'];
