/**
 * Tests for the typing-indicator broadcast hook
 * (src/shared/useTypingBroadcast.ts) — fake timers throughout (contract C4
 * is timing: debounce, trailing stop, receiver TTL). Fake channel extends
 * the house shape with a broadcast handler and a send spy.
 *
 * Pinned contracts:
 * - NEVER one event per keystroke: leading-edge emit + refractory window.
 * - Trailing `typing: false` after sender-side silence; explicit stop on
 *   notifyStopped, at most once per owed start (no stop-spam).
 * - Receiver self-heals via TTL even when the stop event is lost.
 * - No sends before the channel is joined; cleanup clears timers, sends the
 *   owed stop, and removes the channel.
 */
import { act, renderHook } from '@testing-library/react-native';
import { supabase } from '../../../lib/supabase';
import {
  TYPING_RECEIVER_TTL_MS,
  TYPING_REFRACTORY_MS,
  TYPING_SENDER_IDLE_MS,
  useTypingBroadcast,
  type TypingPayload,
  type UseTypingBroadcastArgs,
} from '../useTypingBroadcast';

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

const mockChannel = supabase.channel as jest.Mock;
const mockRemoveChannel = supabase.removeChannel as jest.Mock;

const ME = 'me';
const THEM = 'them';
const ROOM = 'room-1';

type BroadcastHandler = (message: { payload: unknown }) => void;
type StatusCallback = (status: string) => void;

interface FakeChannel {
  on: jest.Mock;
  subscribe: jest.Mock;
  send: jest.Mock;
  emitBroadcast: BroadcastHandler;
  emitStatus: StatusCallback;
}

function installFakeChannel(): FakeChannel {
  const fake: FakeChannel = {
    on: jest.fn(),
    subscribe: jest.fn(),
    send: jest.fn(() => Promise.resolve('ok')),
    emitBroadcast: () => {
      throw new Error('broadcast handler not registered');
    },
    emitStatus: () => {
      throw new Error('subscribe status callback not registered');
    },
  };
  fake.on.mockImplementation((_type, _filter, handler: BroadcastHandler) => {
    fake.emitBroadcast = handler;
    return fake;
  });
  fake.subscribe.mockImplementation((cb: StatusCallback) => {
    fake.emitStatus = cb;
    return fake;
  });
  mockChannel.mockReturnValue(fake);
  return fake;
}

function baseArgs(overrides: Partial<UseTypingBroadcastArgs> = {}): UseTypingBroadcastArgs {
  return { roomId: ROOM, myId: ME, enabled: true, ...overrides };
}

/** The typing payloads actually sent, in order. */
function sentPayloads(fake: FakeChannel): TypingPayload[] {
  return fake.send.mock.calls.map((c) => c[0].payload as TypingPayload);
}

