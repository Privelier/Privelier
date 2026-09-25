import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { PrimaryButton } from '../PrimaryButton';
import { usePressFeedback } from '../../motion';

const mockOnPressIn = jest.fn();
const mockOnPressOut = jest.fn();

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}));

jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return { __esModule: true, default: { View } };
});

jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({
    colors: { accent: '#BFA06B', onAccent: '#121214' },
    fonts: { bodySemiBold: 'Inter_600SemiBold' },
  }),
}));

jest.mock('../../motion', () => ({
  usePressFeedback: jest.fn(() => ({
    animatedStyle: { opacity: 1, transform: [{ scale: 1 }] },
    onPressIn: mockOnPressIn,
    onPressOut: mockOnPressOut,
  })),
}));

const mockUsePressFeedback = jest.mocked(usePressFeedback);

describe('PrimaryButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('preserves its test ID, accessible label, action and 52pt target', async () => {
    const onPress = jest.fn();
    await render(<PrimaryButton label="Continue" onPress={onPress} testID="continue-button" />);
    const button = screen.getByTestId('continue-button');

    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('Continue');
    expect(StyleSheet.flatten(button.props.style).minHeight).toBe(52);

    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('wires press feedback to the reusable motion hook', async () => {
    await render(<PrimaryButton label="Book" onPress={jest.fn()} testID="book-button" />);
    const button = screen.getByTestId('book-button');

    await fireEvent(button, 'pressIn');
    await fireEvent(button, 'pressOut');

    expect(mockOnPressIn).toHaveBeenCalledTimes(1);
    expect(mockOnPressOut).toHaveBeenCalledTimes(1);
    expect(mockUsePressFeedback).toHaveBeenCalledWith({ disabled: false });
  });

  it('announces and blocks loading state without dimming it as disabled', async () => {
    const onPress = jest.fn();
    await render(
      <PrimaryButton label="Saving" onPress={onPress} testID="save-button" loading />
    );
    const button = screen.getByTestId('save-button');

    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(StyleSheet.flatten(button.props.style).opacity).toBeUndefined();
    expect(mockUsePressFeedback).toHaveBeenCalledWith({ disabled: true });

    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('supports a custom screen-reader label and disabled presentation', async () => {
    await render(
      <PrimaryButton
        label="Save"
        accessibilityLabel="Save profile"
        onPress={jest.fn()}
        testID="save-profile"
        disabled
      />
    );
    const button = screen.getByTestId('save-profile');

    expect(button.props.accessibilityLabel).toBe('Save profile');
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: false });
    expect(StyleSheet.flatten(button.props.style).opacity).toBe(0.6);
  });
});
