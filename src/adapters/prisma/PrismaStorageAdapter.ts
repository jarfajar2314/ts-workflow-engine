import { StorageAdapter } from "../StorageAdapter";
import {
	WorkflowInstance,
	WorkflowStatus,
	WorkflowActionLog,
} from "../../core/types";

export interface PrismaStorageClient {
	workflowInstance: {
		create(args: any): Promise<any>;
		findUnique(args: any): Promise<any>;
		update(args: any): Promise<any>;
	};
	workflowActionLog: {
		create(args: any): Promise<any>;
		findMany(args: any): Promise<any>;
	};
}

export class PrismaStorageAdapter implements StorageAdapter {
	constructor(private prisma: PrismaStorageClient) {}

	async createInstance(data: {
		workflowCode: string;
		workflowVersion: number;
		refType: string;
		refId: string;
		initialStepId: string;
		createdBy: string;
	}): Promise<WorkflowInstance> {
		const record = await this.prisma.workflowInstance.create({
			data: {
				workflowCode: data.workflowCode,
				workflowVersion: data.workflowVersion,
				refType: data.refType,
				refId: data.refId,
				status: "ACTIVE",
				currentStepId: data.initialStepId,
				createdBy: data.createdBy,
			},
		});

		return {
			id: record.id,
			workflowCode: record.workflowCode,
			workflowVersion: record.workflowVersion,
			refType: record.refType,
			refId: record.refId,
			status: record.status as WorkflowStatus,
			currentStepId: record.currentStepId,
			createdAt: record.createdAt,
			createdBy: record.createdBy,
		};
	}

	async getInstance(instanceId: string): Promise<WorkflowInstance | null> {
		const record = await this.prisma.workflowInstance.findUnique({
			where: { id: instanceId },
		});

		if (!record) return null;

		return {
			id: record.id,
			workflowCode: record.workflowCode,
			workflowVersion: record.workflowVersion,
			refType: record.refType,
			refId: record.refId,
			status: record.status as WorkflowStatus,
			currentStepId: record.currentStepId,
			createdAt: record.createdAt,
			createdBy: record.createdBy,
		};
	}

	async updateInstanceStatus(
		instanceId: string,
		status: WorkflowStatus,
		newStepId: string | null,
	): Promise<void> {
		await this.prisma.workflowInstance.update({
			where: { id: instanceId },
			data: {
				status,
				currentStepId: newStepId,
			},
		});
	}

	async logAction(
		data: Omit<WorkflowActionLog, "id" | "createdAt">,
	): Promise<void> {
		await this.prisma.workflowActionLog.create({
			data: {
				instanceId: data.instanceId,
				action: data.action,
				fromStepId: data.fromStepId,
				toStepId: data.toStepId,
				actorId: data.actorId,
				comment: data.comment,
			},
		});
	}

	async getLogsForInstance(instanceId: string): Promise<WorkflowActionLog[]> {
		const records = await this.prisma.workflowActionLog.findMany({
			where: { instanceId },
			orderBy: { createdAt: "asc" },
		});

		return records.map((r: any) => ({
			id: r.id,
			instanceId: r.instanceId,
			action: r.action,
			fromStepId: r.fromStepId,
			toStepId: r.toStepId,
			actorId: r.actorId,
			comment: r.comment ?? undefined,
			createdAt: r.createdAt,
		}));
	}
}
