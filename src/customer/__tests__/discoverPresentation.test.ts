import type { BarberDirectoryRow, BookingRow, ServiceRow } from '../../types';
import {
  buildDiscoverPresentation,
  deriveServiceFilters,
  getDiscoverBrandMessages,
  filterDiscoverBarbers,
  groupServicesByBarber,
  selectDailySpotlight,
  formatStartsIn,
  formatUpNextWhen,
  selectRebookBarbers,
  selectUpNext,
} from '../discoverPresentation';

describe('getDiscoverBrandMessages', () => {
  it('returns four German messages for German device locales and English otherwise', () => {
    expect(getDiscoverBrandMessages('de-DE')).toHaveLength(4);
    expect(getDiscoverBrandMessages('de-DE')[0]).toBe('Dein Barber kommt zu dir.');
    expect(getDiscoverBrandMessages('fr-FR')).toHaveLength(4);
    expect(getDiscoverBrandMessages(undefined)[0]).toBe('Your barber comes to you.');
  });
});

function barber(id: string, overrides: Partial<BarberDirectoryRow> = {}): BarberDirectoryRow {
  return {
    id,
    name: `Barber ${id}`,
    city: 'Nuremberg',
    country: 'Germany',
    profile_image: null,
    bio: null,
    rating: 0,
    verified: true,
    display_latitude: null,
    display_longitude: null,
    ...overrides,
  };
}

function service(
  id: string,
  barberId: string,
  name: string,
  overrides: Partial<ServiceRow> = {}
): ServiceRow {
  return {
    id,
    barber_id: barberId,
    name,
    price: 45,
    duration_minutes: 45,
    ...overrides,
  };
}

describe('discover presentation', () => {
  it('groups services and derives the most common real service filters', () => {
    const services = [
      service('s1', 'a', 'Fade'),
      service('s2', 'b', 'fade'),
      service('s3', 'a', 'Beard trim'),
      service('s4', 'c', 'Classic cut'),
      service('s5', 'c', '  '),
    ];

    const grouped = groupServicesByBarber(services);

    expect(grouped.get('a')?.map(({ id }) => id)).toEqual(['s1', 's3']);
    expect(deriveServiceFilters(services, 2)).toEqual(['Fade', 'Beard trim']);
    expect(deriveServiceFilters(null)).toEqual([]);
  });

  it('filters by barber or service only when service enrichment is available', () => {
    const barbers = [
      barber('a', { name: 'Amir' }),
      barber('b', { name: 'Benedikt' }),
    ];
    const servicesByBarber = groupServicesByBarber([
      service('s1', 'a', 'Signature fade'),
      service('s2', 'b', 'Classic cut'),
    ]);

    expect(
      filterDiscoverBarbers({
        barbers,
        servicesByBarber,
        servicesAvailable: true,
        query: 'fade',
        activeService: null,
      }).map(({ id }) => id)
    ).toEqual(['a']);
    expect(
      filterDiscoverBarbers({
        barbers,
        servicesByBarber,
        servicesAvailable: true,
        query: '',
        activeService: 'Classic cut',
      }).map(({ id }) => id)
    ).toEqual(['b']);
    expect(
      filterDiscoverBarbers({
        barbers,
        servicesByBarber,
        servicesAvailable: false,
        query: 'fade',
        activeService: 'Signature fade',
      })
    ).toEqual([]);
    expect(
      filterDiscoverBarbers({
        barbers,
        servicesByBarber,
        servicesAvailable: false,
        query: 'amir',
        activeService: 'Signature fade',
      }).map(({ id }) => id)
    ).toEqual(['a']);
  });

  it('rotates lexically by UTC day among barbers with an image and loaded service', () => {
    const barbers = [
      barber('c', { profile_image: 'https://example.com/c.jpg' }),
      barber('b', { profile_image: 'https://example.com/b.jpg' }),
      barber('a', { profile_image: 'https://example.com/a.jpg' }),
    ];
    const servicesByBarber = groupServicesByBarber([
      service('s1', 'a', 'Fade'),
      service('s2', 'b', 'Cut'),
    ]);

    expect(
      selectDailySpotlight(
        barbers,
        servicesByBarber,
        true,
        new Date('1970-01-01T12:00:00.000Z')
      )?.id
    ).toBe('a');
    expect(
      selectDailySpotlight(
        barbers,
        servicesByBarber,
        true,
        new Date('1970-01-02T12:00:00.000Z')
      )?.id
    ).toBe('b');
  });

  it('falls back to all rows and never duplicates the spotlight in the directory', () => {
    const barbers = [barber('b'), barber('a'), barber('c')];
    const servicesByBarber = new Map<string, ServiceRow[]>();
    const unfiltered = buildDiscoverPresentation({
      barbers,
      servicesByBarber,
      servicesAvailable: false,
      query: '',
      activeService: null,
      now: new Date('1970-01-01T12:00:00.000Z'),
    });

    expect(unfiltered.spotlight?.id).toBe('a');
    expect(unfiltered.directory.map(({ id }) => id)).toEqual(['b', 'c']);
    expect(unfiltered.directory.some(({ id }) => id === unfiltered.spotlight?.id)).toBe(false);

    const filtered = buildDiscoverPresentation({
      barbers,
      servicesByBarber,
      servicesAvailable: false,
      query: 'barber b',
      activeService: null,
      now: new Date('1970-01-01T12:00:00.000Z'),
    });

    expect(filtered.spotlight).toBeNull();
    expect(filtered.directory.map(({ id }) => id)).toEqual(['b']);
    expect(filtered.hasActiveFilter).toBe(true);
  });
});

