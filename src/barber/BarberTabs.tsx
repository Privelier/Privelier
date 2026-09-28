import { createRef, useState } from 'react';
import { View } from 'react-native';
import { BlurTargetView } from 'expo-blur';
import { getAppLanguage } from '../shared/locale';
import { GlassSurface } from '../shared/components/GlassSurface';
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
import { BrassTabIcon, HapticTabButton } from '../shared/components/BrassTabBarItem';
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

const TAB_ICONS: Record<keyof BarberTabParamList, keyof typeof Feather.glyphMap> = {
  Studio: 'bar-chart-2',
  Requests: 'inbox',
  Portfolio: 'sliders',
  Chats: 'message-square',
  Verify: 'shield',
};

export default function BarberTabs() {
  const { colors, fonts } = useTheme();
  const language = getAppLanguage();
  const [blurTargets] = useState(() => ({ Studio: createRef<View>(), Requests: createRef<View>(), Portfolio: createRef<View>(), Chats: createRef<View>(), Verify: createRef<View>() }));
  const labels = language === 'de' ? { Studio: 'Dashboard', Requests: 'Anfragen', Portfolio: 'Studio', Chats: 'Nachrichten', Verify: 'Verifizierung' } : { Studio: 'Dashboard', Requests: 'Requests', Portfolio: 'Studio', Chats: 'Messages', Verify: 'Verification' };

  // Unread thread count for the Chats badge — a real count from real read
  // state (provider in BarberNavigator), hidden entirely at zero.
  const { unreadCount } = useUnread();
  return (
    <Tab.Navigator
      screenLayout={({ children, route }) => <BlurTargetView ref={blurTargets[route.name]} style={{ flex: 1 }}>{children}</BlurTargetView>}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accentText,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: 'transparent',
          marginHorizontal: 12,
          marginBottom: 6,
          borderRadius: 22,
          paddingTop: 6,
          borderTopWidth: 0,
          borderTopColor: colors.border,
          elevation: 0,
        },
        tabBarHideOnKeyboard: true,
        tabBarBackground: () => <GlassSurface variant="navigation" blurTarget={blurTargets[route.name]} style={{ flex: 1, borderRadius: 22 }} />,
        tabBarLabel: labels[route.name],
        tabBarLabelStyle: { fontSize: 12, fontFamily: fonts.bodyMedium },
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
