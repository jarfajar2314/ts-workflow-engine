// demo.ts
import { WorkflowBuilder } from "../src/core/WorkflowBuilder";
import { WorkflowEngine } from "../src/engine/WorkflowEngine";
import { CodeDefinitionAdapter } from "../src/adapters/implementations/CodeDefinitionAdapter";
import { InMemoryStorage } from "../src/adapters/implementations/InMemoryStorage";
import { ResolverAdapter } from "../src/adapters/ResolverAdapter";
import { StepDefinition } from "../src/core/types";

class MockResolver implements ResolverAdapter {
	async getAuthorizedActors(stepDef: StepDefinition, context: any) {
		// A simple mock: If it requires a manager, return the user's manager from context
		if (
			stepDef.approverStrategy === "DYNAMIC" &&
			stepDef.approverValue === "manager"
		)
			return [context.managerId];
		if (stepDef.approverStrategy === "USER") return [stepDef.approverValue];
		return [];
	}
}

// ==========================================
// 5. RUNNING THE DEMONSTRATION
// ==========================================
async function runDemo() {
	console.log("🚀 Starting Workflow Engine Demo...\n");

	// 1. Initialize our Adapters
	const definitions = new CodeDefinitionAdapter();
	const storage = new InMemoryStorage();
	const resolver = new MockResolver();

	// 2. Define a "Leave Request" workflow using the Builder
	const leaveWorkflow = new WorkflowBuilder("LEAVE_REQUEST")
		.addStep("MANAGER_APPROVAL", {
			name: "Manager Approval",
			approverStrategy: "DYNAMIC",
			approverValue: "manager", // dynamic value
			onApprove: "HR_APPROVAL",
			onReject: "TERMINATE",
		})
		.addStep("HR_APPROVAL", {
			name: "HR Approval",
			approverStrategy: "USER",
			approverValue: "hr_admin_99",
			onApprove: "COMPLETE",
			onReject: "MANAGER_APPROVAL", // Sends back to manager if rejected
		})
		.build();

	// Register the blueprint
	definitions.register(leaveWorkflow);

	// 3. Initialize the Engine
	const engine = new WorkflowEngine(definitions, storage, resolver);

	// --- SCENARIO EXECUTION ---

	// Context simulating database relations
	const employeeContext = { managerId: "boss_123" };

	console.log("Employee submits a leave request...");
	let instance = await engine.startWorkflow(
		"LEAVE_REQUEST",
		"leave_request",
		"req_123",
		"employee_1",
	);
	console.log(
		`State: [${instance.status}] waiting at step: ${instance.currentStepId}\n`,
	);

	console.log("A random user tries to approve it (Should Fail)...");
	try {
		await engine.submitAction(
			instance.id,
			"hacker_dude",
			"APPROVE",
			undefined,
			employeeContext,
		);
	} catch (e: any) {
		console.error(`❌ Blocked: ${e.message}\n`);
	}

	console.log("The actual Manager approves it...");
	await engine.submitAction(
		instance.id,
		"boss_123",
		"APPROVE",
		undefined,
		employeeContext,
	);
	instance = (await storage.getInstance(instance.id))!;
	console.log(
		`State: [${instance.status}] moved to step: ${instance.currentStepId}\n`,
	);

	console.log("HR finds an error and Rejects it (Send Back)...");
	await engine.submitAction(
		instance.id,
		"hr_admin_99",
		"REJECT",
		undefined,
		employeeContext,
	);
	instance = (await storage.getInstance(instance.id))!;
	console.log(
		`State: [${instance.status}] sent back to step: ${instance.currentStepId}\n`,
	);

	console.log("Manager fixes it and approves again...");
	await engine.submitAction(
		instance.id,
		"boss_123",
		"APPROVE",
		undefined,
		employeeContext,
	);
	instance = (await storage.getInstance(instance.id))!;
	console.log(
		`State: [${instance.status}] moved to step: ${instance.currentStepId}\n`,
	);

	console.log("HR finally approves it...");
	await engine.submitAction(
		instance.id,
		"hr_admin_99",
		"APPROVE",
		undefined,
		employeeContext,
	);
	instance = (await storage.getInstance(instance.id))!;
	console.log(`State: [${instance.status}]. Workflow finished! 🎉\n`);
}

runDemo();

