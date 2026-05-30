import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import type { ManualRoadmapInput } from '../types/task';
import { moveItem, sanitizeSubtasks } from '../utils/taskUtils';
import { SubmitButton } from './SubmitButton';

const DEFAULT_SUBTASKS = ['Draft README', 'Build roadmap screen', 'Test demo flow'];

type ManualTaskFormProps = {
  isSubmitting: boolean;
  onSubmit: (input: ManualRoadmapInput) => void;
};

export function ManualTaskForm({ isSubmitting, onSubmit }: ManualTaskFormProps) {
  const [subtasks, setSubtasks] = useState(DEFAULT_SUBTASKS);
  const [formError, setFormError] = useState('');
  const form = useForm({
    defaultValues: {
      title: 'Finish Milestone 1',
      subtaskInput: '',
    },
    onSubmit: ({ value }) => {
      const cleanTitle = value.title.trim();
      const cleanSubtasks = sanitizeSubtasks(subtasks);
      if (!cleanTitle) {
        setFormError('Enter a task title.');
        return;
      }
      if (cleanSubtasks.length === 0) {
        setFormError('Add at least one subtask.');
        return;
      }
      setFormError('');
      onSubmit({ title: cleanTitle, subtasks: cleanSubtasks });
    },
  });

  function addSubtask(value: string, resetInput: () => void) {
    const clean = value.trim();
    if (!clean) {
      setFormError('Enter a subtask before adding it.');
      return;
    }
    setSubtasks((currentSubtasks) => [...currentSubtasks, clean]);
    setFormError('');
    resetInput();
  }

  return (
    <View className="gap-3">
      <Text className="text-xl font-extrabold text-emerald-950">Create task manually</Text>

      <form.Field name="title">
        {(field) => (
          <View className="gap-2">
            <Text className="font-bold text-slate-800">Task title</Text>
            <TextInput
              className="rounded-lg border border-slate-300 p-3 text-base text-emerald-950"
              onChangeText={field.handleChange}
              placeholder="Example: Finish Milestone 1"
              value={field.state.value}
            />
          </View>
        )}
      </form.Field>

      <form.Field name="subtaskInput">
        {(field) => (
          <View className="gap-2">
            <Text className="font-bold text-slate-800">Subtask</Text>
            <View className="flex-row gap-2">
              <TextInput
                className="flex-1 rounded-lg border border-slate-300 p-3 text-base text-emerald-950"
                onChangeText={field.handleChange}
                onSubmitEditing={() => addSubtask(field.state.value, () => field.handleChange(''))}
                placeholder="Example: Read assignment brief"
                value={field.state.value}
              />
              <Pressable
                className="justify-center rounded-lg bg-emerald-950 px-4"
                onPress={() => addSubtask(field.state.value, () => field.handleChange(''))}
              >
                <Text className="font-extrabold text-white">Add</Text>
              </Pressable>
            </View>
          </View>
        )}
      </form.Field>

      {subtasks.map((subtask, index) => (
        <View
          className="flex-row items-center gap-2 rounded-lg bg-slate-50 p-2.5"
          key={`${subtask}-${index}`}
        >
          <Text className="flex-1 text-slate-800">
            {index + 1}. {subtask}
          </Text>
          <Pressable
            disabled={index === 0}
            onPress={() => setSubtasks((items) => moveItem(items, index, -1))}
          >
            <Text className={`font-bold ${index === 0 ? 'text-slate-400' : 'text-emerald-700'}`}>
              Up
            </Text>
          </Pressable>
          <Pressable
            disabled={index === subtasks.length - 1}
            onPress={() => setSubtasks((items) => moveItem(items, index, 1))}
          >
            <Text
              className={`font-bold ${
                index === subtasks.length - 1 ? 'text-slate-400' : 'text-emerald-700'
              }`}
            >
              Down
            </Text>
          </Pressable>
          <Pressable
            onPress={() =>
              setSubtasks((items) => items.filter((_, itemIndex) => itemIndex !== index))
            }
          >
            <Text className="font-bold text-red-700">Delete</Text>
          </Pressable>
        </View>
      ))}

      {formError ? (
        <Text className="rounded-lg bg-red-50 p-3 text-red-800">{formError}</Text>
      ) : null}

      <SubmitButton
        isLoading={isSubmitting}
        loadingText="Creating..."
        normalText="Create roadmap"
        onPress={() => void form.handleSubmit()}
      />
    </View>
  );
}
