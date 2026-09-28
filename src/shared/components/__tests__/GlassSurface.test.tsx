import { render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { GlassSurface } from '../GlassSurface';

jest.mock('expo-blur', () => {
  const { View } = jest.requireActual('react-native');
  return { BlurView: View };
});

it('renders consistent smoked glass without a moving backdrop blur', async () => {
  await render(<GlassSurface testID="surface" />);
  const surface = screen.getByTestId('surface');
  expect(['rgba(20,20,22,0.84)', 'rgba(255,255,255,0.84)']).toContain(
    StyleSheet.flatten(surface.props.style).backgroundColor
  );
  expect(screen.queryByTestId('surface-blur')).toBeNull();
});

it('uses the opaque accessibility fallback for navigation glass before transparency is checked', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValue(true);
  await render(<GlassSurface variant="navigation" testID="navigation-glass" />);
  expect(StyleSheet.flatten(screen.getByTestId('navigation-glass').props.style).backgroundColor).toBe('#1B1B1E');
});
