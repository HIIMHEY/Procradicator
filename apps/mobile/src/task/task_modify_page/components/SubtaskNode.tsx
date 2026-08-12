import { useEffect, useState } from 'react';
import { Box } from '@/components/ui/box';
import { Pressable } from '@/components/ui/pressable';
import { CheckIcon, CircleIcon, Icon } from '@/components/ui/icon';
import { ModifySubtaskData, ModifyTaskData, TaskModifyMode } from '../../schema';
import { SubtaskInput } from './SubtaskInput';
import { Control, Controller, FieldErrors } from 'react-hook-form';
import { SubtaskCard } from './SubtaskCard';

interface SubtaskNodeProps {
  index: number;
  mode: TaskModifyMode;
  onDelete: () => void;
  onDragTrigger: () => void;
  errors?: FieldErrors<ModifySubtaskData>;
  isLast: boolean;
  isActive: boolean;
  control: Control<ModifyTaskData>;
}

export function SubtaskNode({
  index,
  mode,
  onDelete,
  onDragTrigger,
  errors,
  isLast,
  isActive,
  control,
}: SubtaskNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  useEffect(() => {
    if (errors && Object.keys(errors).length > 0) {
      setIsEditing(true);
    }
  }, [errors]);

  return (
    <Box className={`px-4 my-1 ${isActive ? 'opacity-80 scale-95' : ''}`}>
      <Controller
        control={control}
        name={`subtasks.${index}`}
        render={({ field: { onChange, value } }) =>
          isEditing ? (
            <Box className="w-full items-center">
              <SubtaskInput
                mode={mode}
                value={value}
                onChange={onChange}
                errors={errors}
                onDone={() => setIsEditing(false)}
              />
            </Box>
          ) : (
            <Box className="flex-row">
              <Box className="w-8 items-center">
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: !!value.is_done }}
                  accessibilityLabel={`Toggle subtask ${index + 1} done`}
                  onPress={() => onChange({ ...value, is_done: !value.is_done })}
                >
                  {value.is_done ? (
                    <Box className="h-6 w-6 items-center justify-center rounded-full bg-task-action">
                      <Icon as={CheckIcon} size="sm" className="text-white" />
                    </Box>
                  ) : (
                    <Icon as={CircleIcon} size="xl" className="text-task-action" />
                  )}
                </Pressable>
                {!isLast && <Box className="my-1 w-[2px] flex-1 bg-outline-variant" />}
              </Box>
              <Box className="flex-1 pb-2">
                <SubtaskCard
                  value={value}
                  index={index}
                  onDragTrigger={onDragTrigger}
                  onDelete={onDelete}
                  onEdit={() => setIsEditing(true)}
                />
              </Box>
            </Box>
          )
        }
      />
    </Box>
  );
}
