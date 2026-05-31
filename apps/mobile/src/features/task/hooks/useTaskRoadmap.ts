import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  createChatSession,
  createTask,
  getChatSession,
  getTask,
  sendChatMessage,
  taskMutationKeys,
  taskQueryKeys,
} from '../api/taskApi';
import type {
  AutomaticRoadmapInput,
  ChatRoadmapResult,
  GuidedRoadmapInput,
  GuidedRoadmapResult,
  ManualRoadmapInput,
  StatusMessage,
  Task,
} from '../types/task';
import {
  buildCreateTaskInput,
  getErrorMessage,
  isQuestionLike,
  mapBackendTaskToTask,
  toggleLocalSubtask,
} from '../utils/taskUtils';

export function useTaskRoadmap() {
  const queryClient = useQueryClient();
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
      const taskId = response.task_id;
      if (!taskId) {
        throw new Error('Backend did not return a task id.');
      }
      const backendTask = await queryClient.fetchQuery({
        queryKey: taskQueryKeys.task(taskId),
        queryFn: () => getTask(taskId),
      });
      return mapBackendTaskToTask(backendTask);
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
    onSuccess: (result) => {
      if (result.task) {
        setTask(result.task);
        setQuestions([]);
        setAnswers([]);
        setGuidedSessionId(null);
        showSuccess(result.message.content || 'Generated roadmap loaded.');
        return;
      }
      showSuccess(result.message.content || 'Automatic roadmap request sent.');
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
      if (result.task) {
        setTask(result.task);
        setQuestions([]);
        setAnswers([]);
        setGuidedSessionId(null);
        showSuccess(content || 'Generated roadmap loaded.');
        return;
      }
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

  async function loadGeneratedTask(sessionId: string) {
    const session = await queryClient.fetchQuery({
      queryKey: taskQueryKeys.chatSession(sessionId),
      queryFn: () => getChatSession(sessionId),
    });
    const taskId = session.task_id;
    if (!taskId) {
      return null;
    }
    const backendTask = await queryClient.fetchQuery({
      queryKey: taskQueryKeys.task(taskId),
      queryFn: () => getTask(taskId),
    });
    return mapBackendTaskToTask(backendTask);
  }

  async function sendAutomaticMessage(input: AutomaticRoadmapInput): Promise<ChatRoadmapResult> {
    const session = await createChatSession();
    const message = await sendChatMessage({ sessionId: session.session_id, msg: input.description });
    const generatedTask = await loadGeneratedTask(session.session_id);
    return {
      sessionId: session.session_id,
      message,
      task: generatedTask,
    };
  }

  async function sendGuidedMessage(input: GuidedRoadmapInput): Promise<GuidedRoadmapResult> {
    const sessionId = input.sessionId || (await createChatSession()).session_id;
    const msg = [input.description, ...input.answers].filter(Boolean).join('\n');
    const message = await sendChatMessage({ sessionId, msg });
    const generatedTask = await loadGeneratedTask(sessionId);
    return {
      sessionId,
      message,
      task: generatedTask,
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