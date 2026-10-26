/**
 * Every uploaded photo is decoded and re-encoded as a fresh JPEG, which is
 * what drops EXIF (including GPS). The native encoder cannot run under
 * Jest, so this pins the contract; the byte-level check on a device build is
 * listed in docs/hardening/FOUNDER_ACTIONS.md.
 */
import { normalizeImageForUpload } from '../imageUpload';

const mockSaveAsync = jest.fn();
const mockResize = jest.fn();
let mockRendered = { width: 1000, height: 800, saveAsync: mockSaveAsync };

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: jest.fn(() => ({
      resize: (size: unknown) => {
        mockResize(size);
        return { renderAsync: () => Promise.resolve({ width: 2048, height: 1536, saveAsync: mockSaveAsync }) };
      },
      renderAsync: () => Promise.resolve(mockRendered),
    })),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRendered = { width: 1000, height: 800, saveAsync: mockSaveAsync };
  mockSaveAsync.mockResolvedValue({ uri: 'file:///cache/reencoded.jpg' });
});

it('always uploads a freshly encoded JPEG, never the picked original', async () => {
  const result = await normalizeImageForUpload('file:///photos/IMG_0001.HEIC');

  expect(mockSaveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.85 });
  expect(result).toEqual({ uri: 'file:///cache/reencoded.jpg', mimeType: 'image/jpeg' });
  expect(result.uri).not.toContain('IMG_0001');
});

it('never asks the encoder to carry EXIF over', async () => {
  await normalizeImageForUpload('file:///photos/a.jpg');

  for (const [options] of mockSaveAsync.mock.calls) {
    expect(options).not.toHaveProperty('exif');
    expect(options).not.toHaveProperty('base64', true);
  }
});

it('caps the long edge at 2048 px to bound storage and egress', async () => {
  mockRendered = { width: 4032, height: 3024, saveAsync: mockSaveAsync };

  await normalizeImageForUpload('file:///photos/large.jpg');

  expect(mockResize).toHaveBeenCalledWith({ width: 2048 });
});
