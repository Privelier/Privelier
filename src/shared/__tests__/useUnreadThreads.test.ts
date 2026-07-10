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
  const readBuilder = (result: unknown) => {
    const obj: Record<string, unknown> = {};
    obj.select = jest.fn(() => obj);
    obj.order = jest.fn(() => obj);
    obj.limit = jest.fn(() => obj);
    obj.upsert = upsert;
    obj.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject);
    return obj;
  };
  mockFrom.mockImplementation((table: string) => {
    if (table === 'chat_rooms') return readBuilder({ data: data.rooms, error: null });
    if (table === 'chat_read_state') return readBuilder({ data: data.readStates, error: null });
    if (table === 'messages') return readBuilder({ data: data.messages, error: null });
    throw new Error(`unexpected table ${table}`);
  });
  return { upsert };
}

function msg(chatId: string, senderId: string, createdAt: string) {
  return { chat_id: chatId, sender_id: senderId, created_at: createdAt };
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
      // resolveReadMarker: the newest known (server) timestamp wins over the
      // behind device clock, so the just-read message can never out-date it.
      { chat_id: 'r1', user_id: ME, last_read_at: '2999-01-01T00:00:00.000Z' },
      { onConflict: 'chat_id,user_id' }
    );
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
