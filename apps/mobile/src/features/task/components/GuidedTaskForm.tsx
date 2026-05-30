import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import type { GuidedRoadmapInput } from '../types/task';
import { SubmitButton } from './SubmitButton';

type GuidedTaskFormProps = {
  answers: string[];
  isSubmitting: boolean;
  questions: string[];
  onAnswerChange: (index: number, value: string) => void;
  onSubmit: (input: GuidedRoadmapInput) => void;
};

export function GuidedTaskForm({
  answers,
  isSubmitting,
  questions,
  onAnswerChange,
  onSubmit,
}: GuidedTaskFormProps) {
  const [formError, setFormError] = useState('');
  const form = useForm({
    defaultValues: {
      description: 'assignment',
    },
    onSubmit: ({ value }) => {
      const description = value.description.trim();
      if (!description) {
        setFormError('Enter a short task description.');
        return;
      }
      if (questions.length > 0 && answers.some((answer) => !answer.trim())) {
        setFormError('Answer all follow-up questions first.');
        return;
      }
      setFormError('');
      onSubmit({ description, answers });
    },
  });

  return (
    <View className="gap-3">
      <Text className="text-xl font-extrabold text-emerald-950">Semi-automatic guidance</Text>
      <Text className="leading-5 text-slate-500">
        Use this when the task description is vague. The backend can ask follow-up questions first.
      </Text>

      <form.Field name="description">
        {(field) => (
          <View className="gap-2">
            <Text className="font-bold text-slate-800">Short description</Text>
            <TextInput
              className="min-h-28 rounded-lg border border-slate-300 p-3 text-base text-emerald-950"
              multiline
              onChangeText={field.handleChange}
              placeholder="Example: assignment"
              textAlignVertical="top"
              value={field.state.value}
            />
          </View>
        )}
      </form.Field>

      {questions.map((question, index) => (
        <View className="gap-2" key={`${question}-${index}`}>
          <Text className="font-bold text-slate-800">{question}</Text>
          <TextInput
            className="rounded-lg border border-slate-300 p-3 text-base text-emerald-950"
            onChangeText={(value) => onAnswerChange(index, value)}
            placeholder="Type your answer"
            value={answers[index] || ''}
          />
        </View>
      ))}

      {formError ? (
        <Text className="rounded-lg bg-red-50 p-3 text-red-800">{formError}</Text>
      ) : null}

      <SubmitButton
        isLoading={isSubmitting}
        loadingText="Thinking..."
        normalText={questions.length > 0 ? 'Create roadmap' : 'Get follow-up questions'}
        onPress={() => void form.handleSubmit()}
      />
    </View>
  );
}
