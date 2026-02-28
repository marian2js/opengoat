import { describe, expect, it } from "vitest";
import type { TaskRecord } from "../../boards/index.js";
import {
  buildBlockedTaskMessage,
  buildNotificationSessionRef,
  buildPendingTaskMessage,
  buildTopDownTaskDelegationMessage,
  buildTaskSessionRef,
  buildTodoTaskMessage,
  resolveTopDownTaskDelegationStrategy,
} from "./opengoat.service.helpers.js";

describe("opengoat task cron notification helpers", () => {
  it("reuses one notification session per agent", () => {
    const notificationRef = buildNotificationSessionRef("Engineer");
    const taskRefA = buildTaskSessionRef("Engineer", "task-a");
    const taskRefB = buildTaskSessionRef("Engineer", "task-b");

    expect(notificationRef).toBe("agent:engineer:agent_engineer_notifications");
    expect(taskRefA).toBe(notificationRef);
    expect(taskRefB).toBe(notificationRef);
  });

  it("adds normalized notification timestamps to task messages", () => {
    const task = buildTask();
    const timestamp = "2026-02-16T11:30:00-05:00";
    const normalizedTimestamp = "2026-02-16T16:30:00.000Z";

    expect(
      buildTodoTaskMessage({ task, notificationTimestamp: timestamp }),
    ).toContain(`Notification timestamp: ${normalizedTimestamp}`);
    expect(
      buildPendingTaskMessage({
        task,
        pendingMinutes: 45,
        notificationTimestamp: timestamp,
      }),
    ).toContain(`Notification timestamp: ${normalizedTimestamp}`);
    expect(
      buildBlockedTaskMessage({ task, notificationTimestamp: timestamp }),
    ).toContain(`Notification timestamp: ${normalizedTimestamp}`);
  });

  it("adds status update reminder to todo and pending task notifications", () => {
    const task = buildTask();

    const todoMessage = buildTodoTaskMessage({ task });
    const pendingMessage = buildPendingTaskMessage({
      task: {
        ...task,
        status: "pending",
      },
      pendingMinutes: 45,
    });

    expect(todoMessage.endsWith("Make sure the task status is updated")).toBe(
      true,
    );
    expect(
      pendingMessage.endsWith("Make sure the task status is updated"),
    ).toBe(true);
  });

  it("skips notification timestamp line when timestamp input is invalid", () => {
    const task = buildTask();
    const message = buildTodoTaskMessage({
      task,
      notificationTimestamp: "not-a-date",
    });

    expect(message).not.toContain("Notification timestamp:");
  });

  it("defaults top-down strategy to enabled with threshold 5", () => {
    const resolved = resolveTopDownTaskDelegationStrategy({});

    expect(resolved).toEqual({
      enabled: true,
      openTasksThreshold: 5,
    });
  });

  it("builds a concise top-down task delegation message for Sage", () => {
    const message = buildTopDownTaskDelegationMessage({
      openTasksThreshold: 5,
      openTasksCount: 2,
      totalAgents: 4,
      managerAgents: 2,
      sageDirectReportees: 2,
      openTasks: [
        {
          taskId: "task-1",
          title: "Improve onboarding",
          status: "todo",
          assignedTo: "cto",
        },
        {
          taskId: "task-2",
          title: "Stabilize release pipeline",
          status: "blocked",
          assignedTo: "engineer",
        },
      ],
      notificationTimestamp: "2026-02-16T11:30:00-05:00",
    });

    expect(message).toContain("Top-Down threshold (5)");
    expect(message).toContain("Organization context: 4 total agents");
    expect(message).toContain("Sage playbook for top-down delegation");
    expect(message).toContain("organization/ROADMAP.md");
    expect(message).toContain("what we need");
    expect(message).toContain("not implementation details");
    expect(message).toContain("task-1 [todo] @cto");
    expect(message).toContain("Notification timestamp: 2026-02-16T16:30:00.000Z");
  });
});

function buildTask(): TaskRecord {
  return {
    taskId: "task-123",
    createdAt: "2026-02-16T15:00:00.000Z",
    updatedAt: "2026-02-16T15:00:00.000Z",
    owner: "goat",
    assignedTo: "engineer",
    title: "Ship notification updates",
    description: "Implement and verify cron notification behavior updates.",
    status: "todo",
    blockers: [],
    artifacts: [],
    worklog: [],
  };
}
