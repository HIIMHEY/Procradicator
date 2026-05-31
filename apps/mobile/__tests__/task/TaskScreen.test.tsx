/// <reference types="jest" />

import React from 'react';

import { act, fireEvent, screen } from '@testing-library/react-native';
import Index from '../../src/app/index';
import {
  automaticChatMessage,
  backendTask,
  chatSession,
  chatSessionWithTask,
  chatSessionWithoutTask,
  createTaskResponse,
  guidedDoneMessage,
  guidedQuestionMessage,
  mockResponse,
} from '../../test-utils/taskTestData';
import { renderWithQueryClient } from '../../test-utils/renderWithQueryClient';

const mockFetch = jest.fn();

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

function addSubtask(title: string) {
  const input = screen.getByPlaceholderText('Example: Read assignment brief');
  fireEvent.changeText(input, title);
  fireEvent.press(screen.getByText('Add'));
}

test('TaskScreen renders the task creation screen', () => {
  renderWithQueryClient(<Index />);
  expect(screen.getByText('Procradicator')).toBeTruthy();
  expect(screen.getByText('Manual')).toBeTruthy();
  expect(screen.getByText('Auto')).toBeTruthy();
  expect(screen.getByText('Guided')).toBeTruthy();
  expect(screen.getByText('Create task manually')).toBeTruthy();
});

test('TaskScreen shows loading UI while creating a manual roadmap', async () => {
  let resolveFetch: (response: Response) => void = () => {};
  mockFetch
    .mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    )
    .mockResolvedValueOnce(mockResponse(backendTask));
  renderWithQueryClient(<Index />);
  addSubtask('Open brief');
  fireEvent.press(screen.getByText('Create roadmap'));
  expect(await screen.findByText('Creating...')).toBeTruthy();
  await act(async () => {
    resolveFetch(mockResponse(createTaskResponse));
  });
  expect(await screen.findByText('Manual roadmap created.')).toBeTruthy();
});

test('TaskScreen creates a manual roadmap through the backend schema and loads the saved task', async () => {
  mockFetch
    .mockResolvedValueOnce(mockResponse(createTaskResponse))
    .mockResolvedValueOnce(mockResponse(backendTask));
  renderWithQueryClient(<Index />);
  addSubtask('Open brief');
  addSubtask('Write first draft');
  fireEvent.press(screen.getByText('Create roadmap'));
  expect(await screen.findByText('Roadmap From API')).toBeTruthy();
  expect(screen.getByText('Open brief')).toBeTruthy();
  expect(screen.getByText('Write first draft')).toBeTruthy();
  expect(screen.getByText('0 of 2 complete (0%)')).toBeTruthy();
  expect(mockFetch).toHaveBeenNthCalledWith(
    1,
    expect.stringContaining('/tasks/'),
    expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"depends_on":["subtask-1"]'),
    }),
  );
  expect(mockFetch).toHaveBeenNthCalledWith(
    2,
    expect.stringContaining('/tasks/task-1'),
    expect.objectContaining({ method: 'GET' }),
  );
});

test('TaskScreen toggles a subtask locally and updates progress', async () => {
  mockFetch
    .mockResolvedValueOnce(mockResponse(createTaskResponse))
    .mockResolvedValueOnce(mockResponse(backendTask));
  renderWithQueryClient(<Index />);
  addSubtask('Open brief');
  addSubtask('Write first draft');
  fireEvent.press(screen.getByText('Create roadmap'));
  expect(await screen.findByText('Open brief')).toBeTruthy();
  fireEvent.press(screen.getByText('Open brief'));
  expect(await screen.findByText('1 of 2 complete (50%)')).toBeTruthy();
  expect(mockFetch).toHaveBeenCalledTimes(2);
});

test('TaskScreen sends an automatic request and loads the generated backend roadmap', async () => {
  mockFetch
    .mockResolvedValueOnce(mockResponse(chatSession))
    .mockResolvedValueOnce(mockResponse(automaticChatMessage))
    .mockResolvedValueOnce(mockResponse(chatSessionWithTask))
    .mockResolvedValueOnce(mockResponse(backendTask));
  renderWithQueryClient(<Index />);
  fireEvent.press(screen.getByText('Auto'));
  fireEvent.press(screen.getByText('Generate roadmap'));
  expect(await screen.findByText('Roadmap From API')).toBeTruthy();
  expect(screen.getByText('Open brief')).toBeTruthy();
  expect(mockFetch).toHaveBeenNthCalledWith(
    1,
    expect.stringContaining('/chats/sessions'),
    expect.objectContaining({ method: 'POST' }),
  );
  expect(mockFetch).toHaveBeenNthCalledWith(
    2,
    expect.stringContaining('/chats/sessions/session-1/messages'),
    expect.objectContaining({ method: 'POST' }),
  );
  expect(mockFetch).toHaveBeenNthCalledWith(
    3,
    expect.stringContaining('/chats/sessions/session-1'),
    expect.objectContaining({ method: 'GET' }),
  );
  expect(mockFetch).toHaveBeenNthCalledWith(
    4,
    expect.stringContaining('/tasks/task-1'),
    expect.objectContaining({ method: 'GET' }),
  );
});

test('TaskScreen guided mode displays backend follow-up question and then loads generated roadmap', async () => {
  mockFetch
    .mockResolvedValueOnce(mockResponse(chatSession))
    .mockResolvedValueOnce(mockResponse(guidedQuestionMessage))
    .mockResolvedValueOnce(mockResponse(chatSessionWithoutTask))
    .mockResolvedValueOnce(mockResponse(guidedDoneMessage))
    .mockResolvedValueOnce(mockResponse(chatSessionWithTask))
    .mockResolvedValueOnce(mockResponse(backendTask));
  renderWithQueryClient(<Index />);
  fireEvent.press(screen.getByText('Guided'));
  fireEvent.press(screen.getByText('Send description'));
  expect(await screen.findByText('What do you need to submit?')).toBeTruthy();
  fireEvent.changeText(screen.getByPlaceholderText('Type your answer'), 'Milestone 1 README');
  fireEvent.press(screen.getByText('Send answers'));
  expect(await screen.findByText('Roadmap From API')).toBeTruthy();
});

test('TaskScreen shows backend error message when API rejects a request', async () => {
  mockFetch.mockResolvedValueOnce(
    mockResponse(
      {
        detail: 'Backend rejected this request.',
      },
      false,
    ),
  );
  renderWithQueryClient(<Index />);
  addSubtask('Open brief');
  fireEvent.press(screen.getByText('Create roadmap'));
  expect(await screen.findByText('Backend rejected this request.')).toBeTruthy();
});