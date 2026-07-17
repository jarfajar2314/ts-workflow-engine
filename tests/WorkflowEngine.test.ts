import { describe, it, expect, beforeEach } from "vitest";
import {
	WorkflowEngine,
	WorkflowBuilder,
	CodeDefinitionAdapter,
	InMemoryStorage,
	ResolverAdapter,
	StepDefinition,
} from "../src";

class TestResolver implements ResolverAdapter {
	async getAuthorizedActors(stepDef: StepDefinition, context: any): Promise<string[]> {
		if (stepDef.approverStrategy === "USER") {
			return [stepDef.approverValue];
		}
		if (stepDef.approverStrategy === "DYNAMIC" && context) {
			return [context[stepDef.approverValue]];
		}
		return [];
	}
}

describe("WorkflowEngine (Phase 6 Tests)", () => {
	let definitions: CodeDefinitionAdapter;
	let storage: InMemoryStorage;
	let resolver: TestResolver;
	let engine: WorkflowEngine;

	beforeEach(() => {
		definitions = new CodeDefinitionAdapter();
		storage = new InMemoryStorage();
		resolver = new TestResolver();
		engine = new WorkflowEngine(definitions, storage, resolver);
	});

	it("Sequential flow: Step 1 -> Step 2 -> Complete", async () => {
		const workflow = new WorkflowBuilder("SEQUENTIAL_TEST")
			.addStep("STEP_1", {
				name: "First Step",
				approverStrategy: "USER",
				approverValue: "user_1",
				onApprove: "STEP_2",
				onReject: "TERMINATE",
			})
			.addStep("STEP_2", {
				name: "Second Step",
				approverStrategy: "USER",
				approverValue: "user_2",
				onApprove: "COMPLETE",
				onReject: "TERMINATE",
			})
			.build();

		definitions.register(workflow);

		// Start workflow
		let instance = await engine.startWorkflow("SEQUENTIAL_TEST", "doc", "101", "user_1");
		expect(instance.status).toBe("ACTIVE");
		expect(instance.currentStepId).toBe("STEP_1");

		// Approve Step 1
		await engine.submitAction(instance.id, "user_1", "APPROVE");
		instance = (await storage.getInstance(instance.id))!;
		expect(instance.status).toBe("ACTIVE");
		expect(instance.currentStepId).toBe("STEP_2");

		// Approve Step 2
		await engine.submitAction(instance.id, "user_2", "APPROVE");
		instance = (await storage.getInstance(instance.id))!;
		expect(instance.status).toBe("COMPLETED");
		expect(instance.currentStepId).toBeNull();
	});

	it("Rejection flow: Step 1 -> Reject -> Terminated", async () => {
		const workflow = new WorkflowBuilder("REJECT_TEST")
			.addStep("STEP_1", {
				name: "First Step",
				approverStrategy: "USER",
				approverValue: "user_1",
				onApprove: "COMPLETE",
				onReject: "TERMINATE",
			})
			.build();

		definitions.register(workflow);

		let instance = await engine.startWorkflow("REJECT_TEST", "doc", "102", "user_1");
		expect(instance.status).toBe("ACTIVE");
		expect(instance.currentStepId).toBe("STEP_1");

		// Reject Step 1
		await engine.submitAction(instance.id, "user_1", "REJECT", "Reason: Budget exceeded");
		instance = (await storage.getInstance(instance.id))!;
		expect(instance.status).toBe("REJECTED");
		expect(instance.currentStepId).toBeNull();

		// Verify action logs recorded
		const logs = storage.getLogsForInstance(instance.id);
		expect(logs).toHaveLength(2); // START + REJECT
		expect(logs[1].action).toBe("REJECT");
		expect(logs[1].comment).toBe("Reason: Budget exceeded");
	});

	it("Send Back flow: Step 2 -> Send Back to Step 1", async () => {
		const workflow = new WorkflowBuilder("SENDBACK_TEST")
			.addStep("STEP_1", {
				name: "Manager Review",
				approverStrategy: "USER",
				approverValue: "manager_1",
				onApprove: "STEP_2",
				onReject: "TERMINATE",
			})
			.addStep("STEP_2", {
				name: "Finance Review",
				approverStrategy: "USER",
				approverValue: "finance_1",
				onApprove: "COMPLETE",
				onReject: "STEP_1", // Sends back to Step 1
			})
			.build();

		definitions.register(workflow);

		let instance = await engine.startWorkflow("SENDBACK_TEST", "expense", "201", "employee_1");
		
		// Manager approves
		await engine.submitAction(instance.id, "manager_1", "APPROVE");
		instance = (await storage.getInstance(instance.id))!;
		expect(instance.currentStepId).toBe("STEP_2");

		// Finance rejects (Send Back to STEP_1)
		await engine.submitAction(instance.id, "finance_1", "REJECT", "Missing receipts");
		instance = (await storage.getInstance(instance.id))!;
		expect(instance.status).toBe("ACTIVE");
		expect(instance.currentStepId).toBe("STEP_1");

		// Manager re-approves
		await engine.submitAction(instance.id, "manager_1", "APPROVE", "Added receipts");
		instance = (await storage.getInstance(instance.id))!;
		expect(instance.currentStepId).toBe("STEP_2");

		// Finance approves
		await engine.submitAction(instance.id, "finance_1", "APPROVE");
		instance = (await storage.getInstance(instance.id))!;
		expect(instance.status).toBe("COMPLETED");
	});

	it("Unauthorized actor attempts to approve protection", async () => {
		const workflow = new WorkflowBuilder("AUTH_TEST")
			.addStep("STEP_1", {
				name: "Approval",
				approverStrategy: "DYNAMIC",
				approverValue: "managerId",
				onApprove: "COMPLETE",
				onReject: "TERMINATE",
			})
			.build();

		definitions.register(workflow);

		const instance = await engine.startWorkflow("AUTH_TEST", "doc", "301", "user_1");
		const context = { managerId: "authorized_manager" };

		// Unauthorized user attempts approval
		await expect(
			engine.submitAction(instance.id, "unauthorized_user", "APPROVE", undefined, context)
		).rejects.toThrow(/not authorized/i);

		// State should remain unchanged at STEP_1
		const currentInstance = await storage.getInstance(instance.id);
		expect(currentInstance?.status).toBe("ACTIVE");
		expect(currentInstance?.currentStepId).toBe("STEP_1");

		// Authorized manager succeeds
		await engine.submitAction(instance.id, "authorized_manager", "APPROVE", undefined, context);
		const updatedInstance = await storage.getInstance(instance.id);
		expect(updatedInstance?.status).toBe("COMPLETED");
	});
});
