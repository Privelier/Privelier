import { supabase } from '../../../lib/supabase';
import {
  answerLook,
  attachLookPhoto,
  attachLookReference,
  fetchBookableService,
  fetchLookDetail,
  fetchLookReference,
  fetchLooksFeed,
  fetchPortfolioFallback,
  fetchBarberLookStats,
  fetchLookForBooking,
  fetchLookStyles,
  mapLooksError,
  matchLook,
  removeReferencePhoto,
  signReferencePhoto,
  uploadReferencePhoto,
  removeLookPhoto,
  resetLookStylesCache,
  saveLookDraft,
  sendLook,
  signLookPhotos,
  submitLookFeedback,
  takeBackLook,
  uploadLookPhoto,
} from '../looksData';
import type { Look } from '../types';

jest.mock('../../shared/locale', () => ({ getAppLanguage: () => 'en' }));
jest.mock('../../shared/devLog', () => ({ devWarn: jest.fn() }));

const mockUpload = jest.fn();
const mockRemove = jest.fn();
const mockSign = jest.fn();
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    rpc: jest.fn(),
    from: jest.fn(),
    storage: {
      from: jest.fn(() => ({
        upload: (...args: unknown[]) => mockUpload(...args),
        remove: (...args: unknown[]) => mockRemove(...args),
        createSignedUrls: (...args: unknown[]) => mockSign(...args),
      })),
    },
  },
}));

const mockRpc = supabase.rpc as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

type Builder = Record<'select' | 'eq' | 'in' | 'limit' | 'order' | 'maybeSingle', jest.Mock> & { then: (resolve: (v: unknown) => void) => void };
function builder(result: unknown): Builder {
  const obj = {} as Builder;
  for (const key of ['select', 'eq', 'in', 'limit', 'order'] as const) obj[key] = jest.fn(() => obj);
  obj.maybeSingle = jest.fn(async () => result);
  obj.then = (resolve) => resolve(result);
  return obj;
}

const LOOK: Look = {
  id: 'look-1', booking_id: 'b-1', barber_id: 'x', customer_id: 'a', service_id: 's', styles: ['skin_fade'],
  status: 'draft', no_face_confirmed: true, submitted_at: '2026-10-27T10:00:00Z', responded_at: null, consented_at: null,
  created_at: '2026-10-27T09:00:00Z',
  look_photos: [
    { id: 'p2', look_id: 'look-1', storage_path: 'x/two.jpg', position: 2 },
    { id: 'p1', look_id: 'look-1', storage_path: 'x/one.jpg', position: 1 },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  resetLookStylesCache();
  global.fetch = jest.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(4) })) as unknown as typeof fetch;
});

describe('mapLooksError', () => {
  it.each([
    ['P0002', 'not_found'],
    ['P0001', 'state_changed'],
    ['22023', 'invalid_input'],
    ['23505', 'already_done'],
    ['42501', 'forbidden'],
    ['PA429', 'rate_limited'],
    ['PA002', 'limit_reached'],
    ['PGRST202', 'unknown'],
  ])('maps %s to %s with calm copy', (code, expected) => {
    const failure = mapLooksError('test', { code, message: 'raw server text' });
    expect(failure.code).toBe(expected);
    expect(failure.message).not.toContain('raw server text');
  });

  it('treats a dropped connection as retryable', () => {
    expect(mapLooksError('test', { message: 'Network request failed' })).toMatchObject({ code: 'network', retryable: true });
  });
});

describe('reads', () => {
  it('loads styles once per session', async () => {
    const query = builder({ data: [{ key: 'skin_fade', label_en: 'Skin fade', label_de: 'Skin Fade', sort_order: 1 }], error: null });
    mockFrom.mockReturnValue(query);
    await fetchLookStyles();
    const second = await fetchLookStyles();
    expect(second).toMatchObject({ status: 'ok', value: [{ key: 'skin_fade' }] });
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(query.eq).toHaveBeenCalledWith('active', true);
  });

  it('returns a booking look with its photos in position order, or null', async () => {
    mockFrom.mockReturnValueOnce(builder({ data: LOOK, error: null }));
    const result = await fetchLookForBooking('b-1');
    expect(result.status === 'ok' && result.value?.look_photos.map((p) => p.id)).toEqual(['p1', 'p2']);
    mockFrom.mockReturnValueOnce(builder({ data: null, error: null }));
    await expect(fetchLookForBooking('b-2')).resolves.toEqual({ status: 'ok', value: null });
  });

  it('reads stats and tolerates a malformed payload', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(fetchBarberLookStats('x')).resolves.toEqual({ status: 'ok', value: [] });
    expect(mockRpc).toHaveBeenCalledWith('barber_look_stats', { p_barber_id: 'x' });
  });

  it('signs photo paths and leaves the map empty on failure', async () => {
    mockSign.mockResolvedValueOnce({ data: [{ path: 'x/one.jpg', signedUrl: 'https://signed/one' }], error: null });
    const urls = await signLookPhotos(['x/one.jpg']);
    expect(urls.get('x/one.jpg')).toBe('https://signed/one');
    expect(mockSign).toHaveBeenCalledWith(['x/one.jpg'], 600);
    mockSign.mockResolvedValueOnce({ data: null, error: { message: 'denied' } });
    await expect(signLookPhotos(['x/one.jpg'])).resolves.toEqual(new Map());
    await expect(signLookPhotos([])).resolves.toEqual(new Map());
  });
});

