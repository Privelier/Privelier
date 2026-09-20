import * as Location from 'expo-location';
import {
  MAX_ACCEPTABLE_ACCURACY_METERS,
  type LocationGateway,
} from './locationEligibility';

/** Native adapter. It deliberately retains a coordinate only long enough to
 * reverse geocode it, and never exposes that coordinate to the app. */
export const nativeLocationGateway: LocationGateway = {
  async requestForegroundPermission() {
    const result = await Location.requestForegroundPermissionsAsync();
    return result.status === 'granted' ? 'granted' : 'denied';
  },

  async getCurrentPlace() {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const accuracy = position.coords.accuracy ?? null;
    if (accuracy === null || !Number.isFinite(accuracy) || accuracy > MAX_ACCEPTABLE_ACCURACY_METERS) {
      return { accuracy, place: null };
    }
    const [place] = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
    return {
      accuracy,
      place: place ? { city: place.city ?? null, country: place.country ?? null } : null,
    };
  },
};
