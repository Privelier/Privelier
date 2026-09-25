import { act, cleanup, render, screen, waitFor } from '@testing-library/react-native';
import type { ChatRoomRow } from '../../../types';
import type { InboxThread } from '../../../shared/threads';
import { fetchOwnChatsView } from '../../chatsData';
import ChatsScreen from '../ChatsScreen';

jest.mock('@react-navigation/native', () => {
  const React = jest.requireActual('react');
  return {
    useFocusEffect: (callback: () => void | (() => void)) => React.useEffect(callback, [callback]),
  };
});
jest.mock('../../chatsData', () => ({ fetchOwnChatsView: jest.fn() }));
jest.mock('../../UnreadContext', () => ({
  useUnread: () => ({ unreadRoomIds: new Set<string>() }),
}));
jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#121214',
      surface: '#1B1B1E',
      border: '#2A2A2E',
      textPrimary: '#F5F1E8',
      textSecondary: '#9A968C',
      accent: '#BFA06B',
    },
    fonts: { headingMedium: 'serif', body: 'sans', bodySemiBold: 'sans', bodyMedium: 'sans' },
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

const room: ChatRoomRow = {
  id: 'room-2',
  booking_id: 'booking-2',
  customer_id: 'customer-2',
  barber_id: 'barber-1',
};

const thread: InboxThread = {
  room,
  barber: null,
  customer: { id: 'customer-2', name: 'Mina Hassan', profile_image: 'https://example.com/mina.jpg' },
  booking: null,
  service: null,
  lastMessage: null,
  lastActivityIso: null,
};

const mockFetchChats = jest.mocked(fetchOwnChatsView);

beforeEach(() => {
  mockFetchChats.mockReset();
  mockFetchChats.mockResolvedValue({ status: 'ok', threads: [thread] });
});

afterEach(async () => {
  cleanup();
  await new Promise<void>((resolve) => setImmediate(resolve));
});

describe('ChatsScreen avatar integration', () => {
  it('pulls to refresh with brass while retaining the thread preview', async () => {
    await render(<ChatsScreen navigation={{ navigate: jest.fn() } as never} route={{} as never} />);
    await waitFor(() => expect(screen.getByTestId('barber-chats-row-room-2')).toBeTruthy());
    const refresh = screen.getByTestId('barber-chats-list').props.refreshControl;
    expect(refresh.props.tintColor).toBe('#BFA06B');
    expect(refresh.props.colors).toEqual(['#BFA06B']);

    mockFetchChats.mockImplementationOnce(() => new Promise(() => {}));
    await act(async () => refresh.props.onRefresh());
    expect(mockFetchChats).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('barber-chats-row-room-2')).toBeTruthy();
    expect(screen.getByTestId('barber-chats-list').props.refreshControl.props.refreshing).toBe(true);
  });

  it('keeps the empty state hidden while thread previews load', async () => {
    let finish!: (value: Awaited<ReturnType<typeof fetchOwnChatsView>>) => void;
    mockFetchChats.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await render(<ChatsScreen navigation={{ navigate: jest.fn() } as never} route={{} as never} />);

    expect(screen.getByTestId('barber-chats-loading').props.accessibilityRole).toBe('progressbar');
    expect(screen.queryByTestId('barber-chats-empty')).toBeNull();
    await act(async () => finish({ status: 'ok', threads: [thread] }));
    await waitFor(() => expect(screen.getByTestId('barber-chats-row-room-2')).toBeTruthy());
    expect(screen.queryByTestId('barber-chats-loading')).toBeNull();
  });

  it('uses the real customer photo while the conversation row owns accessibility', async () => {
    await render(<ChatsScreen navigation={{ navigate: jest.fn() } as never} route={{} as never} />);

    await waitFor(() => expect(screen.getByTestId('barber-chats-avatar-room-2-image')).toBeTruthy());
    expect(screen.getByTestId('barber-chats-avatar-room-2').props.accessible).toBe(false);
    expect(screen.getByTestId('barber-chats-row-room-2').props.accessibilityLabel).toBe(
      'Open conversation with Mina Hassan'
    );
  });
});
