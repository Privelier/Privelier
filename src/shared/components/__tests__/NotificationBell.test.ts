import { formatNotificationBadge } from '../../notifications';

describe('formatNotificationBadge', () => {
  it('hides a zero badge and formats positive unread counts', () => {
    expect(formatNotificationBadge(0)).toBeNull();
    expect(formatNotificationBadge(1)).toBe('1');
    expect(formatNotificationBadge(99)).toBe('99');
    expect(formatNotificationBadge(100)).toBe('99+');
  });
});
