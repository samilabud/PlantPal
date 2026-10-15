import { router, useLocalSearchParams } from 'expo-router';

import { PlantForm } from '@/components/plant-form';
import { useLiveQuery } from '@/data/live';
import { mutate } from '@/data/mutations';
import { getPlant, updatePlant } from '@/data/plants';
import { Screen, Text } from '@/ui';

export default function EditPlantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: plant, loading } = useLiveQuery((db) => getPlant(db, id), [id]);

  if (loading) return null;
  if (!plant) return <Text>Plant not found</Text>;
  return (
    <Screen>
      <PlantForm
        initial={plant}
        submitLabel="Save changes"
        onSubmit={async (values) => {
          await mutate((db) => updatePlant(db, id, values));
          router.back();
        }}
      />
    </Screen>
  );
}
