import { router } from 'expo-router';

import { track } from '@/analytics/analytics';
import { PlantForm } from '@/components/plant-form';
import { mutate } from '@/data/mutations';
import { addPhoto, createPlant } from '@/data/plants';
import { softAskForReminders } from '@/notifications/soft-ask';
import { Screen } from '@/ui';

export default function NewPlantScreen() {
  return (
    <Screen>
      <PlantForm
        allowPhoto
        submitLabel="Save plant"
        onSubmit={async ({ name, wateringIntervalDays, photo }) => {
          await mutate(async (db) => {
            const id = await createPlant(db, { name, wateringIntervalDays });
            if (photo) await addPhoto(db, id, photo.photoId, photo.uri);
          });
          track('plant_added', { with_photo: Boolean(photo) });
          router.back();
          softAskForReminders(name);
        }}
      />
    </Screen>
  );
}
