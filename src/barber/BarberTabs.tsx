import { createRef, useState } from 'react';
import { View } from 'react-native';
import { BlurTargetView } from 'expo-blur';
import { getAppLanguage } from '../shared/locale';
import { GlassSurface } from '../shared/components/GlassSurface';
import { useFloatingTabBarStyle } from '../shared/navigation/tabBarClearance';
import { TabBarClearanceBridge } from '../shared/navigation/TabBarClearanceBridge';
/**
 * Barber bottom-tab shell, rebuilt from the prototype's BarberBottomNav:
 * five tabs (Studio, Requests, Portfolio, Chats, Verify) with the same
 * anatomy as the customer shell — hairline top border, brass active tint,
 * 10px labels under 20px light-stroke icons.
 */
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';
import { useUnread } from './UnreadContext';
import { BrassTabIcon, HapticTabButton, SlidingTabIndicator } from '../shared/components/BrassTabBarItem';
import StudioScreen from './screens/StudioScreen';
import RequestsScreen from './screens/RequestsScreen';
import PortfolioScreen from './screens/PortfolioScreen';
import ChatsScreen from './screens/ChatsScreen';
import VerifyScreen from './screens/VerifyScreen';

export type BarberTabParamList = {
  Studio: undefined;
  Requests: undefined;
  Portfolio: undefined;
  Chats: undefined;
  Verify: undefined;
};

const Tab = createBottomTabNavigator<BarberTabParamList>();

/** Tab order, matching the Tab.Screen order below; drives the sliding indicator. */
const TAB_ORDER: string[] = ['Studio', 'Requests', 'Portfolio', 'Chats', 'Verify'];

const TAB_ICONS: Record<keyof BarberTabParamList, keyof typeof Feather.glyphMap> = {
  Studio: 'bar-chart-2',
  Requests: 'inbox',
  Portfolio: 'sliders',
  Chats: 'message-square',
  Verify: 'shield',
};

export default function BarberTabs() {
  const { colors, fonts } = useTheme();
  const tabBarStyle = useFloatingTabBarStyle();
  const language = getAppLanguage();
  const [blurTargets] = useState(() => ({ Studio: createRef<View>(), Requests: createRef<View>(), Portfolio: createRef<View>(), Chats: createRef<View>(), Verify: createRef<View>() }));
  const labels = language === 'de' ? { Studio: 'Dashboard', Requests: 'Anfragen', Portfolio: 'Studio', Chats: 'Nachrichten', Verify: 'Verifizierung' } : { Studio: 'Dashboard', Requests: 'Requests', Portfolio: 'Studio', Chats: 'Messages', Verify: 'Verification' };

  // Unread thread count for the Chats badge — a real count from real read
  // state (provider in BarberNavigator), hidden entirely at zero.
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
        tabBarButtonTestID: `barber-tab-${route.name.toLowerCase()}`,
      })}
    >
        <Tab.Screen name="Studio" component={StudioScreen} options={{ tabBarLabel: 'Dashboard', tabBarAccessibilityLabel: 'Dashboard' }} />
      <Tab.Screen name="Requests" component={RequestsScreen} />
      <Tab.Screen name="Portfolio" component={PortfolioScreen} options={{ tabBarLabel: 'Studio', tabBarAccessibilityLabel: 'Studio' }} />
      <Tab.Screen
        name="Chats"
        component={ChatsScreen}
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
      <Tab.Screen name="Verify" component={VerifyScreen} />
    </Tab.Navigator>
  );
}
