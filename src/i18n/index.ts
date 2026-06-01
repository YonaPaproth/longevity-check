import { de } from './de';
import { en } from './en';

export { de, en };
export type { Dict } from './de';

export type Locale = 'de' | 'en';

/** Returns the translation dictionary for the given locale. */
export function t(locale: Locale) {
  return locale === 'en' ? en : de;
}
