import { useState } from 'react';

import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';

import { ExitReasonSchema } from '../schemas';

type ExitReasonScreenProps = {
  onSubmit: (reason: string) => void;
  onClose: () => void;
};

export function ExitReasonScreen({ onSubmit, onClose }: ExitReasonScreenProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    const result = ExitReasonSchema.safeParse({ reason });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    setError(null);
    onSubmit(result.data.reason);
  };

  return (
    <Box className="flex-1 items-center justify-center px-6">
      <Text className="text-xl text-on-surface mb-4">Stay in the Flow?</Text>
      <Textarea className="w-full mb-2">
        <TextareaInput
          placeholder="Why do you have to go?"
          value={reason}
          onChangeText={setReason}
        />
      </Textarea>
      {error && <Text className="text-error text-sm mb-2">{error}</Text>}
      <Box className="flex-row gap-4 mt-4">
        <Button variant="outline" onPress={onClose}>
          <ButtonText>Close</ButtonText>
        </Button>
        <Button className="bg-on-surface" onPress={handleSubmit}>
          <ButtonText className="text-white font-semibold">Exit</ButtonText>
        </Button>
      </Box>
    </Box>
  );
}
