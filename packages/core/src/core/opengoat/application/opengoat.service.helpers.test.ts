import { describe, expect, it } from "vitest";
import type { TaskRecord } from "../../boards/index.js";
import {
  buildBlockedTaskMessage,
  buildInactiveAgentsMessage,
  buildInactiveAgentMessage,
  buildInactiveSessionRef,
  buildNotificationSessionRef,
  buildPendingTaskMessage,
  buildTaskSessionRef,
  buildTodoTaskMessage,
  resolveBottomUpTaskDelegationStrategy,
} from "./opengoat.service.helpers.js";

describe("opengoat task cron notification helpers", () => {
  it("reuses one notification session per agent", () => {
    const notificationRef = buildNotificationSessionRef("Engineer");
    const taskRefA = buildTaskSessionRef("Engineer", "task-a");
    const taskRefB = buildTaskSessionRef("Engineer", "task-b");
    const inactiveRefA = buildInactiveSessionRef("Engineer", "designer");
    const inactiveRefB = buildInactiveSessionRef("Engineer", "qa");

    expect(notificationRef).toBe("agent:engineer:agent_engineer_notifications");
    expect(taskRefA).toBe(notificationRef);
    expect(taskRefB).toBe(notificationRef);
    expect(inactiveRefA).toBe(notificationRef);
    expect(inactiveRefB).toBe(notificationRef);
  });

  it("adds normalized notification timestamps to task and inactivity messages", () => {
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
    expect(
      buildInactiveAgentMessage({
        managerAgentId: "ceo",
        subjectAgentId: "engineer",
        subjectName: "Engineer",
        role: "Backend Engineer",
        directReporteesCount: 1,
        indirectReporteesCount: 2,
        inactiveMinutes: 30,
        notificationTimestamp: timestamp,
      }),
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

  it("builds a single combined message for multiple inactive reportees", () => {
    const message = buildInactiveAgentsMessage({
      inactiveMinutes: 30,
      notificationTimestamp: "2026-02-16T11:30:00-05:00",
      candidates: [
        {
          subjectAgentId: "engineer",
          subjectName: "Engineer",
          role: "Backend Engineer",
          directReporteesCount: 1,
          indirectReporteesCount: 2,
        },
        {
          subjectAgentId: "designer",
          subjectName: "Designer",
          role: "Product Designer",
          directReporteesCount: 0,
          indirectReporteesCount: 0,
          lastActionTimestamp: Date.parse("2026-02-16T15:45:00.000Z"),
        },
      ],
    });

    expect(message).toContain(
      "You have 2 reportees with no activity in the last 30 minutes.",
    );
    expect(message).toContain("Inactive reportees:");
    expect(message).toContain('"@designer" (Designer)');
    expect(message).toContain('"@engineer" (Engineer)');
    expect(message).toContain("Last action: 2026-02-16T15:45:00.000Z");
    expect(message).toContain("Last action: none recorded");
    expect(message).toContain("Notification timestamp: 2026-02-16T16:30:00.000Z");
  });

  it("resolves bottom-up strategy from explicit strategy config", () => {
    const resolved = resolveBottomUpTaskDelegationStrategy({
      inactiveMinutes: 30,
      notificationTarget: "all-managers",
      notifyInactiveAgents: true,
      delegationStrategies: {
        bottomUp: {
          enabled: false,
          inactiveMinutes: 90,
          notificationTarget: "ceo-only",
        },
      },
    });

    expect(resolved).toEqual({
      enabled: false,
      inactiveMinutes: 90,
      notificationTarget: "ceo-only",
    });
  });

  it("falls back to legacy inactive settings when bottom-up config is absent", () => {
    const resolved = resolveBottomUpTaskDelegationStrategy({
      inactiveMinutes: 45,
      notificationTarget: "ceo-only",
      notifyInactiveAgents: true,
    });

    expect(resolved).toEqual({
      enabled: true,
      inactiveMinutes: 45,
      notificationTarget: "ceo-only",
    });
  });
});

function buildTask(): TaskRecord {
  return {
    taskId: "task-123",
    createdAt: "2026-02-16T15:00:00.000Z",
    updatedAt: "2026-02-16T15:00:00.000Z",
    owner: "ceo",
    assignedTo: "engineer",
    title: "Ship notification updates",
    description: "Implement and verify cron notification behavior updates.",
    status: "todo",
    blockers: [],
    artifacts: [],
    worklog: [],
  };
}