function row(id: string, date: string, time: string, status: BookingRow['status'], barberId = 'a'): BookingRow {
  return {
    id,
    customer_id: 'c1',
    barber_id: barberId,
    service_id: 's1',
    date,
    time,
    location: 'x',
    price: 40,
    duration_minutes: 45,
    status,
    created_at: '2026-10-01T00:00:00.000Z',
  };
}

describe('up next and book again', () => {
  const now = new Date('2026-10-14T10:00:00');

  it('picks the soonest live booking and counts the rest', () => {
    const result = selectUpNext(
      [
        row('late', '2026-10-20', '10:00:00', 'accepted'),
        row('soon', '2026-10-15', '09:00:00', 'pending'),
        row('past', '2026-10-13', '09:00:00', 'accepted'),
        row('rejected', '2026-10-14', '12:00:00', 'rejected'),
      ],
      new Map([['a', barber('a')]]),
      new Map(),
      now
    );
    expect(result?.booking.id).toBe('soon');
    expect(result?.laterCount).toBe(1);
    expect(result?.barber?.id).toBe('a');
    expect(result?.service).toBeNull();
  });

  it('returns null when nothing is upcoming', () => {
    expect(selectUpNext([row('c', '2026-10-01', '09:00:00', 'completed')], new Map(), new Map(), now)).toBeNull();
  });

  it('lists each completed barber once, newest first, skipping barbers no longer listed', () => {
    const result = selectRebookBarbers(
      [
        row('1', '2026-09-01', '10:00:00', 'completed', 'a'),
        row('2', '2026-10-01', '10:00:00', 'completed', 'b'),
        row('3', '2026-09-20', '10:00:00', 'completed', 'a'),
        row('4', '2026-10-05', '10:00:00', 'completed', 'gone'),
        row('5', '2026-10-06', '10:00:00', 'cancelled', 'c'),
      ],
      new Map([['a', barber('a')], ['b', barber('b')], ['c', barber('c')]])
    );
    expect(result.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('labels today and tomorrow by calendar day, not by hours away', () => {
    const lateNight = new Date('2026-10-14T23:40:00');
    expect(formatUpNextWhen({ date: '2026-10-14', time: '23:55:00' }, lateNight)).toBe('Today · 23:55');
    expect(formatUpNextWhen({ date: '2026-10-15', time: '00:30:00' }, lateNight)).toBe('Tomorrow · 00:30');
    expect(formatUpNextWhen({ date: '2026-10-15', time: '00:30:00' }, lateNight, true)).toBe('Morgen · 00:30');
    expect(formatUpNextWhen({ date: '2026-10-17', time: '14:30:00' }, lateNight)).toBe('Sat 17 Oct · 14:30');
  });

  it('counts down only within a day', () => {
    expect(formatStartsIn({ date: '2026-10-14', time: '10:25:00' }, now)).toBe('In 25 min');
    expect(formatStartsIn({ date: '2026-10-14', time: '12:15:00' }, now)).toBe('In 2 h 15 min');
    expect(formatStartsIn({ date: '2026-10-14', time: '13:00:00' }, now)).toBe('In 3 h');
    expect(formatStartsIn({ date: '2026-10-14', time: '09:59:00' }, now)).toBe('Starting now');
    expect(formatStartsIn({ date: '2026-10-16', time: '10:00:00' }, now)).toBeNull();
    expect(formatStartsIn({ date: 'bad', time: 'x' }, now)).toBeNull();
  });
});
