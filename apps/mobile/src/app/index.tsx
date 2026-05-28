import { useState } from "react";
import type { DimensionValue } from "react-native";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const API_BASE_URL =
  Platform.OS === "web"
    ? "http://localhost:8000"
    : "http://YOUR_LAPTOP_IP:8000";

type Mode = "manual" | "automatic" | "guided";

type Subtask = {
  id: string;
  title: string;
  is_done: boolean;
};

type Task = {
  id: string;
  title: string;
  subtasks: Subtask[];
  completed_count: number;
  total_count: number;
  progress: number;
};

type ClarifyResponse = {
  status: "needs_clarification";
  questions: string[];
};

export default function Index() {
  const [mode, setMode] = useState<Mode>("manual");
  const [title, setTitle] = useState("Finish Milestone 1");
  const [subtaskInput, setSubtaskInput] = useState("");
  const [subtasks, setSubtasks] = useState<string[]>([
    "Draft README",
    "Build roadmap screen",
    "Test demo flow",
  ]);
  const [description, setDescription] = useState(
    "Prepare my Milestone 1 submission by writing documentation, building the proof of concept, and testing the demo.",
  );
  const [guidedDescription, setGuidedDescription] = useState("assignment");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [task, setTask] = useState<Task | null>(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  function showError(text: string) {
    setIsError(true);
    setMessage(text);
  }

  function showSuccess(text: string) {
    setIsError(false);
    setMessage(text);
  }

  function clearMessage() {
    setIsError(false);
    setMessage("");
  }

  function addSubtask() {
    const clean = subtaskInput.trim();
    if (!clean) {
      showError("Enter a subtask before adding it.");
      return;
    }
    setSubtasks([...subtasks, clean]);
    setSubtaskInput("");
    clearMessage();
  }

  function deleteSubtask(indexToDelete: number) {
    setSubtasks(subtasks.filter((_, index) => index !== indexToDelete));
  }

  function moveSubtask(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= subtasks.length) {
      return;
    }
    const reordered = [...subtasks];
    const current = reordered[index];
    reordered[index] = reordered[nextIndex];
    reordered[nextIndex] = current;
    setSubtasks(reordered);
  }

  async function createManualTask() {
    const cleanTitle = title.trim();
    const cleanSubtasks = subtasks.map((item) => item.trim()).filter(Boolean);
    if (!cleanTitle) {
      showError("Enter a task title.");
      return;
    }
    if (cleanSubtasks.length === 0) {
      showError("Add at least one subtask.");
      return;
    }
    await runRequest(async () => {
      const result = await postJson("/tasks/manual", {
        title: cleanTitle,
        subtasks: cleanSubtasks,
      });
      setTask(normalizeTask(result));
      showSuccess("Manual roadmap created.");
    });
  }

  async function createAutomaticTask() {
    if (!description.trim()) {
      showError("Enter a detailed task description.");
      return;
    }
    await runRequest(async () => {
      const result = await postJson("/tasks/automatic", {
        description,
      });
      setTask(normalizeTask(result));
      showSuccess("Automatic roadmap created.");
    });
  }

  async function createGuidedTask() {
    if (!guidedDescription.trim()) {
      showError("Enter a short task description.");
      return;
    }
    if (questions.length > 0 && answers.some((answer) => !answer.trim())) {
      showError("Answer all follow-up questions first.");
      return;
    }
    await runRequest(async () => {
      const result = await postJson("/tasks/clarify", {
        description: guidedDescription,
        answers,
      });
      if (isClarifyResponse(result)) {
        setQuestions(result.questions);
        setAnswers(result.questions.map((_, index) => answers[index] || ""));
        showSuccess("Follow-up questions generated.");
        return;
      }
      setTask(normalizeTask(result));
      setQuestions([]);
      setAnswers([]);
      showSuccess("Guided roadmap created.");
    });
  }

  async function toggleSubtask(subtaskId: string) {
    if (!task) {
      return;
    }
    await runRequest(async () => {
      const result = await patchJson(`/tasks/${task.id}/subtasks/${subtaskId}/toggle`);
      setTask(normalizeTask(result));
      showSuccess("Progress updated.");
    });
  }

  async function runRequest(callback: () => Promise<void>) {
    setIsLoading(true);
    clearMessage();
    try {
      await callback();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  async function postJson(path: string, body: object) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return readJsonResponse(response);
  }

  async function patchJson(path: string) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "PATCH",
    });
    return readJsonResponse(response);
  }

  async function readJsonResponse(response: Response) {
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(data.detail || data.error || "Request failed.");
    }
    return data;
  }

  type TaskResponse = Task | { task: Task };

  function normalizeTask(result: TaskResponse): Task {
    return "task" in result ? result.task : result;
  }

  function isClarifyResponse(result: unknown): result is ClarifyResponse {
    if (!result || typeof result !== "object") {
      return false;
    }

    return (
      "status" in result &&
      "questions" in result &&
      result.status === "needs_clarification" &&
      Array.isArray(result.questions)
    );
  }

  function updateAnswer(index: number, value: string) {
    const nextAnswers = [...answers];
    nextAnswers[index] = value;
    setAnswers(nextAnswers);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Procradicator</Text>
        <Text style={styles.subtitle}>
          Break an overwhelming assignment into small actionable steps.
        </Text>

        <View style={styles.modeRow}>
          {(["manual", "automatic", "guided"] as Mode[]).map((item) => (
            <Pressable
              key={item}
              style={[styles.modeButton, mode === item && styles.modeButtonActive]}
              onPress={() => {
                setMode(item);
                clearMessage();
              }}
            >
              <Text style={[styles.modeText, mode === item && styles.modeTextActive]}>
                {item === "manual" ? "Manual" : item === "automatic" ? "Auto" : "Guided"}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.card}>
          {mode === "manual" && (
            <View style={styles.section}>
              <Text style={styles.heading}>Create task manually</Text>

              <Text style={styles.label}>Task title</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Example: Finish Milestone 1"
              />

              <Text style={styles.label}>Subtask</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, styles.flex]}
                  value={subtaskInput}
                  onChangeText={setSubtaskInput}
                  placeholder="Example: Read assignment brief"
                  onSubmitEditing={addSubtask}
                />
                <Pressable style={styles.smallButton} onPress={addSubtask}>
                  <Text style={styles.buttonText}>Add</Text>
                </Pressable>
              </View>

              {subtasks.map((subtask, index) => (
                <View key={`${subtask}-${index}`} style={styles.subtaskRow}>
                  <Text style={styles.subtaskText}>
                    {index + 1}. {subtask}
                  </Text>

                  <Pressable onPress={() => moveSubtask(index, -1)}>
                    <Text style={[styles.linkText, index === 0 && styles.disabledText]}>
                      Up
                    </Text>
                  </Pressable>

                  <Pressable onPress={() => moveSubtask(index, 1)}>
                    <Text
                      style={[
                        styles.linkText,
                        index === subtasks.length - 1 && styles.disabledText,
                      ]}
                    >
                      Down
                    </Text>
                  </Pressable>

                  <Pressable onPress={() => deleteSubtask(index)}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </Pressable>
                </View>
              ))}

              <SubmitButton
                isLoading={isLoading}
                loadingText="Creating..."
                normalText="Create roadmap"
                onPress={createManualTask}
              />
            </View>
          )}

          {mode === "automatic" && (
            <View style={styles.section}>
              <Text style={styles.heading}>Automatic task creation</Text>
              <Text style={styles.note}>
                Describe the task clearly. The backend should generate a roadmap.
              </Text>

              <Text style={styles.label}>Describe the task clearly</Text>
              <TextInput
                multiline
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Example: I need to prepare my Milestone 1 submission..."
              />

              <SubmitButton
                isLoading={isLoading}
                loadingText="Generating..."
                normalText="Generate roadmap"
                onPress={createAutomaticTask}
              />
            </View>
          )}

          {mode === "guided" && (
            <View style={styles.section}>
              <Text style={styles.heading}>Semi-automatic guidance</Text>
              <Text style={styles.note}>
                Use this when the task description is vague. The backend can ask follow-up
                questions first.
              </Text>

              <Text style={styles.label}>Short description</Text>
              <TextInput
                multiline
                style={[styles.input, styles.textArea]}
                value={guidedDescription}
                onChangeText={setGuidedDescription}
                placeholder="Example: assignment"
              />

              {questions.map((question, index) => (
                <View key={`${question}-${index}`} style={styles.section}>
                  <Text style={styles.label}>{question}</Text>
                  <TextInput
                    style={styles.input}
                    value={answers[index] || ""}
                    onChangeText={(value) => updateAnswer(index, value)}
                    placeholder="Type your answer"
                  />
                </View>
              ))}

              <SubmitButton
                isLoading={isLoading}
                loadingText="Thinking..."
                normalText={questions.length > 0 ? "Create roadmap" : "Get follow-up questions"}
                onPress={createGuidedTask}
              />
            </View>
          )}

          {message ? (
            <Text style={[styles.message, isError ? styles.errorMessage : styles.successMessage]}>
              {message}
            </Text>
          ) : null}
        </View>

        {task ? (
          <View style={styles.card}>
            <Text style={styles.heading}>{task.title}</Text>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${task.progress}%` as DimensionValue },
                ]}
              />
            </View>

            <Text style={styles.progressText}>
              {task.completed_count} of {task.total_count} complete ({task.progress}%)
            </Text>

            {task.subtasks.map((subtask, index) => (
              <Pressable
                key={subtask.id}
                style={[styles.node, subtask.is_done && styles.nodeDone]}
                onPress={() => toggleSubtask(subtask.id)}
              >
                <View style={[styles.circle, subtask.is_done && styles.circleDone]}>
                  <Text style={[styles.circleText, subtask.is_done && styles.circleTextDone]}>
                    {index + 1}
                  </Text>
                </View>

                <View style={styles.flex}>
                  <Text style={[styles.nodeTitle, subtask.is_done && styles.doneText]}>
                    {subtask.title}
                  </Text>
                  <Text style={styles.nodeHint}>
                    {subtask.is_done ? "Completed" : "Tap to mark complete"}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.heading}>No roadmap yet</Text>
            <Text style={styles.note}>
              Create a manual, automatic, or guided roadmap to see progress nodes here.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SubmitButton({
  isLoading,
  loadingText,
  normalText,
  onPress,
}: {
  isLoading: boolean;
  loadingText: string;
  normalText: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={isLoading}
      style={[styles.primaryButton, isLoading && styles.disabledButton]}
      onPress={onPress}
    >
      {isLoading ? <ActivityIndicator color="#ffffff" /> : null}
      <Text style={styles.buttonText}>{isLoading ? loadingText : normalText}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#eef3ef",
  },
  content: {
    gap: 16,
    padding: 18,
  },
  title: {
    color: "#12312a",
    fontSize: 34,
    fontWeight: "800",
  },
  subtitle: {
    color: "#52635f",
    fontSize: 16,
    lineHeight: 23,
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
  },
  modeButton: {
    borderColor: "#cbd8d2",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  modeButtonActive: {
    backgroundColor: "#12312a",
    borderColor: "#12312a",
  },
  modeText: {
    color: "#52635f",
    fontWeight: "800",
    textAlign: "center",
  },
  modeTextActive: {
    color: "#ffffff",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    gap: 12,
    padding: 16,
  },
  section: {
    gap: 10,
  },
  heading: {
    color: "#12312a",
    fontSize: 22,
    fontWeight: "800",
  },
  label: {
    color: "#233b35",
    fontWeight: "700",
  },
  input: {
    borderColor: "#cbd8d2",
    borderRadius: 8,
    borderWidth: 1,
    color: "#12312a",
    fontSize: 16,
    padding: 12,
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
  },
  flex: {
    flex: 1,
  },
  smallButton: {
    alignItems: "center",
    backgroundColor: "#12312a",
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2f7d5c",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
  },
  disabledButton: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  subtaskRow: {
    alignItems: "center",
    backgroundColor: "#f7faf8",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    padding: 10,
  },
  subtaskText: {
    color: "#233b35",
    flex: 1,
  },
  linkText: {
    color: "#2f7d5c",
    fontWeight: "700",
  },
  disabledText: {
    color: "#a8b5b0",
  },
  deleteText: {
    color: "#9d1c1c",
    fontWeight: "700",
  },
  message: {
    borderRadius: 8,
    lineHeight: 20,
    padding: 12,
  },
  successMessage: {
    backgroundColor: "#e8f7ef",
    color: "#17613f",
  },
  errorMessage: {
    backgroundColor: "#fdecea",
    color: "#9d1c1c",
  },
  progressTrack: {
    backgroundColor: "#dce7e1",
    borderRadius: 999,
    height: 12,
    overflow: "hidden",
  },
  progressFill: {
    backgroundColor: "#2f7d5c",
    height: "100%",
  },
  progressText: {
    color: "#52635f",
    fontWeight: "700",
  },
  node: {
    alignItems: "center",
    backgroundColor: "#f7faf8",
    borderRadius: 8,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  nodeDone: {
    backgroundColor: "#e8f7ef",
  },
  circle: {
    alignItems: "center",
    borderColor: "#2f7d5c",
    borderRadius: 999,
    borderWidth: 2,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  circleDone: {
    backgroundColor: "#2f7d5c",
  },
  circleText: {
    color: "#2f7d5c",
    fontWeight: "800",
  },
  circleTextDone: {
    color: "#ffffff",
  },
  nodeTitle: {
    color: "#12312a",
    fontSize: 16,
    fontWeight: "800",
  },
  doneText: {
    textDecorationLine: "line-through",
  },
  nodeHint: {
    color: "#71817d",
    marginTop: 2,
  },
  note: {
    color: "#71817d",
    lineHeight: 20,
  },
});