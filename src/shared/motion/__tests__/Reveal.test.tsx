import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { Reveal } from '../Reveal';
import { reveal } from '../../../theme/motion';

it('renders its children immediately, so content is never held back by motion', async () => {
  await render(
    <Reveal index={3} testID="section">
      <Text>Content</Text>
    </Reveal>
  );
  expect(screen.getByTestId('section')).toBeTruthy();
  expect(screen.getByText('Content')).toBeTruthy();
});

it('caps the stagger so a long screen never waits on its lower sections', () => {
  expect(reveal.maxStaggerSteps * reveal.stagger + reveal.duration).toBeLessThanOrEqual(500);
  expect(reveal.offset).toBeLessThanOrEqual(16);
});
