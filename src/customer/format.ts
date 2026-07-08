/**
 * Display-formatting helpers moved to src/shared/format.ts when the barber
 * side started needing them too; re-exported here so existing customer-side
 * imports (screens, components, tests) keep working unchanged.
 */
export * from '../shared/format';
