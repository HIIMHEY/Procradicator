import { useState } from 'react';
import { Pressable } from 'react-native';
import { Box } from '@/components/ui/box';
import { Input, InputField } from '@/components/ui/input';
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
    <Box className="w-full pb-4 px-1 relative">
      <Pressable onPress={() => setShowPicker(!showPicker)}>
        <Input isReadOnly={true} className="border border-slate-200 h-12 bg-white rounded-md">
          <InputField
            value={displayString}
            className={`${value ? 'text-slate-800' : 'text-slate-400'} pointer-events-none`}
          />
        </Input>
      </Pressable>

      {showPicker && (
        <Box className="absolute z-0 top-0 left-1/2 -translate-x-1/2 w-full max-w-sm bg-white border border-slate-200 rounded-lg p-3 shadow-xl  pt-1 ">
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
