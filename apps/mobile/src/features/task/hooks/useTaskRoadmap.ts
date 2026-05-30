import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import {
  createAutomaticRoadmap,
  createGuidedRoadmap,
  createManualRoadmap,
  toggleSubtask,
} from '../api/taskApi';
import type {
  AutomaticRoadmapInput,
  GuidedRoadmapInput,
  ManualRoadmapInput,
  StatusMessage,
  Task,
} from '../types/task';
import { getErrorMessage, isClarifyResponse, normalizeTask } from '../utils/taskUtils';

export function useTaskRoadmap() {
  const [task, setTask] = useState<Task | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const showSuccess = (text: string) => setStatusMessage({ kind: 'success', text });
  const showError = (error: unknown) =>
    setStatusMessage({ kind: 'error', text: getErrorMessage(error) });
  const clearStatusMessage = () => setStatusMessage(null);
  const manualRoadmap = useMutation({
    mutationFn: createManualRoadmap,
    onMutate: clearStatusMessage,
    onSuccess: (nextTask) => {
      setTask(nextTask);
      setQuestions([]);
      setAnswers([]);
      showSuccess('Manual roadmap created.');
    },
    onError: showError,
  });
  const automaticRoadmap = useMutation({
    mutationFn: createAutomaticRoadmap,
    onMutate: clearStatusMessage,
    onSuccess: (nextTask) => {
      setTask(nextTask);
      setQuestions([]);
      setAnswers([]);
      showSuccess('Automatic roadmap created.');
    },
    onError: showError,
  });
  const guidedRoadmap = useMutation({
    mutationFn: createGuidedRoadmap,
    onMutate: clearStatusMessage,
    onSuccess: (result) => {
      if (isClarifyResponse(result)) {
        setQuestions(result.questions);
        setAnswers(result.questions.map((_, index) => answers[index] || ''));
        showSuccess('Follow-up questions generated.');
        return;
      }
      setTask(normalizeTask(result));
      setQuestions([]);
      setAnswers([]);
      showSuccess('Guided roadmap created.');
    },
    onError: showError,
  });
  const subtaskToggle = useMutation({
    mutationFn: ({ taskId, subtaskId }: { taskId: string; subtaskId: string }) =>
      toggleSubtask(taskId, subtaskId),
    onMutate: clearStatusMessage,
    onSuccess: (nextTask) => {
      setTask(nextTask);
      showSuccess('Progress updated.');
    },
    onError: showError,
  });

  function updateAnswer(index: number, value: string) {
    setAnswers((currentAnswers) => {
      const nextAnswers = [...currentAnswers];
      nextAnswers[index] = value;
      return nextAnswers;
    });
  }

  function submitManualRoadmap(input: ManualRoadmapInput) {
    manualRoadmap.mutate(input);
  }

  function submitAutomaticRoadmap(input: AutomaticRoadmapInput) {
    automaticRoadmap.mutate(input);
  }

  function submitGuidedRoadmap(input: GuidedRoadmapInput) {
    guidedRoadmap.mutate(input);
  }

  function toggleSubtaskCompletion(subtaskId: string) {
    if (!task) {
      return;
    }

    subtaskToggle.mutate({ taskId: task.id, subtaskId });
  }

  return {
    answers,
    automaticRoadmap,
    guidedRoadmap,
    manualRoadmap,
    questions,
    statusMessage,
    subtaskToggle,
    task,
    clearStatusMessage,
    submitAutomaticRoadmap,
    submitGuidedRoadmap,
    submitManualRoadmap,
    toggleSubtaskCompletion,
    updateAnswer,
  };
}
