/**
 * A barber profile's data: the directory row, then services, portfolio,
 * reviews and nightly stats in parallel. A failure in a secondary read is a
 * tab-local error, never a whole-screen one (the profile already loaded).
 * Also owns the saved-barber heart: null until known, so it never shows a
 * guess, and optimistic with rollback on a failed write.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchBarberStats, type BarberStatsRow } from '../../shared/barberStats';
import { haptics } from '../../shared/haptics';
import type { BarberDirectoryRow, PortfolioRow, ReviewRow, ServiceRow } from '../../types';
import { getBarberProfile, listPortfolioForBarber, listServicesForBarber } from '../discoveryData';
import { listFavoriteBarberIds, setFavorite } from '../personalData';
import { fetchReviewsForBarber } from '../reviewsData';

export function useBarberProfileData(barberId: string) {
  const [barber, setBarber] = useState<BarberDirectoryRow | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [firstNameByReviewId, setFirstNameByReviewId] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  // Nightly Python stats (migration 0050), decorative: absent hides them.
  const [stats, setStats] = useState<BarberStatsRow | null>(null);
  const [favorite, setFavoriteState] = useState<boolean | null>(null);
  const favoriteBusyRef = useRef(false);

  useEffect(() => {
    let active = true;
    void listFavoriteBarberIds().then((result) => {
      if (active && result.status === 'ok') setFavoriteState(result.ids.has(barberId));
    });
    return () => { active = false; };
  }, [barberId]);

  const toggleFavorite = useCallback(async () => {
    if (favorite === null || favoriteBusyRef.current) return;
    favoriteBusyRef.current = true;
    const next = !favorite;
    setFavoriteState(next); // optimistic; reverted below if the write fails
    void haptics.selection();
    const result = await setFavorite(barberId, next);
    favoriteBusyRef.current = false;
    if (result.status !== 'ok') setFavoriteState(!next);
  }, [favorite, barberId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    setServicesError(null);
    setPortfolioError(null);
    setReviewsError(null);

    const profileResult = await getBarberProfile(barberId);
    if (profileResult.status === 'error') {
      setLoading(false);
      setError(profileResult.message);
      return;
    }
    if (profileResult.status === 'not_found') {
      setLoading(false);
      setNotFound(true);
      return;
    }
    setBarber(profileResult.barber);

    const [servicesResult, portfolioResult, reviewsResult, statsById] = await Promise.all([
      listServicesForBarber(barberId),
      listPortfolioForBarber(barberId),
      fetchReviewsForBarber(barberId),
      fetchBarberStats([barberId]),
    ]);
    setLoading(false);
    setStats(statsById.get(barberId) ?? null);
    if (servicesResult.status === 'ok') setServices(servicesResult.services);
    else setServicesError(servicesResult.message);
    if (portfolioResult.status === 'ok') setPortfolio(portfolioResult.images);
    else setPortfolioError(portfolioResult.message);
    if (reviewsResult.status === 'ok') {
      setReviews(reviewsResult.reviews);
      setFirstNameByReviewId(reviewsResult.firstNameByReviewId);
    } else {
      setReviewsError(reviewsResult.message);
    }
  }, [barberId]);

  useEffect(() => {
    let active = true;
    // Deferred via .then() for the react-hooks/set-state-in-effect rule.
    void Promise.resolve().then(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  return {
    barber,
    services,
    portfolio,
    reviews,
    firstNameByReviewId,
    loading,
    notFound,
    error,
    servicesError,
    portfolioError,
    reviewsError,
    stats,
    favorite,
    toggleFavorite,
  };
}
