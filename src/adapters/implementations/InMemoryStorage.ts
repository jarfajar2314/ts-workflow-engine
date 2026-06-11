// src/adapters/implementations/InMemoryStorage.ts
import { randomUUID } from "crypto";
import { StorageAdapter } from "../StorageAdapter";
import {
	WorkflowInstance,
	WorkflowStatus,
	WorkflowActionLog,
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
	}): Promise<WorkflowInstance> {
		const id = randomUUID();

		const instance: WorkflowInstance = {
			id,
			workflowCode: data.workflowCode,
			workflowVersion: data.workflowVersion,
			refType: data.refType,
			refId: data.refId,
			status: "ACTIVE", // A newly started workflow is immediately active
			currentStepId: data.initialStepId,
			createdAt: new Date(),
			createdBy: data.createdBy,
		};

		this.instances.set(id, instance);
		return instance;
	}

	async getInstance(instanceId: string): Promise<WorkflowInstance | null> {
		const instance = this.instances.get(instanceId);
		return instance || null;
	}

	async updateInstanceStatus(
		instanceId: string,
		status: WorkflowStatus,
		newStepId: string | null,
	): Promise<void> {
		const instance = this.instances.get(instanceId);

		if (!instance) {
			throw new Error(`Cannot update: Instance ${instanceId} not found`);
		}

		// Mutate the state and save it back to the Map
		instance.status = status;
		instance.currentStepId = newStepId;
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

	/**
	 * Helper method exclusive to this InMemory version.
	 * Very useful for asserting tests later (e.g., checking if an audit log was created).
	 */
	getLogsForInstance(instanceId: string): WorkflowActionLog[] {
		return this.actionLogs.filter((log) => log.instanceId === instanceId);
	}
}
