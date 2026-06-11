import { WorkflowDefinition, StepDefinition } from "./types";

export class WorkflowBuilder {
	private code: string;
	private version: number;
	private steps: Record<string, StepDefinition> = {};
	private initialStepId: string | null = null;

	constructor(code: string, version: number = 1) {
		this.code = code;
		this.version = version;
	}

	/**
	 * Adds a step to the workflow. The first step added is automatically
	 * set as the initial starting point for the engine.
	 */
	addStep(stepId: string, config: Omit<StepDefinition, "stepId">): this {
		if (!this.initialStepId) {
			this.initialStepId = stepId;
		}

		this.steps[stepId] = {
			stepId,
			...config,
		};

		// Returning 'this' enables the fluent method chaining
		return this;
	}

	/**
	 * Compiles the chained steps into the final Definition object.
	 */
	build(): WorkflowDefinition {
		if (!this.initialStepId || Object.keys(this.steps).length === 0) {
			throw new Error(
				`Workflow ${this.code} must have at least one step.`,
			);
		}

		return {
			code: this.code,
			version: this.version,
			initialStepId: this.initialStepId,
			steps: this.steps,
		};
	}
}
