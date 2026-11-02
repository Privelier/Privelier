/**
 * Book a look straight into the address step of the normal booking flow
 * (Looks S4/S5): the time is already chosen (a search match or a wish
 * offer), so the date and time step is skipped. When the barber removed the
 * service, the profile opens instead.
 */
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ServiceRow } from '../types';
import type { CustomerStackParamList, LookReferenceParam } from './CustomerNavigator';

export function openLookBooking(
  navigation: Pick<NativeStackNavigationProp<CustomerStackParamList>, 'navigate'>,
  input: {
    barberId: string;
    barberName: string | null;
    barberImage: string | null;
    service: ServiceRow | null;
    date: string;
    time: string;
    lookReference: LookReferenceParam;
  },
): void {
  if (!input.service) {
    navigation.navigate('BarberProfile', { barberId: input.barberId });
    return;
  }
  navigation.navigate('BookingLocation', {
    barberId: input.barberId,
    barberName: input.barberName ?? '',
    barberImage: input.barberImage,
    service: input.service,
    date: input.date,
    time: input.time,
    lookReference: input.lookReference,
  });
}
