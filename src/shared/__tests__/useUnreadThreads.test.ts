/**
 * Tests for the app-level unread provider hook
 * (src/shared/useUnreadThreads.ts) — realtime-optimizer finding M1: the
 * hook's branch logic is where this feature's risk lives and must be pinned
 * like the other channel hooks. Fake channel + per-table chainables, same
 * mocking approach as useMessagesRealtime.test.ts.
 *
 * Pinned contracts:
 * - M2 ordering: the baseline does NOT load before SUBSCRIBED; it loads on
 *   every SUBSCRIBED (initial + post-outage), never missing the join gap.
 * - Active-room INSERTs mark read (upsert) instead of flagging — but own
 *   sends never trigger the marker write (L1).
 * - Own sends elsewhere never flag; counterpart sends elsewhere do.
 * - setActiveRoom un-flags and writes a marker; cleanup removes the channel.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { supabase } from '../../../lib/supabase';
import { useUnreadThreads } from '../useUnreadThreads';

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockFrom = supabase.from as jest.Mock;
const mockChannel = supabase.channel as jest.Mock;
const mockRemoveChannel = supabase.removeChannel as jest.Mock;

const ME = 'me';
const THEM = 'them';

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

/** Awaitable read-builder plus an upsert spy for chat_read_state. */
function installTables(data: {
  rooms: { id: string }[];
  readStates: { chat_id: string; last_read_at: string }[];
  messages: { chat_id: string; sender_id: string; created_at: string }[];
}) {
  const upsert = jest.fn(() => ({
    then: (resolve: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
  }));
  // One builder instance per from() call, recorded per table so tests can
  // assert chain calls (e.g. the C1 own-rows eq filter on chat_read_state).
  const builders: Record<string, Record<string, jest.Mock>[]> = {};
  const readBuilder = (table: string, result: unknown) => {
    const obj: Record<string, unknown> = {};
    obj.select = jest.fn(() => obj);
    obj.eq = jest.fn(() => obj);
    obj.order = jest.fn(() => obj);
    obj.limit = jest.fn(() => obj);
    obj.eq = jest.fn(() => obj);
    obj.upsert = upsert;
    obj.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject);
    (builders[table] ??= []).push(obj as Record<string, jest.Mock>);
    return obj;
  };
  mockFrom.mockImplementation((table: string) => {
    if (table === 'chat_rooms') return readBuilder(table, { data: data.rooms, error: null });
    if (table === 'chat_read_state')
      return readBuilder(table, { data: data.readStates, error: null });
    if (table === 'messages') return readBuilder(table, { data: data.messages, error: null });
    throw new Error(`unexpected table ${table}`);
  });
  return { upsert, builders };
}

function msg(chatId: string, senderId: string, createdAt: string) {
  return { chat_id: chatId, sender_id: senderId, created_at: createdAt };
}

/** Captures the hook's AppState change listener so tests can drive it. */
function installAppState() {
  let handler: ((state: string) => void) | null = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _type: string,
    cb: (state: string) => void
  ) => {
    handler = cb;
    return { remove: jest.fn() };
  }) as never);
  return {
    emit: (state: string) => {
      if (!handler) throw new Error('AppState listener not registered');
      handler(state);
    },
  };
}

/** Render, join the channel, and wait for the baseline to land. */
async function renderJoined(fake: FakeChannel) {
  const rendered = await renderHook(() => useUnreadThreads());
  await waitFor(() => expect(mockChannel).toHaveBeenCalled());
  await act(() => fake.emitStatus('SUBSCRIBED'));
  return rendered;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: ME } } } });
});

