/**
 * Tests for the bookings realtime subscription hook
 * (src/shared/useBookingsRealtime.ts, build-order step 13-14). The Supabase
 * client is mocked with a hand-rolled fake channel so the tests can drive
 * subscription-status transitions and postgres_changes payloads directly —
 * no real websocket.
 *
 * The recovery contract (retroactive design review finding F1) is the
 * critical piece pinned here: Supabase does NOT replay events missed while
 * the socket was down, so `onRecovered` must fire on a SUBSCRIBED that
 * follows an error/timeout — and must NOT fire on the initial healthy
 * subscribe, which would double the caller's focus-time baseline fetch.
 */
import { act, renderHook } from '@testing-library/react-native';
import { supabase } from '../../../lib/supabase';
import type { BookingChangeEvent } from '../bookingRealtime';
import { useBookingsRealtime, type UseBookingsRealtimeArgs } from '../useBookingsRealtime';

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

const mockChannel = supabase.channel as jest.Mock;
const mockRemoveChannel = supabase.removeChannel as jest.Mock;

type PostgresChangesHandler = (payload: {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: unknown;
  old: unknown;
}) => void;
type StatusCallback = (status: string) => void;

/** The fake channel exposes the two callbacks the hook hands to supabase-js. */
interface FakeChannel {
  on: jest.Mock;
  subscribe: jest.Mock;
  emitChange: PostgresChangesHandler;
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
  fake.on.mockImplementation((_event, _filter, handler: PostgresChangesHandler) => {
    fake.emitChange = handler;
    return fake;
  });
  fake.subscribe.mockImplementation((cb: StatusCallback) => {
    fake.emitStatus = cb;
    return fake;
  });
  mockChannel.mockReturnValueOnce(fake);
  return fake;
}

function baseArgs(overrides: Partial<UseBookingsRealtimeArgs> = {}): UseBookingsRealtimeArgs {
  return {
    filterColumn: 'barber_id',
    filterValue: 'user-1',
    onChange: jest.fn(),
    onRecovered: jest.fn(),
    enabled: true,
    ...overrides,
  };
}

async function renderRealtime(initial: UseBookingsRealtimeArgs) {
  return renderHook((props: UseBookingsRealtimeArgs) => useBookingsRealtime(props), {
    initialProps: initial,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  // The hook intentionally warns on CHANNEL_ERROR/TIMED_OUT; keep test
  // output clean without asserting on the log itself.
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('channel lifecycle', () => {
  it('opens one channel named per (column, value) with a matching server-side filter', async () => {
    const fake = installFakeChannel();

    await renderRealtime(baseArgs());

    expect(mockChannel).toHaveBeenCalledTimes(1);
    expect(mockChannel).toHaveBeenCalledWith('bookings:barber_id:user-1');
    expect(fake.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        schema: 'public',
        table: 'bookings',
        filter: 'barber_id=eq.user-1',
      }),
      expect.any(Function)
    );
    expect(fake.subscribe).toHaveBeenCalledTimes(1);
  });

  it('stays closed while disabled or without a user id', async () => {
    const { rerender } = await renderRealtime(baseArgs({ enabled: false }));
    expect(mockChannel).not.toHaveBeenCalled();

    await rerender(baseArgs({ filterValue: null }));
    expect(mockChannel).not.toHaveBeenCalled();
  });

  it('removes the channel on unmount', async () => {
    const fake = installFakeChannel();
    const { unmount } = await renderRealtime(baseArgs());

    await act(() => {
      unmount();
    });

    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
    expect(mockRemoveChannel).toHaveBeenCalledWith(fake);
  });

  it('tears down on blur (enabled -> false) and reopens on refocus without leaking', async () => {
    installFakeChannel();
    const { rerender } = await renderRealtime(baseArgs());

    await rerender(baseArgs({ enabled: false }));
    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);

    installFakeChannel();
    await rerender(baseArgs());
    expect(mockChannel).toHaveBeenCalledTimes(2);
    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
  });

  it('does NOT recreate the channel when only callback identities change', async () => {
    installFakeChannel();
    const { rerender } = await renderRealtime(baseArgs());

    await rerender(baseArgs({ onChange: jest.fn(), onRecovered: jest.fn() }));

    expect(mockChannel).toHaveBeenCalledTimes(1);
    expect(mockRemoveChannel).not.toHaveBeenCalled();
  });
});

