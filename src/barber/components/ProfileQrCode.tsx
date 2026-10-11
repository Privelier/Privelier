/**
 * A real, locally generated QR code for the barber's profile link (Wave 5).
 * The matrix comes from the `qrcode` library (no network), drawn as one SVG
 * path so even a dense code is a single native view.
 */
import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import QRCode from 'qrcode';

export function qrPath(value: string): { size: number; d: string } {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  let d = '';
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (qr.modules.get(x, y)) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return { size, d };
}

export function ProfileQrCode({ value, size = 200, testID }: { value: string; size?: number; testID?: string }) {
  const { size: modules, d } = useMemo(() => qrPath(value), [value]);
  const quiet = 2;
  const view = modules + quiet * 2;
  return (
    <Svg width={size} height={size} viewBox={`${-quiet} ${-quiet} ${view} ${view}`} testID={testID} accessibilityLabel="QR code">
      {/* Dark modules on a light field: scanners need the contrast. */}
      <Rect x={-quiet} y={-quiet} width={view} height={view} fill="#F5F1E8" />
      <Path d={d} fill="#121214" />
    </Svg>
  );
}
