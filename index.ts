import { registerRootComponent } from 'expo';
// Registers the trip location task at startup: the OS may relaunch the app
// headless to deliver a location update while the barber is on the way.
import './src/barber/trip/tripService';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
