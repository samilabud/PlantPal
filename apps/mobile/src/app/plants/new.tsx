import { router } from 'expo-router';

import { PlantForm } from '@/components/plant-form';
import { mutate } from '@/data/mutations';
import { addPhoto, createPlant } from '@/data/plants';
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
          router.back();
        }}
      />
    </Screen>
  );
}
