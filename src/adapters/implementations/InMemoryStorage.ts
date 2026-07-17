// src/adapters/implementations/InMemoryStorage.ts
import { randomUUID } from "crypto";
import { StorageAdapter } from "../StorageAdapter";
import {
	WorkflowInstance,
	WorkflowStatus,
	WorkflowActionLog,
	WorkflowConcurrencyError,
} from "../../core/types";

export class InMemoryStorage implements StorageAdapter {
	// Simulates your 'workflow_instance' table
	private instances = new Map<string, WorkflowInstance>();

	// Simulates your 'workflow_action_log' table
	private actionLogs: WorkflowActionLog[] = [];

	async createInstance(data: {
		workflowCode: string;
		workflowVersion: number;
		refType: string;
		refId: string;
		initialStepId: string;
		createdBy: string;
		context?: Record<string, any>;
	}): Promise<WorkflowInstance> {
		const id = randomUUID();
		const now = new Date();

		const instance: WorkflowInstance = {
			id,
			workflowCode: data.workflowCode,
			workflowVersion: data.workflowVersion,
			refType: data.refType,
			refId: data.refId,
			status: "ACTIVE", // A newly started workflow is immediately active
			currentStepId: data.initialStepId,
			context: data.context ?? null,
			lockVersion: 1,
			createdAt: now,
			updatedAt: now,
			createdBy: data.createdBy,
		};

		this.instances.set(id, instance);
		return instance;
	}

	async getInstance(instanceId: string): Promise<WorkflowInstance | null> {
		const instance = this.instances.get(instanceId);
		if (!instance) return null;
		// Return a cloned object to simulate database boundary behavior
		return { ...instance, context: instance.context ? { ...instance.context } : null };
	}

	async updateInstanceStatus(
		instanceId: string,
		status: WorkflowStatus,
		newStepId: string | null,
		expectedVersion?: number,
		context?: Record<string, any>,
	): Promise<void> {
		const instance = this.instances.get(instanceId);

		if (!instance) {
			throw new Error(`Cannot update: Instance ${instanceId} not found`);
		}

		if (expectedVersion !== undefined && instance.lockVersion !== expectedVersion) {
			throw new WorkflowConcurrencyError(instanceId, expectedVersion);
		}

		const now = new Date();
		instance.status = status;
		instance.currentStepId = newStepId;
		instance.lockVersion += 1;
		instance.updatedAt = now;
		if (status === "COMPLETED" || status === "REJECTED" || status === "TERMINATED") {
			instance.completedAt = now;
		}
		if (context) {
			instance.context = { ...(instance.context || {}), ...context };
		}

		this.instances.set(instanceId, instance);
	}

	async logAction(
		data: Omit<WorkflowActionLog, "id" | "createdAt">,
	): Promise<void> {
		const log: WorkflowActionLog = {
			...data,
			id: randomUUID(),
			createdAt: new Date(),
		};

		this.actionLogs.push(log);
	}

	async updateInstanceAndLog(
		instanceId: string,
		status: WorkflowStatus,
		newStepId: string | null,
		logData: Omit<WorkflowActionLog, "id" | "createdAt">,
		expectedVersion?: number,
		context?: Record<string, any>,
	): Promise<void> {
		await this.updateInstanceStatus(instanceId, status, newStepId, expectedVersion, context);
		await this.logAction(logData);
	}

	/**
	 * Helper method exclusive to this InMemory version.
	 * Very useful for asserting tests later (e.g., checking if an audit log was created).
	 */
	getLogsForInstance(instanceId: string): WorkflowActionLog[] {
		return this.actionLogs.filter((log) => log.instanceId === instanceId);
	}
}

