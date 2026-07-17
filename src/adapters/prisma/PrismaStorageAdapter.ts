import { StorageAdapter } from "../StorageAdapter";
import {
	WorkflowInstance,
	WorkflowStatus,
	WorkflowActionLog,
	WorkflowConcurrencyError,
} from "../../core/types";

export interface PrismaStorageClient {
	workflowInstance: {
		create(args: any): Promise<any>;
		findUnique(args: any): Promise<any>;
		update(args: any): Promise<any>;
		updateMany(args: any): Promise<any>;
	};
	workflowActionLog: {
		create(args: any): Promise<any>;
		findMany(args: any): Promise<any>;
	};
	$transaction?: (arg: any) => Promise<any>;
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
		context?: Record<string, any>;
	}): Promise<WorkflowInstance> {
		const record = await this.prisma.workflowInstance.create({
			data: {
				workflowCode: data.workflowCode,
				workflowVersion: data.workflowVersion,
				refType: data.refType,
				refId: data.refId,
				status: "ACTIVE",
				currentStepId: data.initialStepId,
				context: data.context ?? undefined,
				lockVersion: 1,
				createdBy: data.createdBy,
			},
		});

		return this.mapToInstance(record);
	}

	async getInstance(instanceId: string): Promise<WorkflowInstance | null> {
		const record = await this.prisma.workflowInstance.findUnique({
			where: { id: instanceId },
		});

		if (!record) return null;
		return this.mapToInstance(record);
	}

	async updateInstanceStatus(
		instanceId: string,
		status: WorkflowStatus,
		newStepId: string | null,
		expectedVersion?: number,
		context?: Record<string, any>,
	): Promise<void> {
		const now = new Date();
		const isTerminal = status === "COMPLETED" || status === "REJECTED" || status === "TERMINATED";

		if (expectedVersion !== undefined) {
			const updateData: any = {
				status,
				currentStepId: newStepId,
				lockVersion: { increment: 1 },
				updatedAt: now,
			};
			if (isTerminal) {
				updateData.completedAt = now;
			}
			if (context) {
				updateData.context = context;
			}

			const res = await this.prisma.workflowInstance.updateMany({
				where: {
					id: instanceId,
					lockVersion: expectedVersion,
				},
				data: updateData,
			});

			if (res.count === 0) {
				throw new WorkflowConcurrencyError(instanceId, expectedVersion);
			}
		} else {
			const updateData: any = {
				status,
				currentStepId: newStepId,
				lockVersion: { increment: 1 },
				updatedAt: now,
			};
			if (isTerminal) {
				updateData.completedAt = now;
			}
			if (context) {
				updateData.context = context;
			}

			await this.prisma.workflowInstance.update({
				where: { id: instanceId },
				data: updateData,
			});
		}
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

	async updateInstanceAndLog(
		instanceId: string,
		status: WorkflowStatus,
		newStepId: string | null,
		logData: Omit<WorkflowActionLog, "id" | "createdAt">,
		expectedVersion?: number,
		context?: Record<string, any>,
	): Promise<void> {
		if (typeof this.prisma.$transaction === "function") {
			await this.prisma.$transaction(async (tx: PrismaStorageClient) => {
				const txAdapter = new PrismaStorageAdapter(tx);
				await txAdapter.updateInstanceStatus(instanceId, status, newStepId, expectedVersion, context);
				await txAdapter.logAction(logData);
			});
		} else {
			await this.updateInstanceStatus(instanceId, status, newStepId, expectedVersion, context);
			await this.logAction(logData);
		}
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

	private mapToInstance(record: any): WorkflowInstance {
		return {
			id: record.id,
			workflowCode: record.workflowCode,
			workflowVersion: record.workflowVersion,
			refType: record.refType,
			refId: record.refId,
			status: record.status as WorkflowStatus,
			currentStepId: record.currentStepId,
			context: typeof record.context === "string" ? JSON.parse(record.context) : record.context ?? null,
			lockVersion: record.lockVersion ?? 1,
			createdAt: record.createdAt,
			updatedAt: record.updatedAt ?? record.createdAt,
			completedAt: record.completedAt ?? null,
			createdBy: record.createdBy,
		};
	}
}

