import { render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { GlassSurface, glass } from '../GlassSurface';
import { resetReduceTransparencyForTests } from '../../motion/useReduceTransparency';

jest.mock('expo-blur', () => {
  const { View } = jest.requireActual('react-native');
  return { BlurView: View };
});

beforeEach(() => {
  resetReduceTransparencyForTests();
  jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValue(false);
});

it('gives a card its own glass: translucent body, sheen, light edge, no live blur', async () => {
  await render(<GlassSurface testID="surface" />);
  const style = StyleSheet.flatten(screen.getByTestId('surface').props.style);
  expect(style.backgroundColor).toBe(glass.cardFill);
  expect(style.borderColor).toBe(glass.edge);
  expect(style.experimental_backgroundImage).toBe(glass.sheen);
  expect(style.boxShadow).toBe(glass.innerLight);
  expect(screen.queryByTestId('surface-blur')).toBeNull();
});

it('renders brass glass for the brass tone', async () => {
  await render(<GlassSurface tone="brass" testID="brass" />);
  const style = StyleSheet.flatten(screen.getByTestId('brass').props.style);
  expect(style.backgroundColor).toBe(glass.brassFill);
  expect(style.experimental_backgroundImage).toBe(glass.brassSheen);
});

it('falls back to a solid surface without sheen or blur under Reduce Transparency', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValue(true);
  await render(<GlassSurface variant="floating" testID="floating" />);
  const style = StyleSheet.flatten(screen.getByTestId('floating').props.style);
  expect(style.backgroundColor).toBe('#1B1B1E');
  expect(style.experimental_backgroundImage).toBeUndefined();
  expect(screen.queryByTestId('floating-blur')).toBeNull();
});
