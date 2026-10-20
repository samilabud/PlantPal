import { FREE_PLANT_LIMIT } from '@plantpal/shared';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import GuideScreen, { FEATURES, featureText } from '@/app/guide';
import { setLanguagePreference, t } from '@/i18n';
import { hasSeen, markSeen } from '@/data/first-run';
import { migrate } from '@/db/migrations';
import { usePremium } from '@/purchases/limits';

import { openTestDb } from '../test/sqlite-node';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn() } }));
jest.mock('@/purchases/limits', () => ({ usePremium: jest.fn(() => false) }));
jest.mock('@/db/database', () => ({ getDb: jest.fn(async () => mockDb) }));
let mockDb: unknown = null;

describe('GuideScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists every feature, each readable by screen readers as one item', async () => {
    await render(<GuideScreen />);
    for (const f of FEATURES) {
      const { title, body } = featureText(f.key, t);
      expect(screen.getByLabelText(`${title}. ${body}`)).toBeOnTheScreen();
    }
  });

  it('states the real free-plan limit (same constant the server enforces)', async () => {
    await render(<GuideScreen />);
    expect(
      screen.getByText(new RegExp(`free plan includes ${FREE_PLANT_LIMIT} plants`)),
    ).toBeOnTheScreen();
  });

  it('closes with the main button and offers Premium only to free users', async () => {
    await render(<GuideScreen />);
    await fireEvent.press(screen.getByTestId('guide-done'));
    expect(router.back).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'See Premium' })).toBeOnTheScreen();

    jest.mocked(usePremium).mockReturnValue(true);
    await render(<GuideScreen />);
    expect(screen.queryByRole('button', { name: 'See Premium' })).toBeNull();
  });
});

describe('GuideScreen language', () => {
  afterEach(() => act(() => setLanguagePreference('en')));

  // Jest compiles with the React Compiler, like the app: this fails if a text is memoized.
  it('switches language while it is on screen', async () => {
    await render(<GuideScreen />);
    expect(screen.getByText('Add your plants')).toBeOnTheScreen();
    await act(() => setLanguagePreference('es'));
    expect(screen.getByText('Agrega tus plantas')).toBeOnTheScreen();
    expect(screen.getByText('Empezar a usar PlantPal')).toBeOnTheScreen();
  });
});

describe('first-run flags', () => {
  it('is unseen until marked, per key', async () => {
    const db = openTestDb();
    await migrate(db);
    expect(await hasSeen(db, 'seenGuide')).toBe(false);
    expect(await hasSeen(db, 'seenGuide')).toBe(false); // checking doesn't use it up
    await markSeen(db, 'seenGuide');
    expect(await hasSeen(db, 'seenGuide')).toBe(true);
    expect(await hasSeen(db, 'somethingElse')).toBe(false);
  });

  it('the guide marks itself as seen when it renders', async () => {
    const db = openTestDb();
    await migrate(db);
    mockDb = db;
    await render(<GuideScreen />);
    await waitFor(async () => expect(await hasSeen(db, 'seenGuide')).toBe(true));
  });
});
