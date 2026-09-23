import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ConversationScreen from '../ConversationScreen';
import { fetchConversation, fetchConversationNewerThan } from '../../conversationData';
import { useMessagesRealtime } from '../../../shared/useMessagesRealtime';
import { useSendQueue } from '../../../shared/useSendQueue';

jest.mock('@react-navigation/native', () => {
  const React = jest.requireActual('react');
  return {
    useFocusEffect: (callback: () => void | (() => void)) =>
      React.useEffect(callback, [callback]),
  };
});

jest.mock('../../conversationData', () => ({
  fetchConversation: jest.fn(),
  fetchConversationNewerThan: jest.fn(),
  sendMessage: jest.fn(),
}));

jest.mock('../../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'customer-1' } } },
      }),
    },
  },
}));

jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({
    isDark: true,
    colors: {
      background: '#121214',
      surface: '#1B1B1E',
      border: '#2A2A2E',
      textPrimary: '#F5F1E8',
      textSecondary: '#9A968C',
      accent: '#BFA06B',
      accentText: '#BFA06B',
      onAccent: '#121214',
      success: '#51785C',
      successText: '#7FA98B',
      error: '#A8453E',
      errorText: '#CE7A73',
    },
    fonts: {
      headingMedium: 'serif',
      body: 'sans',
      bodyMedium: 'sans',
      bodySemiBold: 'sans',
    },
  }),
}));

jest.mock('react-native-safe-area-context', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: ({ children, ...props }: { children?: unknown }) =>
      React.createElement(View, props, children),
  };
});

jest.mock('../../../shared/components/ScreenBackHeader', () => {
  const React = jest.requireActual('react');
  const { Pressable } = jest.requireActual('react-native');
  return {
    BackButton: (props: Record<string, unknown>) => React.createElement(Pressable, props),
  };
});

jest.mock('../../../shared/useMessagesRealtime', () => ({ useMessagesRealtime: jest.fn() }));
jest.mock('../../../shared/useReadReceipt', () => ({
  useReadReceipt: () => ({ counterpartLastReadAt: null }),
}));
jest.mock('../../../shared/useTypingBroadcast', () => {
  const notifyActivity = jest.fn();
  const notifyStopped = jest.fn();
  return {
    useTypingBroadcast: () => ({ counterpartTyping: false, notifyActivity, notifyStopped }),
  };
});
jest.mock('../../../shared/useSendQueue', () => ({
  useSendQueue: jest.fn(() => ({ pending: [], submit: jest.fn(), retry: jest.fn() })),
}));
jest.mock('../../UnreadContext', () => {
  const setActiveRoom = jest.fn();
  return { useUnread: () => ({ setActiveRoom }) };
});

const mockFetchConversation = fetchConversation as jest.MockedFunction<typeof fetchConversation>;
const mockFetchConversationNewerThan =
  fetchConversationNewerThan as jest.MockedFunction<typeof fetchConversationNewerThan>;
const mockUseMessagesRealtime = useMessagesRealtime as jest.Mock;
const mockUseSendQueue = useSendQueue as jest.Mock;
type FetchResult = Awaited<ReturnType<typeof fetchConversation>>;
type FetchNewerResult = Awaited<ReturnType<typeof fetchConversationNewerThan>>;

const roomOneCursor = { createdAt: '2026-09-23T10:00:00.000Z', id: 'message-40' };
const roomTwoCursor = { createdAt: '2026-09-23T12:00:00.000Z', id: 'message-80' };

const routeFor = (roomId: string) =>
  ({
    params: {
      room: {
        id: roomId,
        booking_id: `booking-${roomId}`,
        customer_id: 'customer-1',
        barber_id: 'barber-1',
      },
      title: 'Alex Barber',
      subtitle: 'Classic cut',
    },
  }) as never;

const navigation = { goBack: jest.fn() } as never;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchConversation.mockReset();
  mockFetchConversationNewerThan.mockReset();
});

