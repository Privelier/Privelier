/**
 * Barber portfolio data layer (Portfolio tab of the UI rebuild).
 *
 * Read-only: image upload/delete is build-order step 17 (needs the private
 * storage story and an image picker — a native module requiring a new dev-
 * client build) and does NOT live here. The max-6 constraint is DB-enforced
 * per barber_id; MAX_PORTFOLIO_IMAGES exists only so the UI can show the
 * "N of 6" counter and hide the add tile at the cap.
 */
import { supabase } from '../../lib/supabase';
import type { PortfolioRow } from '../types';
import { mapPostgrestError } from './errors';
import type { ListOwnPortfolioResult } from './types';

/** Mirror of the DB's hard cap (see CLAUDE.md schema: max 6 per barber). */
export const MAX_PORTFOLIO_IMAGES = 6;

/** The signed-in barber's portfolio images. */
export async function listOwnPortfolio(barberId: string): Promise<ListOwnPortfolioResult> {
  const { data, error } = await supabase
    .from('portfolio')
    .select('*')
    .eq('barber_id', barberId);

  if (error) return mapPostgrestError('listOwnPortfolio', error);
  return { status: 'ok', images: (data as PortfolioRow[]) ?? [] };
}