async function renderTyping(initial: UseTypingBroadcastArgs) {
  return renderHook((props: UseTypingBroadcastArgs) => useTypingBroadcast(props), {
    initialProps: initial,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
});

describe('channel setup', () => {
  it('opens a PRIVATE broadcast channel with self-echo off', async () => {
    installFakeChannel();
    await renderTyping(baseArgs());

    expect(mockChannel).toHaveBeenCalledTimes(1);
    expect(mockChannel).toHaveBeenCalledWith(`typing:${ROOM}`, {
      config: { private: true, broadcast: { self: false } },
    });
  });

  it('stays closed while disabled, without a room id, or without myId', async () => {
    installFakeChannel();
    await renderTyping(baseArgs({ enabled: false }));
    await renderTyping(baseArgs({ roomId: null }));
    await renderTyping(baseArgs({ myId: null }));
    expect(mockChannel).not.toHaveBeenCalled();
  });
});

describe('send side (C4: debounced, never per-keystroke)', () => {
  it('does not send before the channel is joined', async () => {
    const fake = installFakeChannel();
    const { result } = await renderTyping(baseArgs());

    await act(() => result.current.notifyActivity());
    expect(fake.send).not.toHaveBeenCalled();
  });

  it('collapses a keystroke burst into ONE start; re-emits only after the refractory window', async () => {
    const fake = installFakeChannel();
    const { result } = await renderTyping(baseArgs());
    await act(() => fake.emitStatus('SUBSCRIBED'));

    await act(() => {
      result.current.notifyActivity();
      result.current.notifyActivity();
      result.current.notifyActivity();
    });
    expect(sentPayloads(fake)).toEqual([{ user_id: ME, typing: true }]);

    // Still inside the refractory window — no new start.
    await act(() => jest.advanceTimersByTime(TYPING_REFRACTORY_MS - 1));
    await act(() => result.current.notifyActivity());
    expect(sentPayloads(fake)).toEqual([{ user_id: ME, typing: true }]);

    // Past the window — the next activity re-emits.
    await act(() => jest.advanceTimersByTime(1));
    await act(() => result.current.notifyActivity());
    expect(sentPayloads(fake)).toEqual([
      { user_id: ME, typing: true },
      { user_id: ME, typing: true },
    ]);
  });

  it('emits a trailing stop after sender-side silence', async () => {
    const fake = installFakeChannel();
    const { result } = await renderTyping(baseArgs());
    await act(() => fake.emitStatus('SUBSCRIBED'));

    await act(() => result.current.notifyActivity());
    await act(() => jest.advanceTimersByTime(TYPING_SENDER_IDLE_MS));

    expect(sentPayloads(fake)).toEqual([
      { user_id: ME, typing: true },
      { user_id: ME, typing: false },
    ]);
  });

  it('continued activity keeps re-arming the trailing stop (no premature stop)', async () => {
    const fake = installFakeChannel();
    const { result } = await renderTyping(baseArgs());
    await act(() => fake.emitStatus('SUBSCRIBED'));

    await act(() => result.current.notifyActivity());
    await act(() => jest.advanceTimersByTime(TYPING_SENDER_IDLE_MS - 1));
    await act(() => result.current.notifyActivity()); // re-arms
    await act(() => jest.advanceTimersByTime(TYPING_SENDER_IDLE_MS - 1));
    expect(sentPayloads(fake).filter((p) => !p.typing)).toHaveLength(0);

    await act(() => jest.advanceTimersByTime(1));
    expect(sentPayloads(fake).filter((p) => !p.typing)).toHaveLength(1);
  });

  it('notifyStopped sends the stop immediately, at most once per owed start', async () => {
    const fake = installFakeChannel();
    const { result } = await renderTyping(baseArgs());
    await act(() => fake.emitStatus('SUBSCRIBED'));

    await act(() => result.current.notifyStopped()); // nothing owed — no send
    expect(fake.send).not.toHaveBeenCalled();

    await act(() => result.current.notifyActivity());
    await act(() => result.current.notifyStopped());
    await act(() => result.current.notifyStopped()); // second stop is a no-op
    expect(sentPayloads(fake)).toEqual([
      { user_id: ME, typing: true },
      { user_id: ME, typing: false },
    ]);

    // The cancelled idle timer must not fire a second stop later.
    await act(() => jest.advanceTimersByTime(TYPING_SENDER_IDLE_MS * 2));
    expect(sentPayloads(fake)).toHaveLength(2);
  });
});

describe('receive side (self-healing)', () => {
  it('shows on a real start event and clears on a real stop event', async () => {
    const fake = installFakeChannel();
    const { result } = await renderTyping(baseArgs());
    await act(() => fake.emitStatus('SUBSCRIBED'));

    await act(() => fake.emitBroadcast({ payload: { user_id: THEM, typing: true } }));
    expect(result.current.counterpartTyping).toBe(true);

    await act(() => fake.emitBroadcast({ payload: { user_id: THEM, typing: false } }));
    expect(result.current.counterpartTyping).toBe(false);
  });

  it('clears via TTL when the stop event is lost (nothing hangs forever)', async () => {
    const fake = installFakeChannel();
    const { result } = await renderTyping(baseArgs());
    await act(() => fake.emitStatus('SUBSCRIBED'));

    await act(() => fake.emitBroadcast({ payload: { user_id: THEM, typing: true } }));
    await act(() => jest.advanceTimersByTime(TYPING_RECEIVER_TTL_MS - 1));
    expect(result.current.counterpartTyping).toBe(true);

    await act(() => jest.advanceTimersByTime(1));
    expect(result.current.counterpartTyping).toBe(false);
  });

  it('a fresh start event re-arms the TTL', async () => {
    const fake = installFakeChannel();
    const { result } = await renderTyping(baseArgs());
    await act(() => fake.emitStatus('SUBSCRIBED'));

    await act(() => fake.emitBroadcast({ payload: { user_id: THEM, typing: true } }));
    await act(() => jest.advanceTimersByTime(TYPING_RECEIVER_TTL_MS - 1));
    await act(() => fake.emitBroadcast({ payload: { user_id: THEM, typing: true } }));
    await act(() => jest.advanceTimersByTime(TYPING_RECEIVER_TTL_MS - 1));
    expect(result.current.counterpartTyping).toBe(true);
  });

  it('ignores own-id and malformed payloads (defensive; self:false already filters)', async () => {
    const fake = installFakeChannel();
    const { result } = await renderTyping(baseArgs());
    await act(() => fake.emitStatus('SUBSCRIBED'));

    await act(() => fake.emitBroadcast({ payload: { user_id: ME, typing: true } }));
    await act(() => fake.emitBroadcast({ payload: undefined }));
    await act(() => fake.emitBroadcast({ payload: { user_id: THEM, typing: 'yes' } }));
    expect(result.current.counterpartTyping).toBe(false);
  });
});

describe('cleanup', () => {
  it('on disable: sends the owed stop, removes the channel, resets state', async () => {
    const fake = installFakeChannel();
    const { result, rerender } = await renderTyping(baseArgs());
    await act(() => fake.emitStatus('SUBSCRIBED'));

    await act(() => fake.emitBroadcast({ payload: { user_id: THEM, typing: true } }));
    await act(() => result.current.notifyActivity()); // a stop is now owed

    await rerender(baseArgs({ enabled: false }));

    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
    expect(mockRemoveChannel).toHaveBeenCalledWith(fake);
    expect(sentPayloads(fake)).toEqual([
      { user_id: ME, typing: true },
      { user_id: ME, typing: false }, // the courtesy stop, before teardown
    ]);
    expect(result.current.counterpartTyping).toBe(false);

    // No timer may fire anything after teardown.
    await act(() => jest.advanceTimersByTime(TYPING_RECEIVER_TTL_MS + TYPING_SENDER_IDLE_MS));
    expect(fake.send).toHaveBeenCalledTimes(2);
  });
});
