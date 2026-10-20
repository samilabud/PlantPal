import { router, useLocalSearchParams } from 'expo-router';

import { PlantForm } from '@/components/plant-form';
import { useLiveQuery } from '@/data/live';
import { mutate } from '@/data/mutations';
import { getPlant, updatePlant } from '@/data/plants';
import { useT } from '@/i18n';
import { Screen, Text } from '@/ui';

export default function EditPlantScreen() {
  const t = useT();
  const { id, suggestedName, suggestedInterval } = useLocalSearchParams<{
    id: string;
    /** From "Use these details" on the detail screen (an AI suggestion). */
    suggestedName?: string;
    suggestedInterval?: string;
  }>();
  const { data: plant, loading } = useLiveQuery((db) => getPlant(db, id), [id]);

  if (loading) return null;
  if (!plant) return <Text>{t('detail.notFound')}</Text>;
  const interval = Number(suggestedInterval);
  const hasInterval = Number.isInteger(interval) && interval > 0;
  const fromAi = Boolean(suggestedName) || hasInterval;
  const initial = {
    name: suggestedName || plant.name,
    wateringIntervalDays: hasInterval ? interval : plant.wateringIntervalDays,
  };
  return (
    <Screen>
      <PlantForm
        initial={initial}
        initialFromAi={fromAi}
        submitLabel={t('form.saveChanges')}
        onSubmit={async (values) => {
          await mutate((db) => updatePlant(db, id, values));
          router.back();
        }}
      />
    </Screen>
  );
}
