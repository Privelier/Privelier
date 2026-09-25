import { act, cleanup, render, screen, waitFor } from '@testing-library/react-native';
import type { BarberDirectoryRow, ChatRoomRow } from '../../../types';
import type { InboxThread } from '../../types';
import { fetchOwnInboxView } from '../../inboxData';
import InboxScreen from '../InboxScreen';

jest.mock('@react-navigation/native', () => {
  const React = jest.requireActual('react');
  return {
    useFocusEffect: (callback: () => void | (() => void)) => React.useEffect(callback, [callback]),
  };
});

jest.mock('../../inboxData', () => ({ fetchOwnInboxView: jest.fn() }));
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
  id: 'room-1',
  booking_id: 'booking-1',
  customer_id: 'customer-1',
  barber_id: 'barber-1',
};

const barber: BarberDirectoryRow = {
  id: 'barber-1',
  name: 'Tarek Mansour',
  city: 'Berlin',
  country: 'Germany',
  profile_image: null,
  bio: null,
  rating: 4.9,
  verified: true,
  display_latitude: null,
  display_longitude: null,
};

const thread: InboxThread = {
  room,
  barber,
  customer: null,
  booking: null,
  service: null,
  lastMessage: null,
  lastActivityIso: null,
};

const mockFetchInbox = jest.mocked(fetchOwnInboxView);

beforeEach(() => {
  mockFetchInbox.mockResolvedValue({ status: 'ok', threads: [thread] });
});

afterEach(async () => {
  cleanup();
  await new Promise<void>((resolve) => setImmediate(resolve));
});

describe('InboxScreen avatar integration', () => {
  it('keeps the empty state hidden while thread previews load', async () => {
    let finish!: (value: Awaited<ReturnType<typeof fetchOwnInboxView>>) => void;
    mockFetchInbox.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await render(<InboxScreen navigation={{ navigate: jest.fn() } as never} route={{} as never} />);

    expect(screen.getByTestId('customer-inbox-loading').props.accessibilityRole).toBe('progressbar');
    expect(screen.queryByTestId('customer-inbox-empty')).toBeNull();
    await act(async () => finish({ status: 'ok', threads: [thread] }));
    await waitFor(() => expect(screen.getByTestId('customer-inbox-row-room-1')).toBeTruthy());
    expect(screen.queryByTestId('customer-inbox-loading')).toBeNull();
  });

  it('renders a decorative two-initial barber monogram inside the labelled row', async () => {
    await render(<InboxScreen navigation={{ navigate: jest.fn() } as never} route={{} as never} />);

    await waitFor(() => expect(screen.getByTestId('customer-inbox-avatar-room-1')).toBeTruthy());
    expect(screen.getByTestId('customer-inbox-avatar-room-1').props.accessible).toBe(false);
    expect(screen.getByTestId('customer-inbox-avatar-room-1-monogram').props.children).toBe('TM');
    expect(screen.getByTestId('customer-inbox-row-room-1').props.accessibilityLabel).toBe(
      'Open conversation with Tarek Mansour'
    );
  });
});
