/**
 * One native transition for every stack in both apps and the auth shell.
 *
 * Native-stack animations run in the platform's own transition system, so
 * they cost nothing on the JS thread. Android gets the same right-to-left
 * slide iOS uses (instead of its default fade-from-bottom), and iOS gets a
 * full-screen back swipe. Reduce Motion swaps every push for a short fade.
 */
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { duration } from '../../theme/motion';

export function stackScreenOptions(reduceMotion: boolean): NativeStackNavigationOptions {
  return {
    headerShown: false,
    animation: reduceMotion ? 'fade' : 'ios_from_right',
    animationDuration: reduceMotion ? duration.base : 320,
    gestureEnabled: true,
    fullScreenGestureEnabled: !reduceMotion,
  };
}
