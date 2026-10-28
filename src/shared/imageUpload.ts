/**
 * Re-encode a picked photo to JPEG before upload.
 *
 * Decoding to pixels and encoding a fresh JPEG drops every EXIF block,
 * including GPS: a portfolio photo taken at home would otherwise publish the
 * barber's address from a PUBLIC bucket and defeat the display-location
 * offset. It also turns HEIC/HEIF (which the buckets reject) into JPEG and
 * caps the long edge so uploads stay well under the 10 MB bucket limit.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const MAX_EDGE = 2048;

export interface NormalizedImage {
  uri: string;
  mimeType: 'image/jpeg';
}

/** The normalized JPEG's bytes, ready for a Storage upload body. */
export async function readNormalizedImage(uri: string): Promise<{ bytes: ArrayBuffer; contentType: 'image/jpeg' }> {
  const normalized = await normalizeImageForUpload(uri);
  const response = await fetch(normalized.uri);
  return { bytes: await response.arrayBuffer(), contentType: normalized.mimeType };
}

export async function normalizeImageForUpload(uri: string): Promise<NormalizedImage> {
  let image = await ImageManipulator.manipulate(uri).renderAsync();
  if (Math.max(image.width, image.height) > MAX_EDGE) {
    image = await ImageManipulator.manipulate(image)
      .resize(image.width >= image.height ? { width: MAX_EDGE } : { height: MAX_EDGE })
      .renderAsync();
  }
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  return { uri: saved.uri, mimeType: 'image/jpeg' };
}
