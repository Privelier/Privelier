/**
 * Frosted background for every bottom sheet (Wave: glass). Live blur on
 * iOS, where a sheet is a single pinned surface; translucent glass on
 * Android; solid under Reduce Transparency. Used as @gorhom/bottom-sheet's
 * `backgroundComponent`.
 */
import { StyleSheet } from 'react-native';
import type { BottomSheetBackgroundProps } from '@gorhom/bottom-sheet';
import { GlassSurface } from './GlassSurface';

export function SheetGlassBackground({ style }: BottomSheetBackgroundProps) {
  return <GlassSurface variant="floating" style={[style, styles.sheet]} />;
}

const styles = StyleSheet.create({
  sheet: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
});
