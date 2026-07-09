/**
 * Tests for the per-room messages realtime hook
 * (src/shared/useMessagesRealtime.ts, build-order step 15-16) — the chat
 * copy of useBookingsRealtime, pinned with the same fake-channel approach as
 * useBookingsRealtime.test.ts. The F1 recovery matrix is the critical part:
 * onRecovered fires only on a SUBSCRIBED that follows an error/timeout.
 */
import { act, renderHook } from '@testing-library/react-native';
import { supabase } from '../../../lib/supabase';
import { useMessagesRealtime, type UseMessagesRealtimeArgs } from '../useMessagesRealtime';

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

function baseArgs(overrides: Partial<UseMessagesRealtimeArgs> = {}): UseMessagesRealtimeArgs {
  return {
    roomId: 'room-1',
    onChange: jest.fn(),
    onRecovered: jest.fn(),
    enabled: true,
    ...overrides,
  };
}

async function renderRealtime(initial: UseMessagesRealtimeArgs) {
  return renderHook((props: UseMessagesRealtimeArgs) => useMessagesRealtime(props), {
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

    await renderRealtime(baseArgs());

    expect(mockChannel).toHaveBeenCalledTimes(1);
    expect(mockChannel).toHaveBeenCalledWith('messages:chat_id:room-1');
    expect(fake.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        schema: 'public',
        table: 'messages',
        filter: 'chat_id=eq.room-1',
      }),
      expect.any(Function)
    );
  });

  it('stays closed while disabled or without a room id', async () => {
    const { rerender } = await renderRealtime(baseArgs({ enabled: false }));
    expect(mockChannel).not.toHaveBeenCalled();

    await rerender(baseArgs({ roomId: null }));
    expect(mockChannel).not.toHaveBeenCalled();
  });

  it('tears down on blur and does not recreate on callback identity churn', async () => {
    const fake = installFakeChannel();
    const { rerender } = await renderRealtime(baseArgs());

    await rerender(baseArgs({ onChange: jest.fn(), onRecovered: jest.fn() }));
    expect(mockChannel).toHaveBeenCalledTimes(1);
    expect(mockRemoveChannel).not.toHaveBeenCalled();

    await rerender(baseArgs({ enabled: false }));
    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
    expect(mockRemoveChannel).toHaveBeenCalledWith(fake);
  });
});

describe('event normalization', () => {
  it('INSERT delivers payload.new; malformed payloads without an id are dropped', async () => {
    const fake = installFakeChannel();
    const onChange = jest.fn();
    await renderRealtime(baseArgs({ onChange }));

    const row = { id: 'm1', chat_id: 'room-1', message: 'hi' };
    await act(() => fake.emitChange({ eventType: 'INSERT', new: row, old: {} }));
    await act(() => fake.emitChange({ eventType: 'INSERT', new: {}, old: {} }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ eventType: 'INSERT', row });
  });

  it('uses the LATEST onChange after a rerender (ref pattern)', async () => {
    const fake = installFakeChannel();
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = await renderRealtime(baseArgs({ onChange: first }));

    await rerender(baseArgs({ onChange: second }));
    await act(() =>
      fake.emitChange({ eventType: 'INSERT', new: { id: 'm1' }, old: {} })
    );

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('recovery refetch (lesson F1)', () => {
  it('does NOT fire onRecovered on the initial healthy subscribe', async () => {
    const fake = installFakeChannel();
    const onRecovered = jest.fn();
    await renderRealtime(baseArgs({ onRecovered }));

    await act(() => fake.emitStatus('SUBSCRIBED'));

    expect(onRecovered).not.toHaveBeenCalled();
  });

  it.each(['CHANNEL_ERROR', 'TIMED_OUT'])(
    'fires exactly once when SUBSCRIBED follows a %s, and re-arms per outage',
    async (errorStatus) => {
      const fake = installFakeChannel();
      const onRecovered = jest.fn();
      await renderRealtime(baseArgs({ onRecovered }));

      await act(() => fake.emitStatus('SUBSCRIBED'));
      await act(() => fake.emitStatus(errorStatus));
      await act(() => fake.emitStatus('SUBSCRIBED'));
      expect(onRecovered).toHaveBeenCalledTimes(1);

      await act(() => fake.emitStatus('SUBSCRIBED'));
      expect(onRecovered).toHaveBeenCalledTimes(1);

      await act(() => fake.emitStatus(errorStatus));
      await act(() => fake.emitStatus('SUBSCRIBED'));
      expect(onRecovered).toHaveBeenCalledTimes(2);
    }
  );

  it('treats CLOSED as cleanup, not an outage', async () => {
    const fake = installFakeChannel();
    const onRecovered = jest.fn();
    await renderRealtime(baseArgs({ onRecovered }));

    await act(() => fake.emitStatus('CLOSED'));
    await act(() => fake.emitStatus('SUBSCRIBED'));

    expect(onRecovered).not.toHaveBeenCalled();
  });
});
