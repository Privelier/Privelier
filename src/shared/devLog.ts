/**
 * The app's only console access. Development builds print diagnostics;
 * release builds drop the call (__DEV__ is false there), so tokens,
 * addresses, document paths or message text can never reach a device log.
 * Pass error objects or codes, never user content.
 */
export function devWarn(...details: unknown[]): void {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn(...details);
  }
}