describe('barber writes', () => {
  it('saves a draft through the server function', async () => {
    mockRpc.mockResolvedValueOnce({ data: { ...LOOK, look_photos: undefined }, error: null });
    const result = await saveLookDraft({ bookingId: 'b-1', styles: ['skin_fade'], noFace: true });
    expect(mockRpc).toHaveBeenCalledWith('create_look_draft', { p_booking_id: 'b-1', p_styles: ['skin_fade'], p_no_face: true });
    expect(result).toMatchObject({ status: 'ok', value: { id: 'look-1', look_photos: [] } });
  });

  it('uploads a re-encoded JPEG into the barber folder under a fresh name', async () => {
    mockUpload.mockResolvedValueOnce({ error: null });
    const result = await uploadLookPhoto('x', 'file:///picked.heic');
    expect(result.status).toBe('ok');
    const [path, , options] = mockUpload.mock.calls[0];
    expect(path).toMatch(/^x\/look-\d+-[0-9a-f]{24}\.jpg$/);
    expect(options).toEqual({ contentType: 'image/jpeg' });
  });

  it('never attaches when the upload failed', async () => {
    mockUpload.mockResolvedValueOnce({ error: { message: 'Payload too large' } });
    await expect(uploadLookPhoto('x', 'file:///big.jpg')).resolves.toMatchObject({ status: 'error' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('maps the three-photo cap', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'PA002', message: 'Limit reached for look_photos' } });
    await expect(attachLookPhoto('look-1', 'x/four.jpg')).resolves.toMatchObject({ status: 'error', code: 'limit_reached' });
  });

  it('removes the row first, then the file', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    mockRemove.mockResolvedValueOnce({ error: null });
    await removeLookPhoto(LOOK.look_photos[1]);
    expect(mockRpc).toHaveBeenCalledWith('remove_look_photo', { p_photo_id: 'p1' });
    expect(mockRemove).toHaveBeenCalledWith(['x/one.jpg']);
  });

  it('keeps the file when the row could not be removed', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'P0002', message: 'photo not found' } });
    await expect(removeLookPhoto(LOOK.look_photos[1])).resolves.toMatchObject({ code: 'not_found' });
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('explains a look that cannot be sent yet', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'add a photo' } });
    await expect(sendLook('look-1')).resolves.toMatchObject({ status: 'error', code: 'state_changed' });
  });
});

describe('client answers', () => {
  it('publishing keeps the files', async () => {
    mockRpc.mockResolvedValueOnce({ data: { ...LOOK, status: 'published' }, error: null });
    const result = await answerLook(LOOK, { isMine: true, show: true });
    expect(mockRpc).toHaveBeenCalledWith('respond_to_look', { p_look_id: 'look-1', p_is_mine: true, p_show: true });
    expect(result).toMatchObject({ status: 'ok', value: { status: 'published' } });
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('a look that will not be shown has its files removed', async () => {
    mockRpc.mockResolvedValueOnce({ data: { ...LOOK, status: 'declined' }, error: null });
    mockRemove.mockResolvedValueOnce({ error: null });
    await answerLook(LOOK, { isMine: false, show: true });
    expect(mockRpc).toHaveBeenCalledWith('respond_to_look', { p_look_id: 'look-1', p_is_mine: false, p_show: false });
    expect(mockRemove).toHaveBeenCalledWith(['x/two.jpg', 'x/one.jpg']);
  });

  it('taking a look back removes its files', async () => {
    mockRpc.mockResolvedValueOnce({ data: { ...LOOK, status: 'withdrawn' }, error: null });
    mockRemove.mockResolvedValueOnce({ error: null });
    await takeBackLook(LOOK, 'withdraw');
    expect(mockRpc).toHaveBeenCalledWith('withdraw_look', { p_look_id: 'look-1', p_mode: 'withdraw' });
    expect(mockRemove).toHaveBeenCalled();
  });

  it('a second verdict for the same booking reads as already answered', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'duplicate key' } });
    await expect(submitLookFeedback({ bookingId: 'b-1', style: 'skin_fade', verdict: 'exact' })).resolves.toMatchObject({
      status: 'error', code: 'already_done', message: 'You have already answered this.',
    });
  });
});

