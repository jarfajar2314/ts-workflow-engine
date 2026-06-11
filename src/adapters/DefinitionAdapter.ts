// src/adapters/DefinitionAdapter.ts
import { WorkflowDefinition } from "../core/types";

export interface DefinitionAdapter {
	/**
	 * Retrieves the blueprint for a workflow.
	 * If version is omitted, it should return the latest active version.
	 */
	getWorkflow(
		code: string,
		version?: number,
	): Promise<WorkflowDefinition | null>;
}
