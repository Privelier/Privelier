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
  Studio: 'grid',
  Requests: 'inbox',
  Portfolio: 'image',
  Chats: 'message-square',
  Verify: 'shield',
};

export default function BarberTabs() {
  const { colors, fonts } = useTheme();
  // Unread thread count for the Chats badge — a real count from real read
  // state (provider in BarberNavigator), hidden entirely at zero.
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
        tabBarButtonTestID: `barber-tab-${route.name.toLowerCase()}`,
      })}
    >
      <Tab.Screen name="Studio" component={StudioScreen} />
      <Tab.Screen name="Requests" component={RequestsScreen} />
      <Tab.Screen name="Portfolio" component={PortfolioScreen} />
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
