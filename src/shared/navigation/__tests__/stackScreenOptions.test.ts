import { stackScreenOptions } from '../stackScreenOptions';

it('uses one native slide everywhere, with a full-screen back swipe', () => {
  expect(stackScreenOptions(false)).toMatchObject({
    headerShown: false,
    animation: 'ios_from_right',
    gestureEnabled: true,
    fullScreenGestureEnabled: true,
  });
});

it('replaces spatial pushes with a short fade under Reduce Motion', () => {
  const options = stackScreenOptions(true);
  expect(options.animation).toBe('fade');
  expect(options.animationDuration).toBeLessThanOrEqual(200);
  expect(options.fullScreenGestureEnabled).toBe(false);
  // Back navigation itself must stay available.
  expect(options.gestureEnabled).toBe(true);
});
