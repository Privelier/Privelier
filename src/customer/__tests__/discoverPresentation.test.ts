import type { BarberDirectoryRow, ServiceRow } from '../../types';
import {
  buildDiscoverPresentation,
  deriveServiceFilters,
  filterDiscoverBarbers,
  groupServicesByBarber,
  selectDailySpotlight,
} from '../discoverPresentation';

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
