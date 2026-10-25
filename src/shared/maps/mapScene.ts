/**
 * Renderer-neutral description of what a map shows. Both renderers — native
 * MapLibre (development/production builds) and the MapLibre GL web page
 * (Expo Go and web, see webMapHtml.ts) — draw exactly this, so a screen
 * describes its map once and looks the same everywhere.
 */
import type { LngLat } from '../tracking/geo';

export interface MapPin {
  id: string;
  lngLat: LngLat;
  label: string;
  accessibilityLabel: string;
  active?: boolean;
}

export interface MapScene {
  pins?: MapPin[];
  /** Whole route, drawn quietly underneath. */
  route?: LngLat[] | null;
  /** The part still ahead, drawn in brass on top. */
  routeAhead?: LngLat[] | null;
  /** The barber's live position. */
  vehicle?: { lngLat: LngLat; heading: number | null; stale?: boolean } | null;
  destination?: LngLat | null;
  /** Camera policy: frame everything once, or keep the vehicle in view. */
  camera?: 'fit' | 'follow';
}

export type MapEvent = { type: 'pin'; id: string } | { type: 'map' } | { type: 'ready' } | { type: 'error' };

/** Brand colours used by our own overlays (never by the base map). */
export const MAP_COLORS = {
  brass: '#BFA06B',
  brassSoft: 'rgba(191,160,107,0.28)',
  routeBase: '#3A3730',
  surface: '#1B1B1E',
  border: 'rgba(245,241,232,0.18)',
  text: '#F5F1E8',
  onAccent: '#121214',
  stale: '#9A968C',
} as const;
