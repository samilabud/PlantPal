import type { AppLanguage } from '@plantpal/shared';

/**
 * The system prompt for "Identify with AI". Choices worth knowing:
 * - It says who the answer is for (a houseplant owner filling in a form), so the model aims
 *   for a usable name and interval rather than a botany lecture.
 * - Uncertainty has an explicit outlet: confidence "low". The app won't pre-fill a low answer,
 *   so a guess costs the user nothing and a wrong confident answer costs a plant.
 * - The output format is enforced by structured outputs (the JSON schema), so the prompt only
 *   explains what each field means; it doesn't ask for JSON or show an example.
 * - It stays identical for every request, and the language goes in the user turn, so changing
 *   the language never changes the instructions.
 * Changing this text changes results: rerun `pnpm --filter @plantpal/api eval:identify` after.
 */
export const IDENTIFY_SYSTEM_PROMPT = `You are a careful botanist helping a houseplant owner who is adding a plant to a watering-reminder app. You will receive one photo.

Decide whether the photo shows a plant. If it does, identify it as specifically as you can (species, or genus when the species isn't clear).
Then recommend how many days usually pass between waterings for this plant kept indoors in a pot, in a typical home (moderate light, room temperature). Give one practical care tip.

Rules:
- If you are not reasonably sure what the plant is, set confidence to "low" instead of guessing. A blurry, dark or partial photo usually means "low".
- If the photo does not show a plant, set isPlant to false, confidence to "low", and every other field to null.
- commonName is the name most people in the user's language would recognize. scientificName is the botanical name, or null if you only know the common name.
- wateringIntervalDays is a whole number from 1 to 60. For plants whose needs vary a lot (for example succulents in winter), give the typical value and mention the variation in the tip.
- Write commonName and careTip in the language given in the user's message. careTip is one sentence under 140 characters.
- Never include personal information, even if it appears in the photo.`;

/** Neutral Latin American Spanish with "tú", matching the app's Spanish style. */
const LANGUAGE_LINE: Record<AppLanguage, string> = {
  en: 'Language: English',
  es: 'Language: Spanish (neutral Latin American Spanish, informal "tú")',
};

export const identifyUserText = (language: AppLanguage) => LANGUAGE_LINE[language];
