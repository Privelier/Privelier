import { authErrorCopy, authErrorCopyDe } from '../../auth/errors';
import { customerDataErrorCopy, customerDataErrorCopyDe } from '../../customer/errors';
import { barberDataErrorCopy, barberDataErrorCopyDe } from '../../barber/errors';

it.each([
  ['auth', authErrorCopy, authErrorCopyDe],
  ['customer', customerDataErrorCopy, customerDataErrorCopyDe],
  ['barber', barberDataErrorCopy, barberDataErrorCopyDe],
])('%s error copy has a German message for every code', (_name, en, de) => {
  expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  for (const value of Object.values(de)) expect(value.trim().length).toBeGreaterThan(0);
});