describe('baseline ordering (M2)', () => {
  it('does NOT load before SUBSCRIBED, loads on it, and re-loads on every rejoin', async () => {
    const fake = installFakeChannel();
    installTables({ rooms: [{ id: 'r1' }], readStates: [], messages: [] });

    await renderHook(() => useUnreadThreads());
    await waitFor(() => expect(mockChannel).toHaveBeenCalled());
    expect(mockFrom).not.toHaveBeenCalled(); // nothing before the join

    await act(() => fake.emitStatus('SUBSCRIBED'));
    await waitFor(() => expect(mockFrom).toHaveBeenCalledWith('chat_rooms'));
    const callsAfterFirstJoin = mockFrom.mock.calls.length;

    await act(() => fake.emitStatus('CHANNEL_ERROR'));
    await act(() => fake.emitStatus('SUBSCRIBED')); // outage recovery
    await waitFor(() => expect(mockFrom.mock.calls.length).toBeGreaterThan(callsAfterFirstJoin));
  });

  it('computes the initial unread set from the baseline', async () => {
    const fake = installFakeChannel();
    installTables({
      rooms: [{ id: 'r1' }, { id: 'r2' }],
      readStates: [],
      messages: [msg('r1', THEM, '2026-07-10T10:00:00+00:00')],
    });

    const { result } = await renderJoined(fake);

    await waitFor(() => expect(result.current.unreadRoomIds).toEqual(new Set(['r1'])));
    expect(result.current.unreadCount).toBe(1);
  });

  it('reads ONLY own read-state rows (design C1: migration 0017 widened SELECT to participants)', async () => {
    const fake = installFakeChannel();
    const { builders } = installTables({ rooms: [{ id: 'r1' }], readStates: [], messages: [] });

    await renderJoined(fake);
    await waitFor(() => expect(mockFrom).toHaveBeenCalledWith('chat_read_state'));

    const baselineReads = (builders['chat_read_state'] ?? []).filter(
      (b) => b.select.mock.calls.length > 0
    );
    expect(baselineReads.length).toBeGreaterThan(0);
    for (const b of baselineReads) {
      expect(b.eq).toHaveBeenCalledWith('user_id', ME);
    }
  });
});

describe('live INSERT handling', () => {
  it('a counterpart message in a non-active room flags it; an own send does not', async () => {
    const fake = installFakeChannel();
    installTables({ rooms: [{ id: 'r1' }, { id: 'r2' }], readStates: [], messages: [] });
    const { result } = await renderJoined(fake);

    await act(() =>
      fake.emitChange({
        eventType: 'INSERT',
        new: { id: 'm1', ...msg('r1', THEM, '2026-07-10T10:00:00+00:00') },
        old: {},
      })
    );
    expect(result.current.unreadRoomIds).toEqual(new Set(['r1']));

    await act(() =>
      fake.emitChange({
        eventType: 'INSERT',
        new: { id: 'm2', ...msg('r2', ME, '2026-07-10T10:01:00+00:00') },
        old: {},
      })
    );
    expect(result.current.unreadRoomIds).toEqual(new Set(['r1'])); // unchanged
  });

  it('a counterpart message in the ACTIVE room stays read and writes a marker; an own send in it writes nothing (L1)', async () => {
    const fake = installFakeChannel();
    const { upsert } = installTables({ rooms: [{ id: 'r1' }], readStates: [], messages: [] });
    const { result } = await renderJoined(fake);

    await act(() => result.current.setActiveRoom('r1'));
    const upsertsAfterOpen = upsert.mock.calls.length; // setActiveRoom marks read

    await act(() =>
      fake.emitChange({
        eventType: 'INSERT',
        new: { id: 'm1', ...msg('r1', THEM, '2026-07-10T10:00:00+00:00') },
        old: {},
      })
    );
    expect(result.current.unreadRoomIds.size).toBe(0); // never flagged
    expect(upsert.mock.calls.length).toBe(upsertsAfterOpen + 1); // marker advanced

    await act(() =>
      fake.emitChange({
        eventType: 'INSERT',
        new: { id: 'm2', ...msg('r1', ME, '2026-07-10T10:01:00+00:00') },
        old: {},
      })
    );
    expect(upsert.mock.calls.length).toBe(upsertsAfterOpen + 1); // own send: no write
  });
});

