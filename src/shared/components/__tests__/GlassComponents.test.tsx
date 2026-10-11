import { fireEvent, render, screen } from '@testing-library/react-native';
import { EmptyState } from '../EmptyState';
import { GlassChip } from '../GlassChip';
import { GlassSegmentedControl } from '../GlassSegmentedControl';
import { JumpToLatestButton } from '../JumpToLatestButton';

jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('../../haptics', () => ({ haptics: { selection: jest.fn(() => Promise.resolve()) } }));

it('chip announces its selection', async () => {
  const onPress = jest.fn();
  await render(<GlassChip label="Fade" selected onPress={onPress} testID="chip" />);
  expect(screen.getByTestId('chip').props.accessibilityState).toEqual({ selected: true });
  await fireEvent.press(screen.getByTestId('chip'));
  expect(onPress).toHaveBeenCalled();
});

it('empty state renders title, body and its one action', async () => {
  const onPress = jest.fn();
  await render(<EmptyState icon="calendar" title="Nothing yet" body="Book a barber." testID="empty" action={{ label: 'Find a barber', onPress, testID: 'empty-action' }} />);
  expect(screen.getByTestId('empty')).toHaveTextContent('Nothing yet');
  expect(screen.getByText('Book a barber.')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('empty-action'));
  expect(onPress).toHaveBeenCalled();
});

it('jump-to-latest renders only when away from the newest message', async () => {
  await render(<JumpToLatestButton visible={false} onPress={jest.fn()} label="Jump to latest message" testID="jump" />);
  expect(screen.queryByTestId('jump')).toBeNull();
  await screen.rerender(<JumpToLatestButton visible onPress={jest.fn()} label="Jump to latest message" testID="jump" />);
  expect(screen.getByLabelText('Jump to latest message')).toBeTruthy();
});

it('segmented control exposes tabs with selected state and reports changes', async () => {
  const onChange = jest.fn();
  await render(
    <GlassSegmentedControl
      value="a"
      onChange={onChange}
      segments={[{ key: 'a', label: 'Upcoming', testID: 'seg-a' }, { key: 'b', label: 'Past', testID: 'seg-b' }]}
    />
  );
  expect(screen.getByTestId('seg-a').props.accessibilityState).toEqual({ selected: true });
  await fireEvent.press(screen.getByTestId('seg-a'));
  expect(onChange).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('seg-b'));
  expect(onChange).toHaveBeenCalledWith('b');
});
