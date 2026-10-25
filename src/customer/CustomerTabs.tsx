import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { subscribeToBarberProfileLinks } from '../shared/profileLinks';
import { usePushOpen } from '../shared/push';
import type { CustomerStackParamList } from './CustomerNavigator';
import { createRef, useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { BlurTargetView } from 'expo-blur';
import { getAppLanguage } from '../shared/locale';
import { GlassSurface } from '../shared/components/GlassSurface';
import { useFloatingTabBarStyle } from '../shared/navigation/tabBarClearance';
import { TabBarClearanceBridge } from '../shared/navigation/TabBarClearanceBridge';
/**
 * Customer bottom-tab shell, rebuilt from the prototype's CustomerBottomNav:
 * five tabs (Discover, Explore, Bookings, Inbox, Account), hairline top
 * border, brass active tint, 10px labels under 20px light-stroke icons.
 * All five tabs are real screens as of the Explore Run B build.
 */
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';
import { useUnread } from './UnreadContext';
import { BrassTabIcon, HapticTabButton, SlidingTabIndicator } from '../shared/components/BrassTabBarItem';
import DiscoverScreen from './screens/DiscoverScreen';
import AccountScreen from './screens/AccountScreen';
import BookingsScreen from './screens/BookingsScreen';
import InboxScreen from './screens/InboxScreen';
import ExploreScreen from './screens/ExploreScreen';

export type CustomerTabParamList = {
  Discover: undefined;
  Explore: undefined;
  Bookings: undefined;
  Inbox: undefined;
  Account: undefined;
};

const Tab = createBottomTabNavigator<CustomerTabParamList>();

/** Tab order, matching the Tab.Screen order below; drives the sliding indicator. */
const TAB_ORDER: string[] = ['Discover', 'Explore', 'Bookings', 'Inbox', 'Account'];

const TAB_ICONS: Record<keyof CustomerTabParamList, keyof typeof Feather.glyphMap> = {
  Discover: 'compass',
  Explore: 'map',
  Bookings: 'calendar',
  Inbox: 'message-square',
  Account: 'user',
};

export default function CustomerTabs() {
  // Profile links (privelier://barber/<id>) open over the tabs, including a
  // link that launched the app before sign-in.
  const stackNavigation = useNavigation<NativeStackNavigationProp<CustomerStackParamList>>();
  useEffect(
    () => subscribeToBarberProfileLinks((barberId) => stackNavigation.navigate('BarberProfile', { barberId })),
    [stackNavigation]
  );
  // Push taps: trip pushes open live tracking, the rest the matching tab.
  usePushOpen(useCallback((data) => {
    if (data.eventType?.startsWith('trip_') && data.bookingId) {
      stackNavigation.navigate('LiveTrip', { bookingId: data.bookingId });
    } else if (data.eventType === 'message') {
      stackNavigation.navigate('CustomerTabs', { screen: 'Inbox' });
    } else if (data.eventType) {
      stackNavigation.navigate('CustomerTabs', { screen: 'Bookings' });
    }
  }, [stackNavigation]));
  const { colors, fonts } = useTheme();
  const tabBarStyle = useFloatingTabBarStyle();
  const language = getAppLanguage();
  const [blurTargets] = useState(() => ({ Discover: createRef<View>(), Explore: createRef<View>(), Bookings: createRef<View>(), Inbox: createRef<View>(), Account: createRef<View>() }));
  const labels = language === 'de' ? { Discover: 'Entdecken', Explore: 'Karte', Bookings: 'Termine', Inbox: 'Nachrichten', Account: 'Konto' } : { Discover: 'Discover', Explore: 'Explore', Bookings: 'Bookings', Inbox: 'Messages', Account: 'Account' };

  // Unread thread count for the Inbox badge — a real count from real read
  // state (provider in CustomerNavigator), hidden entirely at zero.
  const { unreadCount } = useUnread();
  return (
    <Tab.Navigator
      // The pill floats above the home indicator (see useFloatingTabBarStyle),
      // so the bar must not also pad itself by the bottom inset.
      safeAreaInsets={{ bottom: 0 }}
      screenLayout={({ children, route }) => (
        // The blur target is the screen itself: the floating glass bar frosts
        // the content scrolling beneath it.
        <BlurTargetView ref={blurTargets[route.name]} style={{ flex: 1, backgroundColor: colors.background }}>
          <TabBarClearanceBridge>{children}</TabBarClearanceBridge>
        </BlurTargetView>
      )}
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.accentText,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle,

        tabBarHideOnKeyboard: true,
        tabBarBackground: () => (
          <GlassSurface variant="navigation" blurTarget={blurTargets[route.name]} style={{ flex: 1, borderRadius: 24 }}>
            <SlidingTabIndicator index={TAB_ORDER.indexOf(route.name)} count={TAB_ORDER.length} />
          </GlassSurface>
        ),
        tabBarLabel: labels[route.name],
        // 11pt (with HapticTabButton's full-width label area) so the longest
        // German labels ("Nachrichten", "Verifizierung") fit a 393pt-wide
        // iPhone; at 12pt they were cut to "Nachrich…".
        tabBarLabelStyle: { fontSize: 11, fontFamily: fonts.bodyMedium },
        tabBarIcon: ({ color, focused }) => <BrassTabIcon name={TAB_ICONS[route.name]} color={color} focused={focused} />,
        tabBarButton: (props) => <HapticTabButton {...props} />,
        tabBarAccessibilityLabel: labels[route.name],
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
