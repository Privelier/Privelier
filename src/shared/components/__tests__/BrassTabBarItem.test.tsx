import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { haptics } from '../../haptics';
import { HapticTabButton, SlidingTabIndicator, indicatorOffset } from '../BrassTabBarItem';

jest.mock('../../haptics', () => ({ haptics: { selection: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('../../../theme/useTheme', () => ({ useTheme: () => ({ colors: { accent: '#BFA06B' } }) }));

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

  it('renders one measured-first brass indicator track that never takes touches', async () => {
    await render(<SlidingTabIndicator index={0} count={5} />);
    expect(screen.getByTestId('tab-indicator-track').props.pointerEvents).toBe('none');
    expect(StyleSheet.flatten(screen.getByTestId('tab-indicator').props.style)).toMatchObject({
      backgroundColor: '#BFA06B', width: 24, height: 2, top: 0,
      // Hidden until the bar has been measured, so it never flashes at x = 0.
      opacity: 0,
    });
  });

  it('centres the indicator over each tab', () => {
    expect(indicatorOffset(0, 5, 350)).toBe(35 - 12);
    expect(indicatorOffset(2, 5, 350)).toBe(175 - 12);
    expect(indicatorOffset(4, 5, 350)).toBe(315 - 12);
  });
});
