import type { DimensionValue } from 'react-native';
import { Pressable, Text, View } from 'react-native';

import type { Task } from '../types/task';

type RoadmapViewProps = {
  isUpdating: boolean;
  task: Task | null;
  onToggleSubtask: (subtaskId: string) => void;
};

export function RoadmapView({ isUpdating, task, onToggleSubtask }: RoadmapViewProps) {
  if (!task) {
    return (
      <View className="gap-3 rounded-lg bg-white p-4">
        <Text className="text-xl font-extrabold text-emerald-950">No roadmap yet</Text>
        <Text className="leading-5 text-slate-500">
          Create a manual or guided roadmap to see progress nodes here.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-3 rounded-lg bg-white p-4">
      <Text className="text-xl font-extrabold text-emerald-950">{task.title}</Text>

      <View className="h-3 overflow-hidden rounded-full bg-emerald-100">
        <View
          className="h-full bg-emerald-700"
          style={{ width: `${task.progress}%` as DimensionValue }}
        />
      </View>

      <Text className="font-bold text-slate-600">
        {task.completed_count} of {task.total_count} complete ({task.progress}%)
      </Text>

      {task.subtasks.map((subtask, index) => (
        <Pressable
          className={`flex-row items-center gap-3 rounded-lg p-3 ${
            subtask.is_done ? 'bg-emerald-50' : 'bg-slate-50'
          } ${isUpdating ? 'opacity-70' : ''}`}
          disabled={isUpdating}
          key={subtask.id}
          onPress={() => onToggleSubtask(subtask.id)}
        >
          <View
            className={`h-9 w-9 items-center justify-center rounded-full border-2 border-emerald-700 ${
              subtask.is_done ? 'bg-emerald-700' : 'bg-transparent'
            }`}
          >
            <Text
              className={`font-extrabold ${subtask.is_done ? 'text-white' : 'text-emerald-700'}`}
            >
              {index + 1}
            </Text>
          </View>

          <View className="flex-1">
            <Text
              className={`text-base font-extrabold text-emerald-950 ${
                subtask.is_done ? 'line-through' : ''
              }`}
            >
              {subtask.title}
            </Text>
            <Text className="mt-0.5 text-slate-500">
              {subtask.is_done ? 'Completed' : 'Tap to mark complete'}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
