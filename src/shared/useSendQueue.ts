/**
 * Send-queue hook shared by the two conversation screens (build-order step
 * 15-16). Owns the honest optimistic-send state: an in-flight send is a
 * PendingSend entry (local text + numeric key only — never a fabricated
 * row/id/timestamp), removed when the server returns the authoritative row
 * (handed to `onSent` for the caller's idempotent merge) or flipped to
 * `failed` for tap-to-retry.
 *
 * THE M1 GUARD (realtime-optimizer review, 2026-07-10): React state (`failed`
 * flags, disabled buttons) only takes effect after the next commit, so a
 * same-tick double-fire must be blocked SYNCHRONOUSLY — messages are
 * immutable and undeletable, so a duplicate insert is permanent. `inFlightRef`
 * is checked/added synchronously in both `runSend` and `retry`; the
 * complementary same-tick guard for the Send button itself (a ref mirror of
 * the draft, cleared synchronously before `submit`) lives in the screens,
 * next to their TextInput.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/** A not-yet-confirmed send — local text only, never a fabricated row. */
export interface PendingSend {
  key: number;
  text: string;
  failed: boolean;
}

/** What the caller's send function must resolve to. */
export type SendOutcome<TRow> = { status: 'ok'; row: TRow } | { status: 'failed' };

export interface UseSendQueueArgs<TRow> {
  /** Performs the actual write; resolves ok with the authoritative row. */
  send: (text: string) => Promise<SendOutcome<TRow>>;
  /** Called with the authoritative row on success — merge it into the list. */
  onSent: (row: TRow) => void;
}

export interface SendQueue {
  /** Oldest-first pending entries, for rendering below the real messages. */
  pending: PendingSend[];
  /** Enqueue + fire one send. Trims; empty text is a no-op. */
  submit: (rawText: string) => void;
  /** Re-fire a failed entry. Synchronously no-ops while that key is in flight. */
  retry: (key: number) => void;
}

export function useSendQueue<TRow>({ send, onSent }: UseSendQueueArgs<TRow>): SendQueue {
  const [pending, setPending] = useState<PendingSend[]>([]);
  const nextKeyRef = useRef(1);

  // Synchronous in-flight guard (M1) — see header.
  const inFlightRef = useRef<Set<number>>(new Set());

  // Ref mirrors so unstable callback identities never re-create anything,
  // and so `retry` can read the entry's text synchronously.
  const sendRef = useRef(send);
  const onSentRef = useRef(onSent);
  const pendingRef = useRef(pending);
  useEffect(() => {
    sendRef.current = send;
    onSentRef.current = onSent;
  }, [send, onSent]);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const runSend = useCallback(async (key: number, text: string) => {
    if (inFlightRef.current.has(key)) return; // synchronous double-fire guard
    inFlightRef.current.add(key);
    const result = await sendRef.current(text);
    inFlightRef.current.delete(key);
    if (result.status === 'ok') {
      setPending((prev) => prev.filter((p) => p.key !== key));
      onSentRef.current(result.row);
    } else {
      setPending((prev) => prev.map((p) => (p.key === key ? { ...p, failed: true } : p)));
    }
  }, []);

  const submit = useCallback(
    (rawText: string) => {
      const text = rawText.trim();
      if (text.length === 0) return;
      const key = nextKeyRef.current++;
      setPending((prev) => [...prev, { key, text, failed: false }]);
      void runSend(key, text);
    },
    [runSend]
  );

  const retry = useCallback(
    (key: number) => {
      if (inFlightRef.current.has(key)) return; // synchronous double-tap guard
      const entry = pendingRef.current.find((p) => p.key === key);
      if (!entry) return;
      setPending((prev) => prev.map((p) => (p.key === key ? { ...p, failed: false } : p)));
      void runSend(key, entry.text);
    },
    [runSend]
  );

  return { pending, submit, retry };
}
