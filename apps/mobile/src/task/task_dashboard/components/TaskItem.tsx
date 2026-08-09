import { useState } from 'react';
import { LayoutAnimation, TouchableOpacity } from 'react-native';
import { Task } from '../../schema';
import { HStack } from '@/components/ui/hstack';
import {
  Icon,
  EditIcon,
  TrashIcon,
  GripVerticalIcon,
  CalendarDaysIcon,
  ClockIcon,
} from '@/components/ui/icon';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import useDeleteTask from '@/task/hooks/useDeleteTask';
import { useRouter } from 'expo-router';
import { Toast, ToastTitle, useToast } from '@/components/ui/toast';
import dayjs from 'dayjs';

interface TaskItemProps {
  task: Task;
}

export function TaskItem({ task }: TaskItemProps) {
  const [showOptions, setShowOptions] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const isCompleted = task.subtasks.length > 0 && task.subtasks.every((sub) => sub.is_done);
  const { mutate: DeleteMutate } = useDeleteTask(task.id);
  const toggleOptions = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowOptions(!showOptions);
  };

  return (
    <HStack className="w-full rounded-2xl bg-surface-container-lowest shadow-sm items-center border border-outline-variant">
      <Box className="flex-1 justify-center px-4 py-3">
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.navigate(`/tasks/${task.id}/`)}
        >
          <Text
            className={`text-on-surface text-base font-medium ${showOptions ? '' : 'truncate'}`}
          >
            {task.title}
          </Text>
        </TouchableOpacity>

        <HStack className="mt-1 gap-4">
          <HStack className="items-center gap-1">
            <Icon as={CalendarDaysIcon} size="sm" className="text-on-surface-variant" />
            <Text className="text-xs text-on-surface-variant">
              {dayjs(task.due_at).format('MMM D')}
            </Text>
          </HStack>
          <HStack className="items-center gap-1">
            <Icon as={ClockIcon} size="sm" className="text-on-surface-variant" />
            <Text className="text-xs text-on-surface-variant">
              {dayjs(task.due_at).format('hh:mm A')}
            </Text>
          </HStack>
        </HStack>
      </Box>

      {showOptions && (
        <HStack className="items-center pr-1">
          {!isCompleted && (
            <TouchableOpacity
              accessibilityLabel="Edit task"
              onPress={() => router.navigate(`/tasks/${task.id}/edit`)}
              className="px-4 py-2.5 items-center justify-center bg-primary-container rounded-xl mx-1"
            >
              <Icon as={EditIcon} className="text-[#1E3A8A] w-5 h-5" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            accessibilityLabel="Delete task"
            onPress={() =>
              DeleteMutate(undefined, {
                onSuccess: () => {
                  toast.show({
                    placement: 'top',
                    duration: 3000,
                    render: () => (
                      <Toast action="success" variant="solid">
                        <ToastTitle>Task Deleted Successfully</ToastTitle>
                      </Toast>
                    ),
                  });
                },
              })
            }
            className="px-4 py-2.5 items-center justify-center bg-error-container rounded-xl mx-1"
          >
            <Icon as={TrashIcon} className="text-on-error-container w-5 h-5" />
          </TouchableOpacity>
        </HStack>
      )}

      <TouchableOpacity
        accessibilityLabel="Toggle task actions"
        onPress={toggleOptions}
        className="justify-center items-center px-4"
      >
        <Icon as={GripVerticalIcon} className="w-5 h-5 text-outline" />
      </TouchableOpacity>
    </HStack>
  );
}
