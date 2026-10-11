import * as Linking from 'expo-linking';
import { barberProfileLink, parseBarberProfileLink, resetHandledProfileLinks, subscribeToBarberProfileLinks } from '../profileLinks';

jest.mock('expo-linking', () => ({ getInitialURL: jest.fn(), addEventListener: jest.fn(() => ({ remove: jest.fn() })) }));

const ID = '1549e8f2-13a6-460d-abfe-862e0dc8bb30';

it('round-trips a barber profile link and rejects anything else', () => {
  expect(parseBarberProfileLink(barberProfileLink(ID))).toBe(ID);
  expect(parseBarberProfileLink(`privelier://barber/${ID.toUpperCase()}`)).toBe(ID);
  expect(parseBarberProfileLink('privelier://barber/not-a-uuid')).toBeNull();
  expect(parseBarberProfileLink(`privelier://barber/${ID}/extra`)).toBeNull();
  expect(parseBarberProfileLink(`https://evil.example/barber/${ID}`)).toBeNull();
  expect(parseBarberProfileLink('privelier://auth-callback#access_token=x')).toBeNull();
});

it('opens the launch link once per session, so a re-login does not replay it', async () => {
  resetHandledProfileLinks();
  jest.mocked(Linking.getInitialURL).mockResolvedValue(barberProfileLink(ID));
  const open = jest.fn();
  subscribeToBarberProfileLinks(open)();
  await Promise.resolve();
  subscribeToBarberProfileLinks(open)();
  await Promise.resolve();
  expect(open).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledWith(ID);
});
