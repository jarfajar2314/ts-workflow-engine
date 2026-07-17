import { DefinitionAdapter } from "../DefinitionAdapter";
import { WorkflowDefinition, StepDefinition } from "../../core/types";

/**
 * Interface representing the minimal Prisma Client requirements for definition operations.
 * Allows passing PrismaClient without rigid global type coupling.
 */
export interface PrismaDefinitionClient {
	workflowDefinition: {
		findFirst(args: any): Promise<any>;
		upsert(args: any): Promise<any>;
	};
}

export class PrismaDefinitionAdapter implements DefinitionAdapter {
	constructor(private prisma: PrismaDefinitionClient) {}

	async getWorkflow(
		code: string,
		version?: number,
	): Promise<WorkflowDefinition | null> {
		let record: any;

		if (version !== undefined) {
			record = await this.prisma.workflowDefinition.findFirst({
				where: { code, version },
			});
		} else {
			record = await this.prisma.workflowDefinition.findFirst({
				where: { code },
				orderBy: { version: "desc" },
			});
		}

		if (!record) return null;

		const steps: Record<string, StepDefinition> =
			typeof record.steps === "string"
				? JSON.parse(record.steps)
				: (record.steps as unknown as Record<string, StepDefinition>);

		return {
			id: record.id,
			code: record.code,
			version: record.version,
			initialStepId: record.initialStepId,
			steps,
		};
	}

	async registerWorkflow(
		definition: WorkflowDefinition,
	): Promise<WorkflowDefinition> {
		const stepsJson = JSON.parse(JSON.stringify(definition.steps));

		await this.prisma.workflowDefinition.upsert({
			where: {
				code_version: {
					code: definition.code,
					version: definition.version,
				},
			},
			create: {
				code: definition.code,
				version: definition.version,
				initialStepId: definition.initialStepId,
				steps: stepsJson,
			},
			update: {
				initialStepId: definition.initialStepId,
				steps: stepsJson,
			},
		});

		return definition;
	}
}
