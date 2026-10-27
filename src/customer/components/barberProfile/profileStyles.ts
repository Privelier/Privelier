import { StyleSheet } from 'react-native';
import { OVER_IMAGE_BG, OVER_IMAGE_ICON } from '../../../shared/components/ScreenBackHeader';

// Text over the hero image sits on a flat dark scrim, so its colour is fixed
// regardless of theme. HERO_TEXT/HERO_SCRIM are the shared ScreenBackHeader
// over-image constants (that file explains why they are the one source).
export const HERO_TEXT = OVER_IMAGE_ICON;
export const HERO_TEXT_DIM = 'rgba(245,241,232,0.72)';
export const HERO_SCRIM = OVER_IMAGE_BG;
/** Reference height for the pull-down stretch (the hero's min height). */
export const HERO_PARALLAX_HEIGHT = 340;

export const profileStyles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  distribution: { paddingVertical: 16, gap: 6 },
  distributionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  distributionLabel: { width: 12, fontSize: 12, textAlign: 'right' },
  distributionTrack: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  distributionFill: { height: 4, borderRadius: 2 },
  distributionCount: { width: 24, fontSize: 12, textAlign: 'right' },

  bookingDock: { borderRadius: 0, paddingHorizontal: 24, paddingTop: 16, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  dockPrice: { fontSize: 17, flexGrow: 1 },
  dockButton: { minHeight: 48, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
  plainHeader: { paddingHorizontal: 24, paddingTop: 12 },
  profileSkeleton: { paddingBottom: 32 },
  skeletonHero: { height: 320, width: '100%', borderRadius: 0 },
  skeletonName: { width: '65%', height: 29, marginHorizontal: 24, marginTop: 24 },
  skeletonMeta: { width: '45%', height: 13, marginHorizontal: 24, marginTop: 12 },
  skeletonBio: { width: '82%', height: 48, marginHorizontal: 24, marginTop: 32 },
  skeletonTabs: { flexDirection: 'row', gap: 16, paddingHorizontal: 24, marginTop: 30 },
  skeletonTab: { flex: 1, height: 18 },
  skeletonService: { marginHorizontal: 24, marginTop: 24, gap: 10 },
  skeletonServiceName: { width: '58%', height: 18 },
  skeletonServiceMeta: { width: '38%', height: 12 },
  notice: { borderWidth: 0.5, borderRadius: 8, padding: 12, marginTop: 24, marginHorizontal: 24 },
  noticeText: { fontSize: 14 },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 48, paddingHorizontal: 24 },

  hero: { minHeight: 340, overflow: 'hidden' },
  heroImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroImageFill: { width: '100%', height: '100%' },
  heroFallback: { alignItems: 'center', paddingBottom: 28 },
  monogramFrame: { padding: 10, borderRadius: 60, borderWidth: 0.5 },
  heroTitleBlock: { marginTop: 'auto', paddingHorizontal: 24, paddingVertical: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroName: { fontSize: 28, color: HERO_TEXT, flexShrink: 1 },
  heroMetaRow: { flexWrap: 'wrap', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  heroMeta: { fontSize: 12, color: HERO_TEXT_DIM },
  heroRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  backWrap: { position: 'absolute', left: 24 },
  favoriteWrap: { position: 'absolute', right: 24, flexDirection: 'row', gap: 12 },
  favoriteDisc: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  bioBlock: { paddingHorizontal: 24, paddingVertical: 24 },
  badgeRow: { paddingHorizontal: 24, paddingTop: 16, marginBottom: -8 },
  popularWrap: { paddingHorizontal: 24, paddingBottom: 24 },
  popularCard: { padding: 18, gap: 12 },
  popularTitle: { fontSize: 18, lineHeight: 24 },
  bio: { fontSize: 14, lineHeight: 22 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  chip: { borderWidth: 0.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  chipText: { fontSize: 12 },

  tabStrip: { flexDirection: 'row', gap: 24, paddingHorizontal: 24, borderBottomWidth: 0.5 },
  tabButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingBottom: 12,
    marginBottom: -0.5,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  tabLabel: { fontSize: 14 },
  tabContent: { paddingHorizontal: 24, paddingVertical: 8 },
  stateText: { fontSize: 13, paddingVertical: 16 },

  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 },
  serviceInfo: { flex: 1, minWidth: 0 },
  serviceName: { fontSize: 18 },
  serviceMeta: { fontSize: 12, marginTop: 6 },
  bookButton: { borderRadius: 8, paddingHorizontal: 16, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  bookButtonText: { fontSize: 14 },

  // lineHeight 44 trims Playfair's leading slack so the big number optically
  // centres against the 16px stars + count in the summary row.
  reviewsRating: { fontSize: 40, lineHeight: 44 },
  reviewsRatingEmpty: { marginTop: 8 },
  reviewsEmptyStars: { marginTop: 10, marginBottom: 4 },
  reviewsSummary: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingBottom: 20, borderBottomWidth: 0.5 },
  reviewsSummaryMeta: { gap: 6 },
  reviewsCount: { fontSize: 12 },
  reviewRow: { paddingVertical: 16 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  reviewName: { fontSize: 14, flex: 1, minWidth: 0 },
  reviewVerified: { fontSize: 12, marginTop: 2 },
  reviewStars: { marginTop: 10 },
  reviewDate: { fontSize: 12 },
  reviewReport: { minWidth: 32, minHeight: 32, alignItems: 'flex-end', justifyContent: 'center', marginLeft: 4 },
  reviewComment: { fontSize: 14, lineHeight: 22, marginTop: 10 },

  portfolioGridSpacing: { paddingVertical: 16 },
  portfolioEmpty: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  portfolioEmptyText: { fontSize: 13 },
});
