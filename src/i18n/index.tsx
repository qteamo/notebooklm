import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import en from './en';
import zh from './zh';

// ── Type magic: flatten nested keys into dot-notation paths ──

type Primitive = string | number | boolean | null | undefined;
type NestedObject = { [key: string]: Primitive | NestedObject | NestedArray };
type NestedArray = (Primitive | NestedObject)[];

type Join<K extends string, P extends string> =
  `${K}${'' extends P ? '' : '.'}${P}`;

type Paths<T, P extends string = ''> = T extends Primitive
  ? P
  : T extends (infer U)[]
    ? Paths<U, P>
    : {
        [K in keyof T & string]: Paths<T[K], Join<P, K>> | Join<P, K>;
      }[keyof T & string];

type PathValue<T, P extends string> =
  P extends `${infer K}.${infer Rest}`
    ? K extends keyof T
      ? PathValue<T[K], Rest>
      : never
    : P extends keyof T
      ? T[P]
      : never;

// Flattened type for easier access
type FlatKeys = Paths<typeof en>;
type FlatValue<K extends FlatKeys> = PathValue<typeof en, K>;

// ── Locale type ───────────────────────────────────

export type Locale = 'zh' | 'en';

const messages: Record<Locale, typeof en> = { en, zh };

// Helper: get value at dot-path
function getValue(obj: NestedObject, path: string): string {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return path;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : path;
}

// ── i18n Context ──────────────────────────────────

interface I18nContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  tFeatures: () => Array<{ title: string; desc: string }>;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'zh',
  setLocale: () => {},
  t: (key: string) => key,
  tFeatures: () => [],
});

const STORAGE_KEY = 'notebooklm_locale';

// Detect browser language
function detectLocale(): Locale {
  // Check stored preference first
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'zh') return stored;
  } catch {}

  // Check browser language
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith('zh')) return 'zh';
  }

  return 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const msg = messages[locale];
      let value = getValue(msg as unknown as NestedObject, key);
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          value = value.replace(`{${k}}`, String(v));
        }
      }
      return value;
    },
    [locale],
  );

  const tFeatures = useCallback(() => {
    const msg = messages[locale];
    return msg.home.features;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, tFeatures }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
