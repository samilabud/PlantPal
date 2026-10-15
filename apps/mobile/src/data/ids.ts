import { randomUUID } from 'expo-crypto';

/** Ids are made on the phone, so a plant created offline already has its permanent id. */
export const newId = () => randomUUID();
