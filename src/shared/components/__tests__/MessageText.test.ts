import { linkifyMessage } from '../MessageText';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

describe('linkifyMessage', () => {
  it('finds phone numbers, emails and https links between plain text', () => {
    expect(linkifyMessage('Call +49 151 2345 6789 or mail me@example.com, see https://privelier.app/help.')).toEqual([
      { kind: 'text', value: 'Call ' },
      { kind: 'phone', value: '+49 151 2345 6789', href: 'tel:+4915123456789' },
      { kind: 'text', value: ' or mail ' },
      { kind: 'email', value: 'me@example.com', href: 'mailto:me@example.com' },
      { kind: 'text', value: ', see ' },
      { kind: 'url', value: 'https://privelier.app/help', href: 'https://privelier.app/help' },
      { kind: 'text', value: '.' },
    ]);
  });

  it('leaves times, prices, short numbers and non-web schemes as text', () => {
    expect(linkifyMessage('See you at 14:30, €45, door 12')).toEqual([{ kind: 'text', value: 'See you at 14:30, €45, door 12' }]);
    expect(linkifyMessage('open javascript:alert(1) or app://x').every((s) => s.kind === 'text')).toBe(true);
  });
});
