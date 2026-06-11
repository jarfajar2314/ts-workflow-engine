import { DefinitionAdapter } from "../adapters/DefinitionAdapter";
import { ResolverAdapter } from "../adapters/ResolverAdapter";
import { StorageAdapter } from "../adapters/StorageAdapter";
import { WorkflowInstance } from "../core/types";

export class WorkflowEngine {
	// Dependency Injection: The engine strictly relies on the interfaces
	constructor(
		private definitions: DefinitionAdapter,
		private storage: StorageAdapter,
		private resolver: ResolverAdapter,
	) {}

	/**
	 * Initializes a new workflow instance and sets it to the starting step.
	 */
	async startWorkflow(
		code: string,
		refType: string,
		refId: string,
		actorId: string,
	): Promise<WorkflowInstance> {
		// 1. Fetch the blueprint
		const blueprint = await this.definitions.getWorkflow(code);
		if (!blueprint) {
			throw new Error(`Cannot start: Blueprint for ${code} not found.`);
		}

		// 2. Create the live instance in storage
		const instance = await this.storage.createInstance({
			workflowCode: blueprint.code,
			workflowVersion: blueprint.version,
			refType,
			refId,
			initialStepId: blueprint.initialStepId,
			createdBy: actorId,
		});

		// 3. Log the initial start action
		await this.storage.logAction({
			instanceId: instance.id,
			action: "START",
			fromStepId: null,
			toStepId: blueprint.initialStepId,
			actorId,
			comment: "Workflow initiated.",
		});

		return instance;
	}

	/**
	 * Processes a human decision (Approve, Reject) on a specific step.
	 */
	async submitAction(
		instanceId: string,
		actorId: string,
		action: "APPROVE" | "REJECT",
		comment?: string,
		context?: any,
	): Promise<void> {
		// 1. Get the current live state
		const instance = await this.storage.getInstance(instanceId);
		if (!instance) throw new Error(`Instance ${instanceId} not found.`);
		if (instance.status !== "ACTIVE" || !instance.currentStepId) {
			throw new Error(
				`Instance ${instanceId} is not active or has no current step.`,
			);
		}

		// 2. Get the blueprint to check the rules
		const blueprint = await this.definitions.getWorkflow(
			instance.workflowCode,
			instance.workflowVersion,
		);

		if (!blueprint) {
			throw new Error(
				`Blueprint ${instance.workflowCode} version ${instance.workflowVersion} not found.`,
			);
		}

		const currentStepDef = blueprint.steps[instance.currentStepId];
		if (!currentStepDef) {
			throw new Error(
				`Step ${instance.currentStepId} not found in blueprint.`,
			);
		}

		// --- AUTHORIZATION CHECK ---
		const authorizedIds = await this.resolver.getAuthorizedActors(
			currentStepDef,
			context,
		);

		if (!authorizedIds.includes(actorId)) {
			throw new Error(
				`User ${actorId} is not authorized to approve step ${currentStepDef.stepId}.`,
			);
		}

		// 3. Compute the next step based on the action
		let nextStepId: string | null = null;
		let newStatus: WorkflowInstance["status"] = instance.status;

		if (action === "APPROVE") {
			if (currentStepDef.onApprove === "COMPLETE") {
				newStatus = "COMPLETED";
				nextStepId = null;
			} else {
				nextStepId = currentStepDef.onApprove;
			}
		} else if (action === "REJECT") {
			if (currentStepDef.onReject === "TERMINATE") {
				newStatus = "REJECTED";
				nextStepId = null;
			} else {
				// This handles the "Send Back" scenario
				nextStepId = currentStepDef.onReject;
			}
		}

		// 4. Save the new state
		await this.storage.updateInstanceStatus(
			instance.id,
			newStatus,
			nextStepId,
		);

		// 5. Audit log
		await this.storage.logAction({
			instanceId: instance.id,
			action,
			fromStepId: instance.currentStepId,
			toStepId: nextStepId,
			actorId,
			comment,
		});
	}
}
