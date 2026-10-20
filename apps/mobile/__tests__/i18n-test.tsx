import { act, fireEvent, render, screen } from '@testing-library/react-native';
import Storage from 'expo-sqlite/kv-store';

import { LanguageCard } from '@/components/language-card';
import { LanguageToggle } from '@/components/language-toggle';
import { SyncBadge } from '@/components/sync-badge';
import { describeStatus } from '@/data/watering';
import i18n, {
  currentLanguage,
  formatDate,
  setLanguagePreference,
  useLanguagePreference,
} from '@/i18n';
import en from '@/i18n/en.json';
import es from '@/i18n/es.json';
import { planReminders } from '@/notifications/plan';

jest.mock('@/sync/sync-manager', () => ({
  requestSync: jest.fn(),
  useSyncStore: () => ({ status: 'idle', pending: 0 }),
}));

type Tree = { [key: string]: string | Tree };

/** Every leaf as "a.b.c" -> text. */
function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}
const variables = (text: string) => [...text.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort();

afterEach(() => act(() => setLanguagePreference('en')));

describe('translation files (guardrail)', () => {
  const english = flatten(en);
  const spanish = flatten(es);

  it('have exactly the same keys', () => {
    const missingInSpanish = [...english.keys()].filter((k) => !spanish.has(k));
    const missingInEnglish = [...spanish.keys()].filter((k) => !english.has(k));
    expect({ missingInSpanish, missingInEnglish }).toEqual({
      missingInSpanish: [],
      missingInEnglish: [],
    });
  });

  it('use the same {{variables}} in both languages, and no empty texts', () => {
    for (const [key, text] of english) {
      expect([key, variables(spanish.get(key)!)]).toEqual([key, variables(text)]);
      expect([key, text.trim().length > 0]).toEqual([key, true]);
      expect([key, spanish.get(key)!.trim().length > 0]).toEqual([key, true]);
    }
  });

  it('give every plural both forms', () => {
    for (const key of english.keys()) {
      if (key.endsWith('_one')) expect(english.has(key.replace(/_one$/, '_other'))).toBe(true);
    }
  });
});

describe('switching language', () => {
  it('takes effect immediately on screen, without restarting', async () => {
    await render(<SyncBadge />);
    expect(screen.getByText('Synced')).toBeOnTheScreen();
    await act(() => setLanguagePreference('es'));
    expect(screen.getByText('Sincronizado')).toBeOnTheScreen();
  });

  it('is remembered on the device, and "system" follows the phone', () => {
    setLanguagePreference('es');
    expect(Storage.getItemSync('languagePreference')).toBe('es');
    expect(currentLanguage()).toBe('es');
    setLanguagePreference('system'); // jest-expo's mocked phone language is English
    expect(Storage.getItemSync('languagePreference')).toBe('system');
    expect(currentLanguage()).toBe('en');
  });

  it('exposes the choice to the Settings row', async () => {
    let seen = '';
    function Probe() {
      seen = useLanguagePreference();
      return null;
    }
    await render(<Probe />);
    await act(() => setLanguagePreference('es'));
    expect(seen).toBe('es');
  });
});

describe('plurals, dates and texts outside screens', () => {
  it('pluralizes the watering status in both languages', () => {
    const overdue = (days: number) => describeStatus({ state: 'overdue', dueAt: new Date(), days });
    expect([overdue(1), overdue(3)]).toEqual(['Overdue by 1 day', 'Overdue by 3 days']);
    setLanguagePreference('es');
    expect([overdue(1), overdue(3)]).toEqual(['Atrasada 1 día', 'Atrasada 3 días']);
    expect(describeStatus({ state: 'ok', dueAt: new Date(), days: 1 })).toBe('Riégala mañana');
  });

  it('formats dates for the active language', () => {
    const day = new Date(2026, 9, 20);
    expect(formatDate(day)).toMatch(/Oct/);
    setLanguagePreference('es');
    expect(formatDate(day)).toMatch(/oct/);
    expect(i18n.language).toBe('es');
  });

  it('writes local reminders in the active language', () => {
    setLanguagePreference('es');
    const [reminder] = planReminders(
      [
        {
          id: 'p1',
          name: 'Monstera',
          wateringIntervalDays: 7,
          lastWateredAt: new Date(2026, 9, 1).toISOString(),
        } as never,
      ],
      new Date(2026, 9, 20),
    );
    expect(reminder!.title).toBe('🪴 Hora de regar Monstera');
  });
});

describe('language controls', () => {
  it('Settings: choosing Español switches the app', async () => {
    await render(<LanguageCard />);
    await fireEvent.press(screen.getByTestId('settings-language-es'));
    expect(currentLanguage()).toBe('es');
    expect(screen.getByText('Idioma')).toBeOnTheScreen();
    expect(screen.getByTestId('settings-language-es')).toBeChecked();
  });

  it('Sign-in: English | Español switches before signing in', async () => {
    await render(<LanguageToggle />);
    await fireEvent.press(screen.getByTestId('language-es'));
    expect(currentLanguage()).toBe('es');
    expect(screen.getByTestId('language-es')).toBeSelected();
  });
});
