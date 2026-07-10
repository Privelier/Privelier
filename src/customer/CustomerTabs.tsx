/**
 * Customer bottom-tab shell, rebuilt from the prototype's CustomerBottomNav:
 * five tabs (Discover, Explore, Bookings, Inbox, Account), hairline top
 * border, brass active tint, 10px labels under 20px light-stroke icons.
 * Explore/Bookings/Inbox are placeholders until their build-order steps.
 */
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';
import { useUnread } from './UnreadContext';
import DiscoverScreen from './screens/DiscoverScreen';
import AccountScreen from './screens/AccountScreen';
import BookingsScreen from './screens/BookingsScreen';
import InboxScreen from './screens/InboxScreen';
import { ExploreScreen } from './screens/tabPlaceholders';

export type CustomerTabParamList = {
  Discover: undefined;
  Explore: undefined;
  Bookings: undefined;
  Inbox: undefined;
  Account: undefined;
};

const Tab = createBottomTabNavigator<CustomerTabParamList>();

const TAB_ICONS: Record<keyof CustomerTabParamList, keyof typeof Feather.glyphMap> = {
  Discover: 'compass',
  Explore: 'map',
  Bookings: 'calendar',
  Inbox: 'message-square',
  Account: 'user',
};

export default function CustomerTabs() {
  const { colors, fonts } = useTheme();
  // Unread thread count for the Inbox badge — a real count from real read
  // state (provider in CustomerNavigator), hidden entirely at zero.
  const { unreadCount } = useUnread();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accentText,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 0.5,
          borderTopColor: colors.border,
          elevation: 0,
        },
        tabBarLabelStyle: { fontSize: 10, fontFamily: fonts.body },
        tabBarIcon: ({ color }) => <Feather name={TAB_ICONS[route.name]} size={20} color={color} />,
        tabBarButtonTestID: `customer-tab-${route.name.toLowerCase()}`,
      })}
    >
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Bookings" component={BookingsScreen} />
      <Tab.Screen
        name="Inbox"
        component={InboxScreen}
        options={{
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.accent,
            color: colors.onAccent,
            fontSize: 10,
            fontFamily: fonts.bodySemiBold,
          },
        }}
      />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}
