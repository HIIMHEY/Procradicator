import { useState } from 'react';
import { Pressable } from 'react-native';
import { Box } from '@/components/ui/box';
import { CalendarDaysIcon, Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import dayjs from 'dayjs';
import DateTimePicker from 'react-native-ui-datepicker';

interface TaskDateTimePickerProps {
  value: string; //iso str format
  onChange: (isoString: string) => void;
}

export function TaskDateTimePicker({ value, onChange }: TaskDateTimePickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  const displayString = value ? dayjs(value).format('DD/MM/YYYY HH:mm') : 'Select date & time...';

  return (
    <Box className="w-full relative">
      <Pressable onPress={() => setShowPicker(!showPicker)}>
        <Box className="h-12 flex-row items-center gap-2 border-b border-outline">
          <Icon as={CalendarDaysIcon} size="sm" className="text-outline" />
          <Text
            className={`flex-1 text-sm font-medium ${value ? 'text-on-surface' : 'text-outline'}`}
          >
            {displayString}
          </Text>
        </Box>
      </Pressable>

      {showPicker && (
        <Box className="absolute z-50 top-12 left-0 w-full max-w-sm bg-surface-container-lowest border border-outline-variant rounded-lg p-3 shadow-xl">
          <DateTimePicker
            mode="single"
            date={value ? dayjs(value) : dayjs()}
            timePicker={true}
            onChange={(params) => {
              if (params.date) {
                onChange(dayjs(params.date).toISOString()); //wow i love dayjs
                setShowPicker(false);
              }
            }}
          />
        </Box>
      )}
    </Box>
  );
}
