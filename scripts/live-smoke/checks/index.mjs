/**
 * The check registry: the order the report prints in, and the titles it prints.
 *
 * Kept in one place because the fleet table's columns, the per-client sections
 * and the board's captions all have to agree about what the eight checks are
 * called — and a check that gets a second spelling silently stops appearing in
 * one of them.
 */
export const CHECK_ORDER = [
  'routes',
  'headers',
  'posture',
  'og',
  'offline',
  'form',
  'customizer',
  'lighthouse',
];

export const CHECK_TITLES = {
  routes: 'routes',
  headers: 'headers',
  posture: 'posture',
  og: 'og:image',
  offline: 'sw',
  form: 'form',
  customizer: 'customizer',
  lighthouse: 'lighthouse',
};
