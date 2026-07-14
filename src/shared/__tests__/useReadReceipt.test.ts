/**
 * Tests for the read-receipt realtime hook (src/shared/useReadReceipt.ts) —
 * same fake-channel approach as useMessagesRealtime.test.ts, plus a
 * chainable chat_read_state read builder. Pinned contracts: the M2 baseline
 * ordering (fetch on every SUBSCRIBED, never before), the F1 recovery
 * refetch, own-row event exclusion, and the C3 monotonic merge (a stale
 * event can never regress an established receipt).
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { supabase } from '../../../lib/supabase';
import { useReadReceipt, type UseReadReceiptArgs } from '../useReadReceipt';

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

const mockFrom = supabase.from as jest.Mock;
const mockChannel = supabase.channel as jest.Mock;
const mockRemoveChannel = supabase.removeChannel as jest.Mock;

const ME = 'me';
const THEM = 'them';
const ROOM = 'room-1';

type ChangeHandler = (payload: { eventType: string; new: unknown; old: unknown }) => void;
type StatusCallback = (status: string) => void;

interface FakeChannel {
  on: jest.Mock;
  subscribe: jest.Mock;
  emitChange: ChangeHandler;
  emitStatus: StatusCallback;
}

function installFakeChannel(): FakeChannel {
  const fake: FakeChannel = {
    on: jest.fn(),
    subscribe: jest.fn(),
    emitChange: () => {
      throw new Error('postgres_changes handler not registered');
    },
    emitStatus: () => {
      throw new Error('subscribe status callback not registered');
    },
  };
  fake.on.mockImplementation((_e, _f, handler: ChangeHandler) => {
    fake.emitChange = handler;
    return fake;
  });
  fake.subscribe.mockImplementation((cb: StatusCallback) => {
    fake.emitStatus = cb;
    return fake;
  });
  mockChannel.mockReturnValue(fake);
  return fake;
}

/** Chainable read builder resolving maybeSingle() with the given result. */
function installReadState(result: { data: unknown; error: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn(() => builder);
  builder.neq = jest.fn(() => builder);
  builder.maybeSingle = jest.fn(() => Promise.resolve(result));
  mockFrom.mockImplementation((table: string) => {
    if (table === 'chat_read_state') return builder;
    throw new Error(`unexpected table ${table}`);
  });
  return builder;
}

function baseArgs(overrides: Partial<UseReadReceiptArgs> = {}): UseReadReceiptArgs {
  return { roomId: ROOM, myId: ME, enabled: true, ...overrides };
}

function counterpartRow(lastReadAt: string) {
  return { chat_id: ROOM, user_id: THEM, last_read_at: lastReadAt };
}

async function renderReceipt(initial: UseReadReceiptArgs) {
  return renderHook((props: UseReadReceiptArgs) => useReadReceipt(props), {
    initialProps: initial,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('channel lifecycle', () => {
  it('opens one channel per room with a chat_id server-side filter', async () => {
    const fake = installFakeChannel();
    installReadState({ data: null, error: null });

    await renderReceipt(baseArgs());

    expect(mockChannel).toHaveBeenCalledTimes(1);
    expect(mockChannel).toHaveBeenCalledWith(`read_state:chat_id:${ROOM}`);
    expect(fake.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        schema: 'public',
        table: 'chat_read_state',
        filter: `chat_id=eq.${ROOM}`,
      }),
      expect.any(Function)
    );
  });

  it('stays closed while disabled, without a room id, or without myId', async () => {
    installReadState({ data: null, error: null });
    await renderReceipt(baseArgs({ enabled: false }));
    expect(mockChannel).not.toHaveBeenCalled();

    await renderReceipt(baseArgs({ roomId: null }));
    expect(mockChannel).not.toHaveBeenCalled();

    await renderReceipt(baseArgs({ myId: null }));
    expect(mockChannel).not.toHaveBeenCalled();
  });

  it('tears down on disable', async () => {
    const fake = installFakeChannel();
    installReadState({ data: null, error: null });
    const { rerender } = await renderReceipt(baseArgs());

    await rerender(baseArgs({ enabled: false }));
    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
    expect(mockRemoveChannel).toHaveBeenCalledWith(fake);
  });
});

describe('baseline ordering (M2) and recovery (F1)', () => {
  it('does NOT fetch before SUBSCRIBED; fetches the counterpart row on it', async () => {
    const fake = installFakeChannel();
    const builder = installReadState({
      data: counterpartRow('2026-07-14T10:00:00Z'),
      error: null,
    });

    const { result } = await renderReceipt(baseArgs());
    expect(mockFrom).not.toHaveBeenCalled();

    await act(() => fake.emitStatus('SUBSCRIBED'));
    await waitFor(() =>
      expect(result.current.counterpartLastReadAt).toBe('2026-07-14T10:00:00Z')
    );
    expect(builder.eq).toHaveBeenCalledWith('chat_id', ROOM);
    expect(builder.neq).toHaveBeenCalledWith('user_id', ME);
  });

  it('re-fetches on every SUBSCRIBED after an outage (gap events are not replayed)', async () => {
    const fake = installFakeChannel();
    const builder = installReadState({ data: null, error: null });
    await renderReceipt(baseArgs());

    await act(() => fake.emitStatus('SUBSCRIBED'));
    await waitFor(() => expect(builder.maybeSingle).toHaveBeenCalledTimes(1));

    await act(() => fake.emitStatus('CHANNEL_ERROR'));
    await act(() => fake.emitStatus('SUBSCRIBED'));
    await waitFor(() => expect(builder.maybeSingle).toHaveBeenCalledTimes(2));
  });

  it('exposes nothing when no counterpart row exists (absence is not fabricated)', async () => {
    const fake = installFakeChannel();
    installReadState({ data: null, error: null });

    const { result } = await renderReceipt(baseArgs());
    await act(() => fake.emitStatus('SUBSCRIBED'));

    expect(result.current.counterpartLastReadAt).toBeNull();
  });
});

describe('event handling', () => {
  it('adopts counterpart INSERT/UPDATE events; ignores own-row events', async () => {
    const fake = installFakeChannel();
    installReadState({ data: null, error: null });
    const { result } = await renderReceipt(baseArgs());
    await act(() => fake.emitStatus('SUBSCRIBED'));

    await act(() =>
      fake.emitChange({ eventType: 'INSERT', new: counterpartRow('2026-07-14T10:00:00Z'), old: {} })
    );
    expect(result.current.counterpartLastReadAt).toBe('2026-07-14T10:00:00Z');

    await act(() =>
      fake.emitChange({
        eventType: 'UPDATE',
        new: { chat_id: ROOM, user_id: ME, last_read_at: '2026-07-14T11:00:00Z' },
        old: {},
      })
    );
    expect(result.current.counterpartLastReadAt).toBe('2026-07-14T10:00:00Z'); // own row ignored
  });

  it('is monotonic (C3): a stale event cannot regress an established receipt', async () => {
    const fake = installFakeChannel();
    installReadState({ data: null, error: null });
    const { result } = await renderReceipt(baseArgs());
    await act(() => fake.emitStatus('SUBSCRIBED'));

    await act(() =>
      fake.emitChange({ eventType: 'UPDATE', new: counterpartRow('2026-07-14T12:00:00Z'), old: {} })
    );
    await act(() =>
      fake.emitChange({ eventType: 'UPDATE', new: counterpartRow('2026-07-14T09:00:00Z'), old: {} })
    );
    expect(result.current.counterpartLastReadAt).toBe('2026-07-14T12:00:00Z');
  });

  it('a stale BASELINE cannot regress a newer live event (merge is one path)', async () => {
    const fake = installFakeChannel();
    // Baseline resolves with an OLD marker only after a newer event landed.
    let resolveBaseline: (v: { data: unknown; error: unknown }) => void = () => {};
    const builder: Record<string, jest.Mock> = {};
    builder.select = jest.fn(() => builder);
    builder.eq = jest.fn(() => builder);
    builder.neq = jest.fn(() => builder);
    builder.maybeSingle = jest.fn(
      () => new Promise<{ data: unknown; error: unknown }>((r) => (resolveBaseline = r))
    );
    mockFrom.mockImplementation(() => builder);

    const { result } = await renderReceipt(baseArgs());
    await act(() => fake.emitStatus('SUBSCRIBED'));

    await act(() =>
      fake.emitChange({ eventType: 'UPDATE', new: counterpartRow('2026-07-14T12:00:00Z'), old: {} })
    );
    await act(async () => {
      resolveBaseline({ data: counterpartRow('2026-07-14T08:00:00Z'), error: null });
    });

    expect(result.current.counterpartLastReadAt).toBe('2026-07-14T12:00:00Z');
  });

  it('ignores DELETE events (cannot occur; defensive)', async () => {
    const fake = installFakeChannel();
    installReadState({ data: null, error: null });
    const { result } = await renderReceipt(baseArgs());
    await act(() => fake.emitStatus('SUBSCRIBED'));

    await act(() =>
      fake.emitChange({ eventType: 'INSERT', new: counterpartRow('2026-07-14T10:00:00Z'), old: {} })
    );
    await act(() =>
      fake.emitChange({ eventType: 'DELETE', new: {}, old: counterpartRow('2026-07-14T10:00:00Z') })
    );
    expect(result.current.counterpartLastReadAt).toBe('2026-07-14T10:00:00Z');
  });
});