describe('feed and references (S3)', () => {
  it('pages the feed by style and keeps the client out of the request', async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ look_id: 'l1' }], error: null });
    await expect(fetchLooksFeed({ style: 'taper' })).resolves.toEqual({ status: 'ok', value: [{ look_id: 'l1' }] });
    expect(mockRpc).toHaveBeenCalledWith('looks_feed', { p_style: 'taper', p_before: null, p_limit: 12 });
  });

  it('reads one look for the detail, or null when it is gone', async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ look_id: 'l1' }], error: null });
    await expect(fetchLookDetail('l1')).resolves.toEqual({ status: 'ok', value: { look_id: 'l1' } });
    expect(mockRpc).toHaveBeenCalledWith('looks_feed', { p_look_id: 'l1', p_limit: 1 });
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    await expect(fetchLookDetail('l2')).resolves.toEqual({ status: 'ok', value: null });
  });

  it('attaches a reference and maps a missing booking', async () => {
    mockRpc.mockResolvedValueOnce({ data: {}, error: null });
    await expect(attachLookReference({ bookingId: 'b', lookId: 'l', style: 'taper' })).resolves.toEqual({ status: 'ok', value: null });
    expect(mockRpc).toHaveBeenCalledWith('attach_look_reference', { p_booking_id: 'b', p_look_id: 'l', p_style: 'taper' });
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'P0002', message: 'pending booking not found' } });
    await expect(attachLookReference({ bookingId: 'b', lookId: 'l', style: 'taper' })).resolves.toMatchObject({ code: 'not_found' });
  });

  it('reads a booking reference', async () => {
    mockFrom.mockReturnValueOnce(builder({ data: { booking_id: 'b', look_id: 'l', style: 'taper' }, error: null }));
    await expect(fetchLookReference('b')).resolves.toEqual({ status: 'ok', value: { booking_id: 'b', look_id: 'l', style: 'taper' } });
  });

  it('fills a thin feed from directory portfolios, never for an empty directory', async () => {
    await expect(fetchPortfolioFallback([])).resolves.toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
    const query = builder({ data: [{ id: 'p', barber_id: 'x', image_url: 'x/a.jpg' }, { id: 'q', barber_id: null, image_url: 'y' }], error: null });
    mockFrom.mockReturnValueOnce(query);
    await expect(fetchPortfolioFallback(['x'])).resolves.toEqual([{ id: 'p', barber_id: 'x', image_url: 'x/a.jpg' }]);
    expect(query.limit).toHaveBeenCalledWith(6);
  });

  it('reads the look service, or null when the barber removed it', async () => {
    mockFrom.mockReturnValueOnce(builder({ data: null, error: null }));
    await expect(fetchBookableService('s')).resolves.toBeNull();
  });
});

describe('look search (S4)', () => {
  it('searches one window and returns the matches', async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ barber_id: 'x', first_free_time: '18:30:00' }], error: null });
    const result = await matchLook({ style: 'taper', date: '2026-10-30', from: '18:00:00', to: '21:00:00' });
    expect(mockRpc).toHaveBeenCalledWith('match_look', { p_style: 'taper', p_date: '2026-10-30', p_from: '18:00:00', p_to: '21:00:00' });
    expect(result).toEqual({ status: 'ok', value: [{ barber_id: 'x', first_free_time: '18:30:00' }] });
  });

  it('uploads a reference photo into the client folder only when signed in', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({ data: { session: null } });
    await expect(uploadReferencePhoto('file:///me.jpg')).resolves.toMatchObject({ code: 'forbidden' });
    expect(mockUpload).not.toHaveBeenCalled();

    (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({ data: { session: { user: { id: 'me' } } } });
    mockUpload.mockResolvedValueOnce({ error: null });
    const result = await uploadReferencePhoto('file:///me.jpg');
    expect(result.status === 'ok' && result.value).toMatch(/^me\/ref-\d+-[0-9a-f]{24}\.jpg$/);
    expect(supabase.storage.from).toHaveBeenLastCalledWith('look-references');
  });

  it('signs a reference photo from its own bucket, null when signing fails', async () => {
    mockSign.mockResolvedValueOnce({ data: [{ path: 'me/ref.jpg', signedUrl: 'https://signed/ref' }], error: null });
    await expect(signReferencePhoto('me/ref.jpg')).resolves.toBe('https://signed/ref');
    expect(supabase.storage.from).toHaveBeenLastCalledWith('look-references');
    mockSign.mockResolvedValueOnce({ data: null, error: { message: 'denied' } });
    await expect(signReferencePhoto('me/ref.jpg')).resolves.toBeNull();
  });

  it('removes a reference photo the client took back', async () => {
    mockRemove.mockResolvedValueOnce({ error: null });
    await removeReferencePhoto('me/ref.jpg');
    expect(mockRemove).toHaveBeenCalledWith(['me/ref.jpg']);
  });

  it('sends the photo path only when there is one, so 0065 still matches', async () => {
    mockRpc.mockResolvedValue({ data: {}, error: null });
    await attachLookReference({ bookingId: 'b', lookId: null, style: 'taper', photoPath: 'me/ref.jpg' });
    expect(mockRpc).toHaveBeenLastCalledWith('attach_look_reference', { p_booking_id: 'b', p_look_id: null, p_style: 'taper', p_photo_path: 'me/ref.jpg' });
    await attachLookReference({ bookingId: 'b', lookId: 'l', style: 'taper' });
    expect(mockRpc).toHaveBeenLastCalledWith('attach_look_reference', { p_booking_id: 'b', p_look_id: 'l', p_style: 'taper' });
  });
});
