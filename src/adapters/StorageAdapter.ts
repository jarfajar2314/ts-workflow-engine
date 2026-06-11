// src/adapters/StorageAdapter.ts
import {
	WorkflowInstance,
	WorkflowStatus,
	StepStatus,
	WorkflowActionLog,
} from "../core/types";

export interface StorageAdapter {
	/**
	 * Creates a brand new running instance of a workflow.
	 */
	createInstance(data: {
		workflowCode: string;
		workflowVersion: number;
		refType: string;
		refId: string;
		initialStepId: string;
		createdBy: string;
	}): Promise<WorkflowInstance>;

	/**
	 * Retrieves the current state of a running workflow.
	 */
	getInstance(instanceId: string): Promise<WorkflowInstance | null>;

	/**
	 * Updates the workflow instance's overall status and current step.
	 */
	updateInstanceStatus(
		instanceId: string,
		status: WorkflowStatus,
		newStepId: string | null,
	): Promise<void>;

	/**
	 * Logs an action taken by a user for the audit trail.
	 */
	logAction(data: Omit<WorkflowActionLog, "id" | "createdAt">): Promise<void>;
}
