import { render, screen } from '@testing-library/react-native';
import {
  CardListSkeleton,
  ConversationSkeleton,
  FormSkeleton,
  PortfolioGridSkeleton,
  RowListSkeleton,
  StatusCardSkeleton,
} from '../ScreenSkeletons';

jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({ colors: { surface: '#1B1B1E', border: '#333' } }),
}));
jest.mock('../../motion/useReducedMotionPreference', () => ({ useReducedMotionPreference: () => true }));

it.each([
  ['form', <FormSkeleton key="f" testID="sk" label="Loading your bio" multiline />],
  ['rows', <RowListSkeleton key="r" testID="sk" label="Loading your services" />],
  ['grid', <PortfolioGridSkeleton key="g" testID="sk" label="Loading your portfolio" />],
  ['status', <StatusCardSkeleton key="s" testID="sk" label="Loading your verification" />],
  ['cards', <CardListSkeleton key="c" testID="sk" label="Loading barbers" />],
  ['thread', <ConversationSkeleton key="t" testID="sk" label="Loading messages" />],
])('%s placeholder is one labelled progress element with no invented text', async (_name, element) => {
  await render(element);
  const root = screen.getByTestId('sk');
  expect(root.props.accessible).toBe(true);
  expect(root.props.accessibilityRole).toBe('progressbar');
  expect(root.props.accessibilityLabel).toMatch(/^Loading /);
  // Shapes only: a placeholder must never render sample copy.
  expect(screen.queryAllByText(/.+/)).toHaveLength(0);
});
