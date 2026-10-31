/**
 * Studio's data: the barber's profile name, the dashboard view (profile,
 * analytics and setup readiness, each able to fail on its own) and the
 * nightly stats. Reloaded on every focus; a retry shows its own spinner
 * instead of the first-load skeleton.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { fetchOwnProfile } from '../../auth/authService';
import { fetchBarberStats, type BarberStatsRow } from '../../shared/barberStats';
import { fetchDashboardView } from '../dashboardData';
import { syncOwnTimeZone } from '../profileData';
import type { DashboardView } from '../types';

export function useStudioData(de: boolean) {
  const [name, setName] = useState<string | null>(null);
  const [view, setView] = useState<DashboardView | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<BarberStatsRow | null>(null);

  const load = useCallback(async () => {
    try {
      const profileResult = await fetchOwnProfile();
      if (profileResult.status === 'error' || !profileResult.profile) {
        setError(profileResult.status === 'error' ? profileResult.message : de ? 'Dein Profil konnte nicht geladen werden.' : 'Could not load your profile.');
        setView(null);
        return;
      }
      const [nextView, statsById] = await Promise.all([
        fetchDashboardView(profileResult.profile.id),
        fetchBarberStats([profileResult.profile.id]),
      ]);
      void syncOwnTimeZone(profileResult.profile.id, profileResult.profile.time_zone);
      setStats(statsById.get(profileResult.profile.id) ?? null);
      setName(profileResult.profile.name);
      setView(nextView);
      setError(null);
    } catch {
      setError(de ? 'Dein Studio konnte nicht geladen werden. Versuch es erneut.' : 'Could not load your studio. Try again.');
      setView(null);
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }, [de]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const retry = useCallback(() => {
    if (retrying) return;
    setRetrying(true);
    void load();
  }, [load, retrying]);

  return { name, view, loading, retrying, error, stats, retry };
}
