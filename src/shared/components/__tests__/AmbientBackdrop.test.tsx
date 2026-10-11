import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { AmbientBackdrop, BackdropLayout } from '../AmbientBackdrop';

jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual('react-native');
  const Stub = ({ children }: { children?: unknown }) => children ?? null;
  return { __esModule: true, default: View, Defs: Stub, RadialGradient: Stub, Stop: () => null, Rect: () => null };
});

it('paints behind content without taking touches or screen-reader focus', async () => {
  await render(<AmbientBackdrop />);
  const backdrop = screen.getByTestId('ambient-backdrop', { includeHiddenElements: true });
  expect(backdrop.props.pointerEvents).toBe('none');
  expect(backdrop.props.accessibilityElementsHidden).toBe(true);
});

it('lays a screen over its backdrop', async () => {
  await render(<BackdropLayout><Text>Screen</Text></BackdropLayout>);
  expect(screen.getByText('Screen')).toBeTruthy();
});
