import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import type { AutomaticRoadmapInput } from '../types/task';
import { SubmitButton } from './SubmitButton';

type AutomaticTaskFormProps = {
  isSubmitting: boolean;
  onSubmit: (input: AutomaticRoadmapInput) => void;
};

export function AutomaticTaskForm({ isSubmitting, onSubmit }: AutomaticTaskFormProps) {
  const [formError, setFormError] = useState('');
  const form = useForm({
    defaultValues: {
      description:
        'Prepare my Milestone 1 submission by writing documentation, building the proof of concept, and testing the demo.',
    },
    onSubmit: ({ value }) => {
      const description = value.description.trim();
      if (!description) {
        setFormError('Enter a detailed task description.');
        return;
      }
      setFormError('');
      onSubmit({ description });
    },
  });

  return (
    <View className="gap-3">
      <Text className="text-xl font-extrabold text-emerald-950">Automatic task creation</Text>
      <Text className="leading-5 text-slate-500">
        Describe the task clearly. The backend should generate a roadmap.
      </Text>

      <form.Field name="description">
        {(field) => (
          <View className="gap-2">
            <Text className="font-bold text-slate-800">Describe the task clearly</Text>
            <TextInput
              className="min-h-28 rounded-lg border border-slate-300 p-3 text-base text-emerald-950"
              multiline
              onChangeText={field.handleChange}
              placeholder="Example: I need to prepare my Milestone 1 submission..."
              textAlignVertical="top"
              value={field.state.value}
            />
          </View>
        )}
      </form.Field>

      {formError ? (
        <Text className="rounded-lg bg-red-50 p-3 text-red-800">{formError}</Text>
      ) : null}

      <SubmitButton
        isLoading={isSubmitting}
        loadingText="Generating..."
        normalText="Generate roadmap"
        onPress={() => void form.handleSubmit()}
      />
    </View>
  );
}