describe('Customer ConversationScreen history pagination', () => {
  it('loads earlier history once, resets cursors between rooms, and preserves recovery', async () => {
    const stalePage = deferred<FetchResult>();
    mockFetchConversation
      .mockResolvedValueOnce({
        status: 'ok',
        messages: [
          {
            id: 'room-one-latest',
            chat_id: 'room-1',
            sender_id: 'barber-1',
            message: 'Room one latest',
            created_at: '2026-09-23T10:10:00.000Z',
          },
        ],
        hasEarlier: true,
        earliestCursor: roomOneCursor,
      })
      .mockReturnValueOnce(stalePage.promise);

    const view = await render(
      <ConversationScreen route={routeFor('room-1')} navigation={navigation} />
    );
    await waitFor(() => expect(screen.getByTestId('customer-conversation-load-earlier')).toBeTruthy());

    expect(
      screen.getByTestId('customer-conversation-list').props.maintainVisibleContentPosition
    ).toEqual({ minIndexForVisible: 0 });
    const firstControl = screen.getByTestId('customer-conversation-load-earlier');
    expect(firstControl.props.accessibilityRole).toBe('button');
    expect(firstControl.props.accessibilityLabel).toBe('Load earlier messages');

    const press = firstControl.props.onClick as () => void;
    await act(() => {
      press();
      press();
    });
    expect(mockFetchConversation).toHaveBeenCalledTimes(2);
    expect(mockFetchConversation).toHaveBeenLastCalledWith('room-1', roomOneCursor);
    await waitFor(() => {
      expect(
        screen.getByTestId('customer-conversation-load-earlier').props.accessibilityState
      ).toEqual({ disabled: true, busy: true });
    });

    mockFetchConversation.mockResolvedValueOnce({
      status: 'ok',
      messages: [
        {
          id: 'room-two-latest',
          chat_id: 'room-2',
          sender_id: 'barber-1',
          message: 'Room two latest',
          created_at: '2026-09-23T12:10:00.000Z',
        },
      ],
      hasEarlier: true,
      earliestCursor: roomTwoCursor,
    });
    await view.rerender(
      <ConversationScreen route={routeFor('room-2')} navigation={navigation} />
    );
    await waitFor(() => expect(mockFetchConversation).toHaveBeenCalledWith('room-2'));
    await waitFor(() => expect(screen.getByText('Room two latest')).toBeTruthy());

    await act(async () => {
      stalePage.resolve({
        status: 'ok',
        messages: [
          {
            id: 'stale-room-one-message',
            chat_id: 'room-1',
            sender_id: 'barber-1',
            message: 'Stale room one history',
            created_at: '2026-09-23T09:00:00.000Z',
          },
        ],
        hasEarlier: false,
        earliestCursor: null,
      });
      await stalePage.promise;
    });
    expect(screen.queryByText('Stale room one history')).toBeNull();
    expect(screen.queryByText('Room one latest')).toBeNull();

    mockFetchConversation.mockResolvedValueOnce({
      status: 'error',
      code: 'network',
      message: 'Check your connection and try again.',
      retryable: true,
    });
    await fireEvent.press(screen.getByTestId('customer-conversation-load-earlier'));
    await waitFor(() => expect(screen.getByTestId('customer-conversation-earlier-error')).toBeTruthy());
    expect(mockFetchConversation).toHaveBeenLastCalledWith('room-2', roomTwoCursor);
    expect(screen.getByText('Room two latest')).toBeTruthy();

    mockFetchConversation.mockResolvedValueOnce({
      status: 'ok',
      messages: [
        {
          id: 'room-two-earlier',
          chat_id: 'room-2',
          sender_id: 'customer-1',
          message: 'Room two earlier',
          created_at: '2026-09-23T11:00:00.000Z',
        },
      ],
      hasEarlier: false,
      earliestCursor: { createdAt: '2026-09-23T11:00:00.000Z', id: 'room-two-earlier' },
    });
    await fireEvent.press(screen.getByTestId('customer-conversation-load-earlier'));
    await waitFor(() => expect(screen.getByText('Room two earlier')).toBeTruthy());
    expect(screen.getByText('Room two latest')).toBeTruthy();
    expect(screen.queryByTestId('customer-conversation-load-earlier')).toBeNull();
  });
});
