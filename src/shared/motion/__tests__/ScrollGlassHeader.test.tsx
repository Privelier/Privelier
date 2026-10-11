import { render, screen } from '@testing-library/react-native';
import { ScrollGlassHeader } from '../ScrollGlassHeader';

jest.mock('react-native-safe-area-context', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: ({ children }: { children?: unknown }) => React.createElement(View, null, children) };
});
jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({ colors: { textPrimary: '#F5F1E8' }, fonts: { headingMedium: 'Playfair' } }),
}));

function bar(offset: number) {
  return <ScrollGlassHeader title="Discover" scrollY={{ value: offset } as never} start={64} testID="glass" />;
}

it('never blocks touches or duplicates the heading for screen readers', async () => {
  await render(bar(0));
  const header = screen.getByTestId('glass', { includeHiddenElements: true });
  expect(header.props.pointerEvents).toBe('none');
  expect(header.props.accessibilityElementsHidden).toBe(true);
  expect(header.props.importantForAccessibility).toBe('no-hide-descendants');
});

it('stays invisible until the screen heading has scrolled away, then fully appears', async () => {
  const { rerender } = await render(bar(0));
  const opacityAt = () => {
    const style = [screen.getByTestId('glass', { includeHiddenElements: true }).props.style].flat(Infinity);
    return style.reduce((value: number | undefined, item: { opacity?: number } | undefined) => item?.opacity ?? value, undefined);
  };
  expect(opacityAt()).toBe(0);
  await rerender(bar(200));
  expect(opacityAt()).toBe(1);
});
