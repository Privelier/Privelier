/**
 * Privelier's map look, built on OpenFreeMap — free vector tiles from
 * OpenStreetMap data with no API key, no request quota and no account
 * (openfreemap.org). Replaces the Mapbox styles and their per-load billing.
 *
 * We take OpenFreeMap's neutral "dark" style and re-tint it toward the
 * brand: the app's #121214 background, warm charcoal land, quiet roads, and
 * labels in the muted parchment tone of secondary text — so the map reads as
 * part of the smoked-glass UI rather than a generic grey embed. Brass is
 * never used on the base map; it is reserved for our own route and pins.
 *
 * The tinted style is cached (memory + AsyncStorage) so every map after the
 * first one opens instantly, and if the style cannot be fetched at all the
 * untinted OpenFreeMap URL still renders a perfectly usable map.
 */
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import { devWarn } from '../devLog';

export const OPENFREEMAP_DARK_URL = 'https://tiles.openfreemap.org/styles/dark';
export const MAP_ATTRIBUTION = '© OpenFreeMap © OpenMapTiles © OpenStreetMap contributors';

const CACHE_KEY = 'privelier.mapStyle.v1';
const FETCH_TIMEOUT_MS = 6000;

/** Brand tints keyed by OpenFreeMap layer id → paint overrides. */
const TINTS: Record<string, Record<string, unknown>> = {
  background: { 'background-color': '#121214' },
  water: { 'fill-color': '#0C0E11' },
  waterway: { 'line-color': '#0C0E11' },
  landuse_residential: { 'fill-color': '#151517' },
  landcover_wood: { 'fill-color': '#16181A' },
  landuse_park: { 'fill-color': '#16181A' },
  building: { 'fill-color': '#19191C', 'fill-outline-color': '#232327' },
  highway_path: { 'line-color': '#1E1E22' },
  highway_minor: { 'line-color': '#212125' },
  highway_major_casing: { 'line-color': 'rgba(70,66,58,0.55)' },
  highway_major_inner: { 'line-color': '#26262A' },
  highway_major_subtle: { 'line-color': '#2A2A2E' },
  highway_motorway_casing: { 'line-color': 'rgba(80,74,62,0.6)' },
  highway_motorway_subtle: { 'line-color': '#26262A' },
  railway: { 'line-color': '#24242A' },
  railway_minor: { 'line-color': '#24242A' },
  railway_transit: { 'line-color': '#24242A' },
  highway_name_other: { 'text-color': '#6F6B63', 'text-halo-color': '#121214' },
  highway_name_motorway: { 'text-color': '#7A766D', 'text-halo-color': '#121214' },
  water_name: { 'text-color': '#66717D', 'text-halo-color': '#0C0E11' },
};
const PLACE_LABEL = { 'text-color': '#8F8B81', 'text-halo-color': 'rgba(18,18,20,0.85)' };

type StyleLayer = { id: string; type: string; paint?: Record<string, unknown>; layout?: Record<string, unknown> };

/** Pure: returns a re-tinted copy of an OpenFreeMap style document. */
export function brandMapStyle(style: StyleSpecification): StyleSpecification {
  const layers = (style.layers as StyleLayer[]).map((layer) => {
    const tint = TINTS[layer.id] ?? (layer.id.startsWith('place_') ? PLACE_LABEL : null);
    // Brand rule: never all-caps. The base style upper-cases place names.
    const caps = layer.layout?.['text-transform'] !== undefined && layer.layout['text-transform'] !== 'none';
    if (!tint && !caps) return layer;
    return {
      ...layer,
      ...(tint ? { paint: { ...(layer.paint ?? {}), ...tint } } : {}),
      ...(caps ? { layout: { ...layer.layout, 'text-transform': 'none' } } : {}),
    };
  });
  return { ...style, layers } as StyleSpecification;
}

let memoryStyle: StyleSpecification | null = null;
let inflight: Promise<StyleSpecification | null> | null = null;

async function fetchBrandStyle(): Promise<StyleSpecification | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(OPENFREEMAP_DARK_URL, { signal: controller.signal });
    if (!response.ok) return null;
    const style = brandMapStyle((await response.json()) as StyleSpecification);
    memoryStyle = style;
    void AsyncStorage.setItem(CACHE_KEY, JSON.stringify(style)).catch(() => undefined);
    return style;
  } catch (raw) {
    devWarn('[mapStyle] fetch failed', raw);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function loadMapStyle(): Promise<StyleSpecification | null> {
  if (memoryStyle) return Promise.resolve(memoryStyle);
  inflight ??= (async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        memoryStyle = JSON.parse(cached) as StyleSpecification;
        // Refresh quietly so tile/sprite URL changes upstream are picked up.
        void fetchBrandStyle();
        return memoryStyle;
      }
    } catch {
      // Corrupt cache: fall through to the network.
    }
    return fetchBrandStyle();
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

/**
 * The style to hand a map: `null` while loading (render the map surface's
 * skeleton), then the tinted style — or the plain OpenFreeMap URL if the
 * tinted one could not be produced.
 */
export function useMapStyle(): StyleSpecification | string | null {
  const [style, setStyle] = useState<StyleSpecification | string | null>(memoryStyle);
  useEffect(() => {
    if (memoryStyle) return;
    let active = true;
    void loadMapStyle().then((loaded) => {
      if (active) setStyle(loaded ?? OPENFREEMAP_DARK_URL);
    });
    return () => {
      active = false;
    };
  }, []);
  return style;
}
