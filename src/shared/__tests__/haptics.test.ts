import * as Haptics from 'expo-haptics';
import { haptics } from '../haptics';

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium' },
  NotificationFeedbackType: { Success: 'Success', Warning: 'Warning' },
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
}));

const impact = Haptics.impactAsync as jest.Mock;
const notification = Haptics.notificationAsync as jest.Mock;

beforeEach(() => {
  impact.mockReset().mockResolvedValue(undefined);
  notification.mockReset().mockResolvedValue(undefined);
});

it('maps selection and confirmation to restrained impact feedback', async () => {
  await haptics.selection();
  await haptics.confirm();

  expect(impact.mock.calls).toEqual([['Light'], ['Medium']]);
  expect(notification).not.toHaveBeenCalled();
});

it('maps completed and destructive actions to semantic notifications', async () => {
  await haptics.success();
  await haptics.warning();

  expect(notification.mock.calls).toEqual([['Success'], ['Warning']]);
});

it('never prevents the action when the native haptics call rejects', async () => {
  impact.mockRejectedValueOnce(new Error('no haptics hardware'));
  notification.mockRejectedValueOnce(new Error('notifications unavailable'));

  await expect(haptics.selection()).resolves.toBeUndefined();
  await expect(haptics.success()).resolves.toBeUndefined();
});