describe('setActiveRoom / mark-as-read', () => {
  it('opening an unread room un-flags it and writes a clock-skew-guarded marker', async () => {
    const fake = installFakeChannel();
    const { upsert } = installTables({
      rooms: [{ id: 'r1' }],
      readStates: [],
      messages: [msg('r1', THEM, '2999-01-01T00:00:00.000Z')], // server far ahead of device
    });
    const { result } = await renderJoined(fake);
    await waitFor(() => expect(result.current.unreadRoomIds).toEqual(new Set(['r1'])));

    await act(() => result.current.setActiveRoom('r1'));

    expect(result.current.unreadRoomIds.size).toBe(0);
    expect(upsert).toHaveBeenCalledWith(
      // resolveReadMarker (M1): the marker IS the newest known message's
      // server timestamp — the device clock never participates, so skew in
      // either direction cannot fabricate or undercut a receipt.
      { chat_id: 'r1', user_id: ME, last_read_at: '2999-01-01T00:00:00.000Z' },
      { onConflict: 'chat_id,user_id' }
    );
  });

  it('opening an EMPTY room writes no marker at all (M1: nothing was read)', async () => {
    const fake = installFakeChannel();
    const { upsert } = installTables({ rooms: [{ id: 'r1' }], readStates: [], messages: [] });
    const { result } = await renderJoined(fake);

    await act(() => result.current.setActiveRoom('r1'));

    expect(upsert).not.toHaveBeenCalled();
  });

  it('clearing the active room (blur) writes nothing', async () => {
    const fake = installFakeChannel();
    const { upsert } = installTables({ rooms: [{ id: 'r1' }], readStates: [], messages: [] });
    const { result } = await renderJoined(fake);
    const before = upsert.mock.calls.length;

    await act(() => result.current.setActiveRoom(null));

    expect(upsert.mock.calls.length).toBe(before);
  });
});

describe('AppState gating (M2: a pocketed phone must not produce receipts)', () => {
  it('while backgrounded, opening a room neither un-flags nor writes; foreground return catches up', async () => {
    const appState = installAppState();
    const fake = installFakeChannel();
    const { upsert } = installTables({
      rooms: [{ id: 'r1' }],
      readStates: [],
      messages: [msg('r1', THEM, '2026-07-10T10:00:00+00:00')],
    });
    const { result } = await renderJoined(fake);
    await waitFor(() => expect(result.current.unreadRoomIds).toEqual(new Set(['r1'])));

    await act(() => appState.emit('background'));
    await act(() => result.current.setActiveRoom('r1'));
    expect(result.current.unreadRoomIds).toEqual(new Set(['r1'])); // still unread
    expect(upsert).not.toHaveBeenCalled();

    // The user actually looks again: NOW it is read.
    await act(() => appState.emit('active'));
    expect(result.current.unreadRoomIds.size).toBe(0);
    expect(upsert).toHaveBeenCalledWith(
      { chat_id: 'r1', user_id: ME, last_read_at: '2026-07-10T10:00:00+00:00' },
      { onConflict: 'chat_id,user_id' }
    );
  });

  it('an INSERT for the active room while backgrounded writes nothing; the marker lands on foreground return', async () => {
    const appState = installAppState();
    const fake = installFakeChannel();
    const { upsert } = installTables({
      rooms: [{ id: 'r1' }],
      readStates: [],
      messages: [msg('r1', THEM, '2026-07-10T10:00:00+00:00')],
    });
    const { result } = await renderJoined(fake);
    await act(() => result.current.setActiveRoom('r1'));
    const afterOpen = upsert.mock.calls.length;

    await act(() => appState.emit('background'));
    await act(() =>
      fake.emitChange({
        eventType: 'INSERT',
        new: { id: 'm2', ...msg('r1', THEM, '2026-07-10T10:05:00+00:00') },
        old: {},
      })
    );
    expect(upsert.mock.calls.length).toBe(afterOpen); // pocketed: no receipt

    await act(() => appState.emit('active'));
    expect(upsert.mock.calls.length).toBe(afterOpen + 1);
    expect(upsert).toHaveBeenLastCalledWith(
      { chat_id: 'r1', user_id: ME, last_read_at: '2026-07-10T10:05:00+00:00' },
      { onConflict: 'chat_id,user_id' }
    );
  });
});

describe('lifecycle', () => {
  it('removes the channel on unmount', async () => {
    const fake = installFakeChannel();
    installTables({ rooms: [], readStates: [], messages: [] });
    const { unmount } = await renderJoined(fake);

    await act(() => {
      unmount();
    });

    expect(mockRemoveChannel).toHaveBeenCalledWith(fake);
  });
});
