import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { haptics } from '../../haptics';
import { BrassTabIcon, HapticTabButton } from '../BrassTabBarItem';

jest.mock('../../haptics', () => ({ haptics: { selection: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));

describe('tab feedback', () => {
  it('haptics only when changing tabs and keeps the navigation press', async () => {
    const onPress = jest.fn();
    const props = { onPress, accessibilityRole: 'tab', accessibilityLabel: 'Bookings', accessibilityState: { selected: false }, testID: 'tab' } as unknown as BottomTabBarButtonProps;
    const view = await render(<HapticTabButton {...props} />);
    await act(async () => fireEvent.press(screen.getByTestId('tab')));
    expect(haptics.selection).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(StyleSheet.flatten(screen.getByTestId('tab').props.style).minHeight).toBe(44);

    await view.rerender(<HapticTabButton {...props} accessibilityState={{ selected: true }} />);
    await act(async () => fireEvent.press(screen.getByTestId('tab')));
    expect(haptics.selection).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('renders the active brass hairline indicator', async () => {
    await render(<BrassTabIcon name="calendar" color="#BFA06B" focused />);
    const indicator = screen.getByTestId('tab-indicator-calendar');
    expect(StyleSheet.flatten(indicator.props.style)).toMatchObject({ backgroundColor: '#BFA06B', width: 18, height: 2 });
  });
});
