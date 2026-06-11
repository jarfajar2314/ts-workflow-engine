import { StepDefinition } from "../core/types";

export interface ResolverAdapter {
	/**
	 * Takes a step definition and returns an array of User IDs
	 * who are authorized to act on it.
	 */
	getAuthorizedActors(
		stepDef: StepDefinition,
		context: any,
	): Promise<string[]>;
}
