import { Pressable, Text, View } from 'react-native';

import { TASK_MODES, type Mode } from '../types/task';

type ModeTabsProps = {
  activeMode: Mode;
  onChangeMode: (mode: Mode) => void;
};

const labels: Record<Mode, string> = {
  manual: 'Manual',
  guided: 'Guided',
};

export function ModeTabs({ activeMode, onChangeMode }: ModeTabsProps) {
  return (
    <View className="flex-row gap-2">
      {TASK_MODES.map((mode) => {
        const isActive = activeMode === mode;
        return (
          <Pressable
            className={`flex-1 rounded-lg border py-2.5 ${
              isActive ? 'border-emerald-950 bg-emerald-950' : 'border-slate-300 bg-transparent'
            }`}
            key={mode}
            onPress={() => onChangeMode(mode)}
          >
            <Text
              className={`text-center font-extrabold ${isActive ? 'text-white' : 'text-slate-600'}`}
            >
              {labels[mode]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
