// Every dictionary, keyed by locale, in ONE place.
//
// The map is eagerly imported rather than dynamically loaded per request. The
// dictionaries are a few kilobytes of strings each and the public pages are
// server-rendered — a dynamic import would buy nothing on the server and would
// introduce a way for a locale to fail to load at request time, which on the
// front door means a blank page in someone's language.
import { en } from './en';
import { ar } from './ar';
import { zh } from './zh';
import { vi } from './vi';
import { ko } from './ko';
import { id } from './id';
import { hi } from './hi';
import { es } from './es';
import { pt } from './pt';
import { fr } from './fr';
import { tr } from './tr';
import { ru } from './ru';

import type { Locale } from '../locales';
import { DEFAULT_LOCALE } from '../locales';
import type { Dictionary } from './en';

export type { Dictionary };

export const DICTIONARIES: Record<Locale, Dictionary> = {
  en, ar, zh, vi, ko, id, hi, es, pt, fr, tr, ru,
};

export const dictionaryFor = (locale: Locale): Dictionary =>
  DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];

/** Replace `{token}` placeholders. Unknown tokens are left as-is, never blanked. */
export const fill = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (m, k) => (k in values ? String(values[k]) : m));

/** English plural rule, applied only where the dictionary supplies both forms. */
export const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);
