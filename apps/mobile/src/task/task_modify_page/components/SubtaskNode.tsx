import { useEffect, useState } from 'react';
import { Box } from '@/components/ui/box';
import { ModifySubtaskData, ModifyTaskData, TaskModifyMode } from '../../schema';
import { SubtaskInput } from './SubtaskInput';
import { Control, Controller, FieldErrors } from 'react-hook-form';
import { SubtaskActions } from './SubtaskActions';
import { ArrowDownIcon, Icon } from '@/components/ui/icon';

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
  index, //yes I spelt it in full this time for clarity
  mode, // just shows text edit or create
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
    <Box className={`px-4 my-1 ${isActive ? 'opacity-80 scale-95' : ''} items-center`}>
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
            <SubtaskActions
              value={value}
              index={index}
              onDragTrigger={onDragTrigger}
              onDelete={onDelete}
              onEdit={() => setIsEditing(true)}
              isLast={isLast}
            />
          )
        }
      />
      {!isLast && <Icon as={ArrowDownIcon} />}
    </Box>
  );
}
