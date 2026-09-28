import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { GlassSurface } from '../GlassSurface';

it('renders consistent smoked glass without a moving backdrop blur', async () => {
  await render(<GlassSurface testID="surface" />);
  const surface = screen.getByTestId('surface');
  expect(['rgba(20,20,22,0.84)', 'rgba(255,255,255,0.84)']).toContain(
    StyleSheet.flatten(surface.props.style).backgroundColor
  );
  expect(screen.queryByTestId('surface-blur')).toBeNull();
});

it('keeps navigation glass nearly opaque so tab content cannot tint the bar', async () => {
  await render(<GlassSurface variant="navigation" testID="navigation-glass" />);
  expect(['rgba(13,13,15,0.94)', 'rgba(248,244,236,0.94)']).toContain(
    StyleSheet.flatten(screen.getByTestId('navigation-glass').props.style).backgroundColor
  );
});