describe('event normalization', () => {
  const row = { id: 'bk1', status: 'pending' };

  it.each(['INSERT', 'UPDATE'] as const)('%s events deliver payload.new', async (eventType) => {
    const fake = installFakeChannel();
    const onChange = jest.fn();
    await renderRealtime(baseArgs({ onChange }));

    await act(() => fake.emitChange({ eventType, new: row, old: {} }));

    expect(onChange).toHaveBeenCalledWith({ eventType, row } as BookingChangeEvent);
  });

  it('DELETE events deliver payload.old (PK-only under replica identity DEFAULT)', async () => {
    const fake = installFakeChannel();
    const onChange = jest.fn();
    await renderRealtime(baseArgs({ onChange }));

    await act(() => fake.emitChange({ eventType: 'DELETE', new: {}, old: { id: 'bk1' } }));

    expect(onChange).toHaveBeenCalledWith({ eventType: 'DELETE', row: { id: 'bk1' } });
  });

  it('drops malformed payloads without an id instead of forwarding them', async () => {
    const fake = installFakeChannel();
    const onChange = jest.fn();
    await renderRealtime(baseArgs({ onChange }));

    await act(() => fake.emitChange({ eventType: 'UPDATE', new: {}, old: {} }));
    await act(() => fake.emitChange({ eventType: 'DELETE', new: {}, old: null }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses the LATEST onChange after a rerender (ref pattern), not the one captured at subscribe time', async () => {
    const fake = installFakeChannel();
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = await renderRealtime(baseArgs({ onChange: first }));

    await rerender(baseArgs({ onChange: second }));
    await act(() => fake.emitChange({ eventType: 'UPDATE', new: row, old: {} }));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('recovery refetch (review finding F1)', () => {
  it('does NOT fire onRecovered on the initial healthy subscribe', async () => {
    const fake = installFakeChannel();
    const onRecovered = jest.fn();
    await renderRealtime(baseArgs({ onRecovered }));

    await act(() => fake.emitStatus('SUBSCRIBED'));

    expect(onRecovered).not.toHaveBeenCalled();
  });

  it.each(['CHANNEL_ERROR', 'TIMED_OUT'])(
    'fires onRecovered exactly once when SUBSCRIBED follows a %s',
    async (errorStatus) => {
      const fake = installFakeChannel();
      const onRecovered = jest.fn();
      await renderRealtime(baseArgs({ onRecovered }));

      await act(() => fake.emitStatus('SUBSCRIBED')); // initial healthy join
      await act(() => fake.emitStatus(errorStatus)); // outage
      await act(() => fake.emitStatus('SUBSCRIBED')); // auto-rejoin -> gap possible

      expect(onRecovered).toHaveBeenCalledTimes(1);

      // A further healthy re-emit without a new error must not refetch again.
      await act(() => fake.emitStatus('SUBSCRIBED'));
      expect(onRecovered).toHaveBeenCalledTimes(1);
    }
  );

  it('re-arms after each outage: two error/rejoin cycles refetch twice', async () => {
    const fake = installFakeChannel();
    const onRecovered = jest.fn();
    await renderRealtime(baseArgs({ onRecovered }));

    await act(() => fake.emitStatus('CHANNEL_ERROR'));
    await act(() => fake.emitStatus('SUBSCRIBED'));
    await act(() => fake.emitStatus('TIMED_OUT'));
    await act(() => fake.emitStatus('SUBSCRIBED'));

    expect(onRecovered).toHaveBeenCalledTimes(2);
  });

  it('treats CLOSED as cleanup, not an outage — no refetch on a later SUBSCRIBED', async () => {
    const fake = installFakeChannel();
    const onRecovered = jest.fn();
    await renderRealtime(baseArgs({ onRecovered }));

    await act(() => fake.emitStatus('CLOSED'));
    await act(() => fake.emitStatus('SUBSCRIBED'));

    expect(onRecovered).not.toHaveBeenCalled();
  });

  it('survives callers that pass no onRecovered', async () => {
    const fake = installFakeChannel();
    await renderRealtime(baseArgs({ onRecovered: undefined }));

    await act(() => fake.emitStatus('CHANNEL_ERROR'));
    await expect(act(() => fake.emitStatus('SUBSCRIBED'))).resolves.not.toThrow();
  });
});
