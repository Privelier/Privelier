import { render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { GlassSurface } from '../GlassSurface';

jest.mock('expo-blur', () => {
  const { View } = jest.requireActual('react-native');
  return { BlurView: View };
});

it('renders card glass as translucent with a light edge and never a live blur', async () => {
  await render(<GlassSurface testID="surface" />);
  const style = StyleSheet.flatten(screen.getByTestId('surface').props.style);
  expect(style.backgroundColor).toBe('rgba(28,28,32,0.52)');
  expect(style.borderColor).toBe('rgba(245,241,232,0.14)');
  expect(screen.queryByTestId('surface-blur')).toBeNull();
});

it('falls back to a solid surface for floating glass under Reduce Transparency', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValue(true);
  await render(<GlassSurface variant="floating" testID="floating" />);
  expect(StyleSheet.flatten(screen.getByTestId('floating').props.style).backgroundColor).toBe('#1B1B1E');
  expect(screen.queryByTestId('floating-blur')).toBeNull();
});

it('uses the opaque accessibility fallback for navigation glass before transparency is checked', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValue(true);
  await render(<GlassSurface variant="navigation" testID="navigation-glass" />);
  expect(StyleSheet.flatten(screen.getByTestId('navigation-glass').props.style).backgroundColor).toBe('#1B1B1E');
});
