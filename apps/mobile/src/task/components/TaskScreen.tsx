import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTaskRoadmap } from '../hooks/useTaskRoadmap';
import type { Mode } from '../types/task';
import { GuidedTaskForm } from './GuidedTaskForm';
import { ManualTaskForm } from './ManualTaskForm';
import { ModeTabs } from './ModeTabs';
import { RoadmapView } from './RoadmapView';
import { StatusMessage } from './StatusMessage';

export function TaskScreen() {
  const [mode, setMode] = useState<Mode>('manual');
  const roadmap = useTaskRoadmap();

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    roadmap.clearStatusMessage();
  }

  return (
    <SafeAreaView className="flex-1 bg-emerald-50">
      <ScrollView contentContainerClassName="gap-4 p-5">
        <View className="gap-2">
          <Text className="text-4xl font-extrabold text-emerald-950">Procradicator</Text>
          <Text className="text-base leading-6 text-slate-600">
            Break an overwhelming assignment into small actionable steps.
          </Text>
        </View>

        <ModeTabs activeMode={mode} onChangeMode={changeMode} />

        <View className="gap-3 rounded-lg bg-white p-4">
          {mode === 'manual' ? (
            <ManualTaskForm
              isSubmitting={roadmap.manualRoadmap.isPending}
              onSubmit={roadmap.submitManualRoadmap}
            />
          ) : null}

          {mode === 'guided' ? (
            <GuidedTaskForm
              answers={roadmap.answers}
              isSubmitting={roadmap.guidedRoadmap.isPending}
              questions={roadmap.questions}
              onAnswerChange={roadmap.updateAnswer}
              onSubmit={roadmap.submitGuidedRoadmap}
            />
          ) : null}

          <StatusMessage message={roadmap.statusMessage} />
        </View>

        <RoadmapView
          isUpdating={false}
          task={roadmap.task}
          onToggleSubtask={roadmap.toggleSubtaskCompletion}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
