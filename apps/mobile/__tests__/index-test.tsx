/// <reference types="jest" />

import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import Index from "../src/app/index";

const mockFetch = jest.fn();

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

function mockResponse(data: unknown, ok = true) {
  return {
    ok,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response;
}

const manualTask = {
  id: "task-1",
  title: "Roadmap From API",
  subtasks: [
    { id: "subtask-1", title: "Open brief", is_done: false },
    { id: "subtask-2", title: "Write first draft", is_done: false },
  ],
  completed_count: 0,
  total_count: 2,
  progress: 0,
};

test("renders the task creation screen", () => {
  render(<Index />);
  expect(screen.getByText("Procradicator")).toBeTruthy();
  expect(screen.getByText("Manual")).toBeTruthy();
  expect(screen.getByText("Auto")).toBeTruthy();
  expect(screen.getByText("Guided")).toBeTruthy();
  expect(screen.getByText("Create task manually")).toBeTruthy();
});

test("lets user add, move, and delete manual subtasks", () => {
  render(<Index />);
  fireEvent.changeText(
    screen.getByPlaceholderText("Example: Read assignment brief"),
    "Submit README"
  );
  fireEvent.press(screen.getByText("Add"));
  expect(screen.getByText("4. Submit README")).toBeTruthy();
  fireEvent.press(screen.getAllByText("Up")[3]);
  expect(screen.getByText("3. Submit README")).toBeTruthy();
  fireEvent.press(screen.getAllByText("Delete")[2]);
  expect(screen.queryByText("3. Submit README")).toBeNull();
});

test("shows validation error when manual title is empty", () => {
  render(<Index />);
  fireEvent.changeText(screen.getByPlaceholderText("Example: Finish Milestone 1"), "");
  fireEvent.press(screen.getByText("Create roadmap"));
  expect(screen.getByText("Enter a task title.")).toBeTruthy();
  expect(mockFetch).not.toHaveBeenCalled();
});

test("shows loading UI while creating a manual roadmap", async () => {
  let resolveFetch: (response: Response) => void = () => {};
  mockFetch.mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    })
  );
  render(<Index />);
  fireEvent.press(screen.getByText("Create roadmap"));
  expect(screen.getByText("Creating...")).toBeTruthy();
  await act(async () => {
    resolveFetch(mockResponse(manualTask));
  });
  expect(await screen.findByText("Manual roadmap created.")).toBeTruthy();
});

test("creates a manual roadmap and displays roadmap nodes", async () => {
  mockFetch.mockResolvedValueOnce(mockResponse(manualTask));
  render(<Index />);
  fireEvent.press(screen.getByText("Create roadmap"));
  expect(await screen.findByText("Roadmap From API")).toBeTruthy();
  expect(screen.getByText("Open brief")).toBeTruthy();
  expect(screen.getByText("Write first draft")).toBeTruthy();
  expect(screen.getByText("0 of 2 complete (0%)")).toBeTruthy();
  expect(mockFetch).toHaveBeenCalledWith(
    expect.stringContaining("/tasks/manual"),
    expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("Finish Milestone 1"),
    })
  );
});

test("toggles a subtask and updates progress", async () => {
  const updatedTask = {
    ...manualTask,
    subtasks: [
      { id: "subtask-1", title: "Open brief", is_done: true },
      { id: "subtask-2", title: "Write first draft", is_done: false },
    ],
    completed_count: 1,
    total_count: 2,
    progress: 50,
  };
  mockFetch
    .mockResolvedValueOnce(mockResponse(manualTask))
    .mockResolvedValueOnce(mockResponse(updatedTask));
  render(<Index />);
  fireEvent.press(screen.getByText("Create roadmap"));
  expect(await screen.findByText("Open brief")).toBeTruthy();
  fireEvent.press(screen.getByText("Open brief"));
  expect(await screen.findByText("1 of 2 complete (50%)")).toBeTruthy();
  expect(mockFetch).toHaveBeenLastCalledWith(
    expect.stringContaining("/tasks/task-1/subtasks/subtask-1/toggle"),
    expect.objectContaining({
      method: "PATCH",
    })
  );
});

test("creates an automatic roadmap from a detailed description", async () => {
  mockFetch.mockResolvedValueOnce(
    mockResponse({
      task: {
        ...manualTask,
        id: "task-auto",
        title: "Automatic Roadmap",
      },
    })
  );
  render(<Index />);
  fireEvent.press(screen.getByText("Auto"));
  fireEvent.press(screen.getByText("Generate roadmap"));
  expect(await screen.findByText("Automatic Roadmap")).toBeTruthy();
  expect(mockFetch).toHaveBeenCalledWith(
    expect.stringContaining("/tasks/automatic"),
    expect.objectContaining({
      method: "POST",
    })
  );
});

test("guided mode asks follow-up questions, then creates a roadmap", async () => {
  mockFetch
    .mockResolvedValueOnce(
      mockResponse({
        status: "needs_clarification",
        questions: [
          "What do you need to submit?",
          "When is it due?",
          "Which part feels hardest?",
        ],
      })
    )
    .mockResolvedValueOnce(
      mockResponse({
        task: {
          ...manualTask,
          id: "task-guided",
          title: "Guided Roadmap",
        },
      })
    );
  render(<Index />);
  fireEvent.press(screen.getByText("Guided"));
  fireEvent.press(screen.getByText("Get follow-up questions"));
  expect(await screen.findByText("What do you need to submit?")).toBeTruthy();
  const answerInputs = screen.getAllByPlaceholderText("Type your answer");
  fireEvent.changeText(answerInputs[0], "Milestone 1 README");
  fireEvent.changeText(answerInputs[1], "Tomorrow");
  fireEvent.changeText(answerInputs[2], "Starting the first section");
  fireEvent.press(screen.getByText("Create roadmap"));
  expect(await screen.findByText("Guided Roadmap")).toBeTruthy();
});

test("shows backend error message when API rejects a request", async () => {
  mockFetch.mockResolvedValueOnce(
    mockResponse(
      {
        error: "Validation error",
        detail: "Backend rejected this request.",
      },
      false
    )
  );
  render(<Index />);
  fireEvent.press(screen.getByText("Create roadmap"));
  expect(await screen.findByText("Backend rejected this request.")).toBeTruthy();
});