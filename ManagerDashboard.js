// Small display helpers.
// Naira amounts are stored as "N210bn" in the database (to keep SQL portable),
// and rendered with the proper ₦ symbol here in the UI.
export function pretty(text) {
  return (text || '').replace('N210bn', '\u20A6210bn');
}
