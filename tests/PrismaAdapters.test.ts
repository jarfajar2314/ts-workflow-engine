import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
	WorkflowEngine,
	WorkflowBuilder,
	PrismaDefinitionAdapter,
	PrismaStorageAdapter,
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

describe("Prisma Adapters Integration Tests (PostgreSQL)", () => {
	let prisma: PrismaClient;
	let definitions: PrismaDefinitionAdapter;
	let storage: PrismaStorageAdapter;
	let resolver: TestResolver;
	let engine: WorkflowEngine;

	beforeAll(async () => {
		prisma = new PrismaClient();
		// Clean test data tables
		await prisma.workflowActionLog.deleteMany({});
		await prisma.workflowInstance.deleteMany({});
		await prisma.workflowDefinition.deleteMany({});
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	beforeEach(async () => {
		definitions = new PrismaDefinitionAdapter(prisma);
		storage = new PrismaStorageAdapter(prisma);
		resolver = new TestResolver();
		engine = new WorkflowEngine(definitions, storage, resolver);
	});

	it("Sequential flow in PostgreSQL: Step 1 -> Step 2 -> Complete", async () => {
		const workflow = new WorkflowBuilder("PG_SEQUENTIAL")
			.addStep("STEP_1", {
				name: "First Step",
				approverStrategy: "USER",
				approverValue: "alice",
				onApprove: "STEP_2",
				onReject: "TERMINATE",
			})
			.addStep("STEP_2", {
				name: "Second Step",
				approverStrategy: "USER",
				approverValue: "bob",
				onApprove: "COMPLETE",
				onReject: "TERMINATE",
			})
			.build();

		await definitions.registerWorkflow(workflow);

		// Start workflow
		let instance = await engine.startWorkflow("PG_SEQUENTIAL", "purchase_order", "po_901", "alice");
		expect(instance.status).toBe("ACTIVE");
		expect(instance.currentStepId).toBe("STEP_1");

		// Step 1 approved by Alice
		await engine.submitAction(instance.id, "alice", "APPROVE");
		instance = (await storage.getInstance(instance.id))!;
		expect(instance.status).toBe("ACTIVE");
		expect(instance.currentStepId).toBe("STEP_2");

		// Step 2 approved by Bob
		await engine.submitAction(instance.id, "bob", "APPROVE");
		instance = (await storage.getInstance(instance.id))!;
		expect(instance.status).toBe("COMPLETED");
		expect(instance.currentStepId).toBeNull();

		// Verify audit logs in PostgreSQL
		const logs = await storage.getLogsForInstance(instance.id);
		expect(logs).toHaveLength(3); // START, APPROVE 1, APPROVE 2
		expect(logs[1].actorId).toBe("alice");
		expect(logs[2].actorId).toBe("bob");
	});

	it("Send Back flow in PostgreSQL: Step 2 -> Send Back to Step 1", async () => {
		const workflow = new WorkflowBuilder("PG_SENDBACK")
			.addStep("MANAGER", {
				name: "Manager Approval",
				approverStrategy: "USER",
				approverValue: "manager_joe",
				onApprove: "FINANCE",
				onReject: "TERMINATE",
			})
			.addStep("FINANCE", {
				name: "Finance Audit",
				approverStrategy: "USER",
				approverValue: "finance_pam",
				onApprove: "COMPLETE",
				onReject: "MANAGER", // Send Back to Manager
			})
			.build();

		await definitions.registerWorkflow(workflow);

		let instance = await engine.startWorkflow("PG_SENDBACK", "expense", "exp_555", "employee_sam");
		
		// Manager approves
		await engine.submitAction(instance.id, "manager_joe", "APPROVE");
		instance = (await storage.getInstance(instance.id))!;
		expect(instance.currentStepId).toBe("FINANCE");

		// Finance rejects with comment (Send back to MANAGER)
		await engine.submitAction(instance.id, "finance_pam", "REJECT", "Invalid receipt formatting");
		instance = (await storage.getInstance(instance.id))!;
		expect(instance.status).toBe("ACTIVE");
		expect(instance.currentStepId).toBe("MANAGER");

		// Manager re-approves
		await engine.submitAction(instance.id, "manager_joe", "APPROVE", "Corrected receipt attached");
		instance = (await storage.getInstance(instance.id))!;
		expect(instance.currentStepId).toBe("FINANCE");

		// Finance approves
		await engine.submitAction(instance.id, "finance_pam", "APPROVE");
		instance = (await storage.getInstance(instance.id))!;
		expect(instance.status).toBe("COMPLETED");
	});
});
