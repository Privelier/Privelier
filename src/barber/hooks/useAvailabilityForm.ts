/**
 * The barber's availability windows and the create/edit/delete form.
 *
 * A window is EITHER a day of week OR a specific date; the form switches
 * between the two so they are always mutually exclusive (the database's
 * chk_availability_day_or_date check is the authority). day_of_week follows
 * JS Date#getDay() and Postgres extract(dow): 0 = Sunday .. 6 = Saturday.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../shared/components/ToastProvider';
import type { AvailabilityRow } from '../../types';
import { createAvailabilityWindow, deleteAvailabilityWindow, listOwnAvailability, updateAvailabilityWindow } from '../availabilityData';

export type AvailabilityMode = 'day' | 'date';

export interface AvailabilityFieldErrors {
  day?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Server rows may come back as "HH:MM:SS"; the form edits HH:MM. */
export function toHm(time: string): string {
  return time.length >= 5 ? time.slice(0, 5) : time;
}

/** Typed digits shaped into HH:MM as the barber types ("0930" → "09:30");
 * an impossible time is still caught by the validation below. */
export function formatTimeEntry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

/** Typed digits shaped into YYYY-MM-DD. */
export function formatDateEntry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 6) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
  if (digits.length > 4) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return digits;
}

function dateFieldError(value: string, de: boolean): string | undefined {
  if (value.trim().length === 0) return de ? 'Gib ein Datum ein.' : 'Enter a date.';
  if (!DATE_PATTERN.test(value.trim())) return de ? 'Nutze das Format JJJJ-MM-TT.' : 'Use the format YYYY-MM-DD.';
  if (Number.isNaN(new Date(value.trim()).getTime())) return de ? 'Dieses Datum ist nicht gültig.' : 'That date is not valid.';
  return undefined;
}

function timeFieldError(value: string, which: 'start' | 'end', de: boolean): string | undefined {
  if (value.trim().length === 0) return de ? `Gib eine ${which === 'start' ? 'Start' : 'End'}zeit ein.` : `Enter a ${which} time.`;
  if (!TIME_PATTERN.test(value.trim())) return de ? 'Nutze das 24-Stunden-Format HH:MM.' : 'Use the 24-hour format HH:MM.';
  return undefined;
}

export function useAvailabilityForm(de: boolean) {
  const { showToast } = useToast();
  const accountMissing = de ? 'Dein Konto wurde nicht gefunden. Melde dich ab und wieder an.' : 'We could not find your account. Try signing out and back in.';
  const [barberId, setBarberId] = useState<string | null>(null);
  const [windows, setWindows] = useState<AvailabilityRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AvailabilityRow | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mode, setMode] = useState<AvailabilityMode>('day');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [specificDate, setSpecificDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [fieldErrors, setFieldErrors] = useState<AvailabilityFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadWindows = useCallback(async (id: string) => {
    setListLoading(true);
    setListError(null);
    const result = await listOwnAvailability(id);
    setListLoading(false);
    if (result.status === 'ok') setWindows(result.windows);
    else setListError(result.message);
  }, []);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const id = data.session?.user.id ?? null;
      setBarberId(id);
      if (id) {
        void loadWindows(id);
      } else {
        setListLoading(false);
        setListError(accountMissing);
      }
    });
    return () => {
      active = false;
    };
  }, [loadWindows, accountMissing]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setMode('day');
    setSelectedDay(null);
    setSpecificDate('');
    setStartTime('');
    setEndTime('');
    setFieldErrors({});
    setFormError(null);
  }, []);

  const startEdit = useCallback((window: AvailabilityRow) => {
    setEditingId(window.id);
    if (window.day_of_week !== null) {
      setMode('day');
      setSelectedDay(window.day_of_week);
      setSpecificDate('');
    } else {
      setMode('date');
      setSelectedDay(null);
      setSpecificDate(window.specific_date ?? '');
    }
    setStartTime(toHm(window.start_time));
    setEndTime(toHm(window.end_time));
    setFieldErrors({});
    setFormError(null);
  }, []);

  const switchMode = useCallback((next: AvailabilityMode) => {
    setMode(next);
    setFieldErrors({});
    setFormError(null);
  }, []);

  const submit = useCallback(async () => {
    const errors: AvailabilityFieldErrors = {
      day: mode === 'day' && selectedDay === null ? (de ? 'Wähle einen Wochentag.' : 'Choose a day of the week.') : undefined,
      date: mode === 'date' ? dateFieldError(specificDate, de) : undefined,
      startTime: timeFieldError(startTime, 'start', de),
      endTime: timeFieldError(endTime, 'end', de),
    };
    setFieldErrors(errors);
    setFormError(null);
    if (errors.day || errors.date || errors.startTime || errors.endTime) return;
    if (startTime.trim() >= endTime.trim()) {
      setFieldErrors({ ...errors, endTime: de ? 'Die Endzeit muss nach der Startzeit liegen.' : 'End time must be after start time.' });
      return;
    }
    if (!barberId) {
      setFormError(accountMissing);
      return;
    }

    setSubmitting(true);
    if (editingId) {
      const result = await updateAvailabilityWindow(editingId, {
        dayOfWeek: mode === 'day' ? selectedDay : null,
        specificDate: mode === 'date' ? specificDate.trim() : null,
        startTime: startTime.trim(),
        endTime: endTime.trim(),
      });
      setSubmitting(false);
      if (result.status === 'ok') {
        resetForm();
        void loadWindows(barberId);
      } else if (result.status === 'not_found') {
        setFormError(de ? 'Dieses Zeitfenster gibt es nicht mehr.' : 'This availability window no longer exists.');
        void loadWindows(barberId);
      } else {
        setFormError(result.message);
      }
      return;
    }
    const result = await createAvailabilityWindow({
      barberId,
      dayOfWeek: mode === 'day' ? (selectedDay ?? undefined) : undefined,
      specificDate: mode === 'date' ? specificDate.trim() : undefined,
      startTime: startTime.trim(),
      endTime: endTime.trim(),
    });
    setSubmitting(false);
    if (result.status === 'ok') {
      resetForm();
      void loadWindows(barberId);
    } else {
      setFormError(result.message);
    }
  }, [mode, selectedDay, specificDate, startTime, endTime, barberId, editingId, resetForm, loadWindows, de, accountMissing]);

  const confirmDelete = useCallback(async () => {
    const window = pendingDelete;
    setPendingDelete(null);
    if (!window) return;
    const result = await deleteAvailabilityWindow(window.id);
    if (result.status === 'ok' || result.status === 'not_found') {
      setWindows((current) => current.filter((item) => item.id !== window.id));
      if (editingId === window.id) resetForm();
      showToast({ message: de ? 'Zeitfenster gelöscht.' : 'Availability window deleted.' });
    } else {
      showToast({ message: `${de ? 'Löschen fehlgeschlagen.' : 'Could not delete.'} ${result.message}` });
    }
  }, [pendingDelete, editingId, resetForm, showToast, de]);

  return {
    barberId,
    windows,
    listLoading,
    listError,
    pendingDelete,
    setPendingDelete,
    confirmDelete,
    form: {
      editingId,
      mode,
      selectedDay,
      specificDate,
      startTime,
      endTime,
      fieldErrors,
      formError,
      submitting,
      setSelectedDay,
      setSpecificDate,
      setStartTime,
      setEndTime,
      switchMode,
      resetForm,
      submit,
    },
    startEdit,
  };
}

export type AvailabilityFormState = ReturnType<typeof useAvailabilityForm>['form'];
