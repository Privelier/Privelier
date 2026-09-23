import { act, render, screen, waitFor } from '@testing-library/react-native';
import ConversationScreen from '../ConversationScreen';
import { fetchConversation } from '../../conversationData';

jest.mock('@react-navigation/native', () => {
  const React = jest.requireActual('react');
  return {
    useFocusEffect: (callback: () => void | (() => void)) =>
      React.useEffect(callback, [callback]),
  };
});

jest.mock('../../conversationData', () => ({
  fetchConversation: jest.fn(),
  fetchBookingCounterpart: jest.fn().mockResolvedValue(null),
  sendMessage: jest.fn(),
}));

jest.mock('../../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'barber-1' } } },
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
  useSendQueue: () => ({ pending: [], submit: jest.fn(), retry: jest.fn() }),
}));
jest.mock('../../UnreadContext', () => {
  const setActiveRoom = jest.fn();
  return { useUnread: () => ({ setActiveRoom }) };
});

const mockFetchConversation = fetchConversation as jest.MockedFunction<typeof fetchConversation>;
type FetchResult = Awaited<ReturnType<typeof fetchConversation>>;

const cursor = { createdAt: '2026-09-23T10:00:00.000Z', id: 'message-40' };
const route = {
  params: {
    room: {
      id: 'room-1',
      booking_id: 'booking-1',
      customer_id: 'customer-1',
      barber_id: 'barber-1',
    },
    title: 'Classic cut',
    subtitle: null,
  },
} as never;
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
});

describe('Barber ConversationScreen history pagination', () => {
  it('uses the oldest cursor once and merges earlier messages without moving the viewport', async () => {
    const page = deferred<FetchResult>();
    mockFetchConversation
      .mockResolvedValueOnce({
        status: 'ok',
        messages: [
          {
            id: 'latest',
            chat_id: 'room-1',
            sender_id: 'customer-1',
            message: 'Latest message',
            created_at: '2026-09-23T10:10:00.000Z',
          },
        ],
        hasEarlier: true,
        earliestCursor: cursor,
      })
      .mockReturnValueOnce(page.promise);

    await render(<ConversationScreen route={route} navigation={navigation} />);
    await waitFor(() => expect(screen.getByTestId('barber-conversation-load-earlier')).toBeTruthy());

    expect(
      screen.getByTestId('barber-conversation-list').props.maintainVisibleContentPosition
    ).toEqual({ minIndexForVisible: 0 });
    const control = screen.getByTestId('barber-conversation-load-earlier');
    expect(control.props.accessibilityLabel).toBe('Load earlier messages');

    const press = control.props.onClick as () => void;
    await act(() => {
      press();
      press();
    });
    expect(mockFetchConversation).toHaveBeenCalledTimes(2);
    expect(mockFetchConversation).toHaveBeenLastCalledWith('room-1', cursor);
    await waitFor(() => {
      expect(screen.getByTestId('barber-conversation-loading-earlier')).toBeTruthy();
      expect(
        screen.getByTestId('barber-conversation-load-earlier').props.accessibilityState
      ).toEqual({ disabled: true, busy: true });
    });

    await act(async () => {
      page.resolve({
        status: 'ok',
        messages: [
          {
            id: 'earlier',
            chat_id: 'room-1',
            sender_id: 'barber-1',
            message: 'Earlier message',
            created_at: '2026-09-23T09:00:00.000Z',
          },
        ],
        hasEarlier: false,
        earliestCursor: { createdAt: '2026-09-23T09:00:00.000Z', id: 'earlier' },
      });
      await page.promise;
    });

    await waitFor(() => expect(screen.getByText('Earlier message')).toBeTruthy());
    expect(screen.getByText('Latest message')).toBeTruthy();
    expect(screen.queryByTestId('barber-conversation-load-earlier')).toBeNull();
  });
});
