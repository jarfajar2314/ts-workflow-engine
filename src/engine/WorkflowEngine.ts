import { DefinitionAdapter } from "../adapters/DefinitionAdapter";
import { EventAdapter } from "../adapters/EventAdapter";
import { ResolverAdapter } from "../adapters/ResolverAdapter";
import { StorageAdapter } from "../adapters/StorageAdapter";
import {
	WorkflowEventListener,
	WorkflowEventMap,
	WorkflowEventType,
} from "../core/events";
import { WorkflowInstance } from "../core/types";

export interface WorkflowEngineOptions {
	eventAdapters?: EventAdapter | EventAdapter[];
}

export class WorkflowEngine {
	private listeners: Map<
		WorkflowEventType,
		Set<WorkflowEventListener<any>>
	> = new Map();
	private eventAdapters: EventAdapter[] = [];

	// Dependency Injection: The engine strictly relies on the interfaces
	constructor(
		private definitions: DefinitionAdapter,
		private storage: StorageAdapter,
		private resolver: ResolverAdapter,
		options?: WorkflowEngineOptions | EventAdapter | EventAdapter[],
	) {
		if (options) {
			if ("eventAdapters" in options && options.eventAdapters) {
				const adapters = Array.isArray(options.eventAdapters)
					? options.eventAdapters
					: [options.eventAdapters];
				adapters.forEach((a) => this.registerEventAdapter(a));
			} else if (Array.isArray(options)) {
				options.forEach((a) => this.registerEventAdapter(a));
			} else if (typeof options === "object") {
				this.registerEventAdapter(options as EventAdapter);
			}
		}
	}

	/**
	 * Registers a typed event listener for a specific lifecycle event.
	 */
	on<K extends WorkflowEventType>(
		event: K,
		listener: WorkflowEventListener<K>,
	): this {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event)!.add(listener);
		return this;
	}

	/**
	 * Removes a typed event listener.
	 */
	off<K extends WorkflowEventType>(
		event: K,
		listener: WorkflowEventListener<K>,
	): this {
		const set = this.listeners.get(event);
		if (set) {
			set.delete(listener);
		}
		return this;
	}

	/**
	 * Registers an EventAdapter instance to receive lifecycle hook callbacks.
	 */
	registerEventAdapter(adapter: EventAdapter): this {
		if (!this.eventAdapters.includes(adapter)) {
			this.eventAdapters.push(adapter);
		}
		return this;
	}

	/**
	 * Safely emits events to listeners and event adapters in a non-blocking manner.
	 * Handlers throwing errors are caught and dispatched to 'error' listeners / onError adapter methods.
	 */
	private async emit<K extends WorkflowEventType>(
		event: K,
		payload: WorkflowEventMap[K],
	): Promise<void> {
		const listenerSet = this.listeners.get(event);
		const promises: Promise<void>[] = [];

		if (listenerSet) {
			for (const listener of listenerSet) {
				promises.push(
					(async () => {
						try {
							await listener(payload);
						} catch (err: any) {
							await this.handleListenerError(
								event,
								err instanceof Error ? err : new Error(String(err)),
								payload,
							);
						}
					})(),
				);
			}
		}

		for (const adapter of this.eventAdapters) {
			promises.push(
				(async () => {
					try {
						if (event === "workflowStart" && adapter.onWorkflowStart) {
							await adapter.onWorkflowStart(
								payload as WorkflowEventMap["workflowStart"],
							);
						} else if (event === "stepChange" && adapter.onStepChange) {
							await adapter.onStepChange(
								payload as WorkflowEventMap["stepChange"],
							);
						} else if (
							event === "workflowComplete" &&
							adapter.onWorkflowComplete
						) {
							await adapter.onWorkflowComplete(
								payload as WorkflowEventMap["workflowComplete"],
							);
						} else if (
							event === "workflowReject" &&
							adapter.onWorkflowReject
						) {
							await adapter.onWorkflowReject(
								payload as WorkflowEventMap["workflowReject"],
							);
						}
					} catch (err: any) {
						await this.handleListenerError(
							event,
							err instanceof Error ? err : new Error(String(err)),
							payload,
						);
					}
				})(),
			);
		}

		await Promise.allSettled(promises);
	}

	private async handleListenerError(
		event: WorkflowEventType,
		error: Error,
		payload: any,
	): Promise<void> {
		if (event === "error") {
			// Prevent infinite loop if 'error' listener itself throws
			return;
		}

		const errorPayload: WorkflowEventMap["error"] = {
			event,
			error,
			payload,
		};

		const errorListeners = this.listeners.get("error");
		if (errorListeners) {
			for (const l of errorListeners) {
				try {
					await l(errorPayload);
				} catch {
					// Ignore secondary errors in error listener
				}
			}
		}

		for (const adapter of this.eventAdapters) {
			try {
				if (adapter.onError) {
					await adapter.onError(errorPayload);
				}
			} catch {
				// Ignore secondary errors in adapter onError
			}
		}
	}

	/**
	 * Initializes a new workflow instance and sets it to the starting step.
	 */
	/**
	 * Initializes a new workflow instance and sets it to the starting step.
	 */
	async startWorkflow(
		code: string,
		refType: string,
		refId: string,
		actorId: string,
		context?: Record<string, any>,
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
			context,
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

		// 4. Emit workflowStart lifecycle event
		await this.emit("workflowStart", {
			instance,
			blueprint,
			actorId,
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

		// Save current step ID before status update (storage adapter may mutate object in place)
		const fromStepId = instance.currentStepId;
		const expectedVersion = instance.lockVersion;

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

		const currentStepDef = blueprint.steps[fromStepId];
		if (!currentStepDef) {
			throw new Error(
				`Step ${fromStepId} not found in blueprint.`,
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

		const logData = {
			instanceId: instance.id,
			action,
			fromStepId,
			toStepId: nextStepId,
			actorId,
			comment,
		};

		// 4 & 5. Save state & log action atomically (with OCC lock version verification)
		if (typeof this.storage.updateInstanceAndLog === "function") {
			await this.storage.updateInstanceAndLog(
				instance.id,
				newStatus,
				nextStepId,
				logData,
				expectedVersion,
				context,
			);
		} else {
			await this.storage.updateInstanceStatus(
				instance.id,
				newStatus,
				nextStepId,
				expectedVersion,
				context,
			);
			await this.storage.logAction(logData);
		}

		// 6. Emit lifecycle events
		const updatedInstance =
			(await this.storage.getInstance(instance.id)) || instance;

		if (nextStepId !== null) {
			await this.emit("stepChange", {
				instance: updatedInstance,
				fromStepId,
				toStepId: nextStepId,
				action,
				actorId,
				comment,
			});
		} else if (newStatus === "COMPLETED") {
			await this.emit("workflowComplete", {
				instance: updatedInstance,
				fromStepId,
				action: "APPROVE",
				actorId,
				comment,
			});
		} else if (newStatus === "REJECTED") {
			await this.emit("workflowReject", {
				instance: updatedInstance,
				fromStepId,
				action: "REJECT",
				actorId,
				comment,
			});
		}
	}
}
