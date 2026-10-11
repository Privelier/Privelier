import QRCode from 'qrcode';
import { qrPath } from '../ProfileQrCode';

jest.mock('react-native-svg', () => ({ __esModule: true, default: () => null, Path: () => null, Rect: () => null }));

it('draws exactly the dark modules of the real QR matrix for the link', () => {
  const value = 'privelier://barber/1549e8f2-13a6-460d-abfe-862e0dc8bb30';
  const { size, d } = qrPath(value);
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  let dark = 0;
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) if (qr.modules.get(x, y)) dark += 1;
  expect(size).toBe(qr.modules.size);
  expect(d.match(/M/g)?.length).toBe(dark);
});
