import { DefinitionAdapter } from "../DefinitionAdapter";
import { WorkflowDefinition } from "../../core/types";

export class CodeDefinitionAdapter implements DefinitionAdapter {
	// We use a composite key: "CODE_VERSION" (e.g., "LEAVE_REQUEST_1")
	private registry = new Map<string, WorkflowDefinition>();

	/**
	 * Used by developers to load their built workflows into memory.
	 */
	register(definition: WorkflowDefinition): void {
		const key = `${definition.code}_${definition.version}`;
		this.registry.set(key, definition);
	}

	/**
	 * Used strictly by the engine to fetch the rules when a workflow runs.
	 */
	async getWorkflow(
		code: string,
		version: number = 1,
	): Promise<WorkflowDefinition> {
		const key = `${code}_${version}`;
		const definition = this.registry.get(key);

		if (!definition) {
			throw new Error(
				`Workflow definition not found: ${code} (v${version})`,
			);
		}

		return definition;
	}
}
