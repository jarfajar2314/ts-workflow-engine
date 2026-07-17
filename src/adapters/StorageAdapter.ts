// src/adapters/StorageAdapter.ts
import {
	WorkflowInstance,
	WorkflowStatus,
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
		context?: Record<string, any>;
	}): Promise<WorkflowInstance>;

	/**
	 * Retrieves the current state of a running workflow.
	 */
	getInstance(instanceId: string): Promise<WorkflowInstance | null>;

	/**
	 * Updates the workflow instance's overall status, current step, and context with OCC check.
	 */
	updateInstanceStatus(
		instanceId: string,
		status: WorkflowStatus,
		newStepId: string | null,
		expectedVersion?: number,
		context?: Record<string, any>,
	): Promise<void>;

	/**
	 * Logs an action taken by a user for the audit trail.
	 */
	logAction(data: Omit<WorkflowActionLog, "id" | "createdAt">): Promise<void>;

	/**
	 * Atomically updates instance status/step and writes the action log in a single transaction.
	 */
	updateInstanceAndLog?(
		instanceId: string,
		status: WorkflowStatus,
		newStepId: string | null,
		logData: Omit<WorkflowActionLog, "id" | "createdAt">,
		expectedVersion?: number,
		context?: Record<string, any>,
	): Promise<void>;
}

