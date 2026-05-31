import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { createChatSession, createTask, sendChatMessage, taskMutationKeys } from '../api/taskApi';
import type {
  AutomaticRoadmapInput,
  GuidedRoadmapInput,
  GuidedRoadmapResult,
  ManualRoadmapInput,
  StatusMessage,
  Task,
} from '../types/task';
import {
  buildCreateTaskInput,
  createLocalTaskFromResponse,
  getErrorMessage,
  isQuestionLike,
  toggleLocalSubtask,
} from '../utils/taskUtils';

export function useTaskRoadmap() {
  const [task, setTask] = useState<Task | null>(null);
  const [guidedSessionId, setGuidedSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const showSuccess = (text: string) => setStatusMessage({ kind: 'success', text });
  const showError = (error: unknown) =>
    setStatusMessage({ kind: 'error', text: getErrorMessage(error) });
  const clearStatusMessage = () => setStatusMessage(null);
  const manualRoadmap = useMutation({
    mutationKey: taskMutationKeys.createTask,
    mutationFn: async (input: ManualRoadmapInput) => {
      const request = buildCreateTaskInput(input);
      const response = await createTask(request);
      return createLocalTaskFromResponse(request, response);
    },
    onMutate: clearStatusMessage,
    onSuccess: (nextTask) => {
      setTask(nextTask);
      setQuestions([]);
      setAnswers([]);
      setGuidedSessionId(null);
      showSuccess('Manual roadmap created.');
    },
    onError: showError,
  });
  const automaticRoadmap = useMutation({
    mutationKey: taskMutationKeys.sendChatMessage,
    mutationFn: sendAutomaticMessage,
    onMutate: clearStatusMessage,
    onSuccess: (message) => {
      showSuccess(message.content || 'Automatic roadmap request sent.');
    },
    onError: showError,
  });
  const guidedRoadmap = useMutation({
    mutationKey: taskMutationKeys.sendChatMessage,
    mutationFn: sendGuidedMessage,
    onMutate: clearStatusMessage,
    onSuccess: (result) => {
      const content = result.message.content.trim();
      setGuidedSessionId(result.sessionId);

      if (isQuestionLike(content)) {
        setQuestions((currentQuestions) => [...currentQuestions, content]);
        setAnswers((currentAnswers) => [...currentAnswers, '']);
        showSuccess('Answer the follow-up question.');
        return;
      }

      setQuestions([]);
      setAnswers([]);
      showSuccess(content || 'Guided roadmap request sent.');
    },
    onError: showError,
  });

  async function sendAutomaticMessage(input: AutomaticRoadmapInput) {
    const session = await createChatSession();
    return sendChatMessage({ sessionId: session.session_id, msg: input.description });
  }

  async function sendGuidedMessage(input: GuidedRoadmapInput): Promise<GuidedRoadmapResult> {
    const sessionId = input.sessionId || (await createChatSession()).session_id;
    const msg = [input.description, ...input.answers].filter(Boolean).join('\n');
    const message = await sendChatMessage({ sessionId, msg });

    return {
      sessionId,
      message,
    };
  }

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

  function submitGuidedRoadmap(input: Omit<GuidedRoadmapInput, 'sessionId'>) {
    guidedRoadmap.mutate({ ...input, sessionId: guidedSessionId });
  }

  function toggleSubtaskCompletion(subtaskId: string) {
    setTask((currentTask) =>
      currentTask ? toggleLocalSubtask(currentTask, subtaskId) : currentTask,
    );
  }

  return {
    answers,
    automaticRoadmap,
    guidedRoadmap,
    manualRoadmap,
    questions,
    statusMessage,
    task,
    clearStatusMessage,
    submitAutomaticRoadmap,
    submitGuidedRoadmap,
    submitManualRoadmap,
    toggleSubtaskCompletion,
    updateAnswer,
  };
}
