/**
 * Tests for the shared conversation send queue
 * (src/shared/useSendQueue.ts, build-order step 15-16). The critical pin is
 * realtime-optimizer finding M1: double-fire protection must be SYNCHRONOUS
 * (React state commits too late), because messages are immutable and a
 * duplicate insert is permanent. `send` is a controllable fake so the tests
 * can hold a request in flight while firing again.
 */
import { act, renderHook } from '@testing-library/react-native';
import { useSendQueue, type SendOutcome, type UseSendQueueArgs } from '../useSendQueue';

interface FakeRow {
  id: string;
  message: string;
}

/** A send fake whose promises resolve only when the test says so. */
function controllableSend() {
  const resolvers: ((outcome: SendOutcome<FakeRow>) => void)[] = [];
  const send = jest.fn(
    (_text: string) =>
      new Promise<SendOutcome<FakeRow>>((resolve) => {
        resolvers.push(resolve);
      })
  );
  return { send, resolvers };
}

async function renderQueue(args: UseSendQueueArgs<FakeRow>) {
  return renderHook((props: UseSendQueueArgs<FakeRow>) => useSendQueue<FakeRow>(props), {
    initialProps: args,
  });
}

describe('submit', () => {
  it('adds a pending entry, then replaces it with the authoritative row via onSent on success', async () => {
    const { send, resolvers } = controllableSend();
    const onSent = jest.fn();
    const { result } = await renderQueue({ send, onSent });

    await act(() => {
      result.current.submit('  Hello  ');
    });

    expect(send).toHaveBeenCalledWith('Hello');
    expect(result.current.pending).toEqual([{ key: 1, text: 'Hello', failed: false }]);

    const row = { id: 'm1', message: 'Hello' };
    await act(async () => {
      resolvers[0]({ status: 'ok', row });
    });

    expect(result.current.pending).toEqual([]);
    expect(onSent).toHaveBeenCalledWith(row);
  });

  it('flips the entry to failed on failure and keeps it visible', async () => {
    const { send, resolvers } = controllableSend();
    const { result } = await renderQueue({ send, onSent: jest.fn() });

    await act(() => {
      result.current.submit('hi');
    });
    await act(async () => {
      resolvers[0]({ status: 'failed' });
    });

    expect(result.current.pending).toEqual([{ key: 1, text: 'hi', failed: true }]);
  });

  it('ignores empty/whitespace text', async () => {
    const { send } = controllableSend();
    const { result } = await renderQueue({ send, onSent: jest.fn() });

    await act(() => {
      result.current.submit('   ');
    });

    expect(send).not.toHaveBeenCalled();
    expect(result.current.pending).toEqual([]);
  });

  it('allows multiple concurrent sends with distinct keys', async () => {
    const { send, resolvers } = controllableSend();
    const onSent = jest.fn();
    const { result } = await renderQueue({ send, onSent });

    await act(() => {
      result.current.submit('first');
      result.current.submit('second');
    });

    expect(send).toHaveBeenCalledTimes(2);
    expect(result.current.pending.map((p) => p.key)).toEqual([1, 2]);

    // Resolving out of order removes the right entries.
    await act(async () => {
      resolvers[1]({ status: 'ok', row: { id: 'm2', message: 'second' } });
    });
    expect(result.current.pending.map((p) => p.text)).toEqual(['first']);
    await act(async () => {
      resolvers[0]({ status: 'ok', row: { id: 'm1', message: 'first' } });
    });
    expect(result.current.pending).toEqual([]);
    expect(onSent).toHaveBeenCalledTimes(2);
  });
});

describe('retry — the M1 synchronous guard', () => {
  it('re-fires a failed entry once, even when retry is double-fired in the same tick', async () => {
    const { send, resolvers } = controllableSend();
    const { result } = await renderQueue({ send, onSent: jest.fn() });

    await act(() => {
      result.current.submit('hi');
    });
    await act(async () => {
      resolvers[0]({ status: 'failed' });
    });
    expect(result.current.pending[0].failed).toBe(true);

    // Same-tick double-fire: React state ('failed', disabled buttons) has
    // not re-committed between these two calls — the ref guard must block
    // the second synchronously or the message would insert twice, forever.
    await act(() => {
      result.current.retry(1);
      result.current.retry(1);
    });

    expect(send).toHaveBeenCalledTimes(2); // 1 original + 1 retry, NOT 3
    expect(result.current.pending).toEqual([{ key: 1, text: 'hi', failed: false }]);

    await act(async () => {
      resolvers[1]({ status: 'ok', row: { id: 'm1', message: 'hi' } });
    });
    expect(result.current.pending).toEqual([]);
  });

  it('no-ops for an unknown key or an entry already in flight', async () => {
    const { send } = controllableSend();
    const { result } = await renderQueue({ send, onSent: jest.fn() });

    await act(() => {
      result.current.submit('hi'); // key 1, still in flight (never resolved)
    });

    await act(() => {
      result.current.retry(1); // in flight — synchronously blocked
      result.current.retry(999); // unknown — no-op
    });

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('a retry that fails again can be retried again (guard re-arms)', async () => {
    const { send, resolvers } = controllableSend();
    const { result } = await renderQueue({ send, onSent: jest.fn() });

    await act(() => {
      result.current.submit('hi');
    });
    await act(async () => {
      resolvers[0]({ status: 'failed' });
    });
    await act(() => {
      result.current.retry(1);
    });
    await act(async () => {
      resolvers[1]({ status: 'failed' });
    });

    expect(result.current.pending[0].failed).toBe(true);

    await act(() => {
      result.current.retry(1);
    });
    expect(send).toHaveBeenCalledTimes(3);
  });
});
