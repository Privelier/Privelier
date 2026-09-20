import {
  checkLocationEligibility,
  isNurembergGermany,
  type LocationGateway,
} from '../locationEligibility';

function gateway(overrides: Partial<LocationGateway> = {}): LocationGateway {
  return {
    requestForegroundPermission: async () => 'granted',
    getCurrentPlace: async () => ({
      accuracy: 25,
      place: { city: 'Nürnberg', country: 'Deutschland' },
    }),
    ...overrides,
  };
}

describe('isNurembergGermany', () => {
  it.each(['Nuremberg', 'Nürnberg', 'Nuernberg'])('accepts the supported city spelling: %s', (city) => {
    expect(isNurembergGermany({ city, country: 'Germany' })).toBe(true);
  });

  it('rejects a different German city', () => {
    expect(isNurembergGermany({ city: 'Hamburg', country: 'Germany' })).toBe(false);
  });
});

describe('checkLocationEligibility', () => {
  it('returns only normalized city/country for an eligible current location', async () => {
    await expect(checkLocationEligibility(gateway())).resolves.toEqual({
      status: 'eligible',
      city: 'Nuremberg',
      country: 'Germany',
    });
  });

  it('fails closed when foreground permission is denied', async () => {
    await expect(
      checkLocationEligibility(gateway({ requestForegroundPermission: async () => 'denied' }))
    ).resolves.toEqual({ status: 'permission_denied' });
  });

  it('fails closed for an inaccurate location fix', async () => {
    await expect(
      checkLocationEligibility(gateway({ getCurrentPlace: async () => ({ accuracy: 1_001, place: null }) }))
    ).resolves.toEqual({ status: 'unavailable' });
  });

  it('blocks a current location outside the service area', async () => {
    await expect(
      checkLocationEligibility(
        gateway({
          getCurrentPlace: async () => ({
            accuracy: 25,
            place: { city: 'Hamburg', country: 'Germany' },
          }),
        })
      )
    ).resolves.toEqual({ status: 'outside_service_area' });
  });

  it('fails closed when native location access throws', async () => {
    await expect(
      checkLocationEligibility(gateway({ getCurrentPlace: async () => Promise.reject(new Error('offline')) }))
    ).resolves.toEqual({ status: 'unavailable' });
  });
});
