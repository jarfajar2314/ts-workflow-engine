import { PrismaClient } from "@prisma/client";
import {
	WorkflowBuilder,
	WorkflowEngine,
	PrismaDefinitionAdapter,
	PrismaStorageAdapter,
	ResolverAdapter,
	StepDefinition,
} from "../src";

// 1. Custom identity resolver matching your application's user/role permissions
class SimpleResolver implements ResolverAdapter {
	async getAuthorizedActors(stepDef: StepDefinition, context: any): Promise<string[]> {
		if (stepDef.approverStrategy === "DYNAMIC" && context) {
			return [context[stepDef.approverValue]];
		}
		if (stepDef.approverStrategy === "USER") {
			return [stepDef.approverValue];
		}
		return [];
	}
}

async function runPrismaDemo() {
	console.log("🚀 Starting Prisma + PostgreSQL Workflow Engine Demo...\n");

	// 2. Instantiate Prisma Client
	const prisma = new PrismaClient();

	try {
		// 3. Initialize Prisma Adapters
		const definitions = new PrismaDefinitionAdapter(prisma);
		const storage = new PrismaStorageAdapter(prisma);
		const resolver = new SimpleResolver();

		// 4. Build a Purchase Order approval workflow
		const poWorkflow = new WorkflowBuilder("PURCHASE_ORDER")
			.addStep("MANAGER_APPROVAL", {
				name: "Department Manager Approval",
				approverStrategy: "DYNAMIC",
				approverValue: "managerId",
				onApprove: "FINANCE_AUDIT",
				onReject: "TERMINATE",
			})
			.addStep("FINANCE_AUDIT", {
				name: "Finance Team Audit",
				approverStrategy: "USER",
				approverValue: "finance_lead_1",
				onApprove: "COMPLETE",
				onReject: "MANAGER_APPROVAL", // Send Back to Manager if numbers need correction
			})
			.build();

		// 5. Save/Register the blueprint definition into PostgreSQL (workflow_definitions table)
		console.log("📝 Registering 'PURCHASE_ORDER' blueprint into PostgreSQL...");
		await definitions.registerWorkflow(poWorkflow);
		console.log("✅ Blueprint saved to database.\n");

		// 6. Initialize the core Engine with Dependency Injection
		const engine = new WorkflowEngine(definitions, storage, resolver);

		// 🔔 Register lifecycle event listeners
		engine.on("stepChange", (event) => {
			console.log(`  🔔 [EVENT] Step changed from ${event.fromStepId} -> ${event.toStepId} by ${event.actorId}`);
		});

		engine.on("workflowComplete", (event) => {
			console.log(`  🎉 [EVENT] Workflow completed! Finished at: ${event.instance.completedAt?.toISOString()}`);
		});

		// Context simulating app data (e.g. employee's manager and request payload)
		const employeeContext = { managerId: "boss_sarah", amount: 15000, department: "Engineering" };

		// 7. Start a new workflow instance in PostgreSQL with context
		console.log("🎬 Initiating new Purchase Order workflow (PO #1092)...");
		let instance = await engine.startWorkflow(
			"PURCHASE_ORDER",
			"purchase_order",
			"po_1092",
			"employee_alex",
			employeeContext
		);
		console.log(`📌 Created Instance ID: ${instance.id}`);
		console.log(`   Status: [${instance.status}] | Step: ${instance.currentStepId} | LockVersion: v${instance.lockVersion}\n`);

		// 8. Step 1: Manager Approves
		console.log("👤 Manager Sarah approves PO #1092...");
		await engine.submitAction(instance.id, "boss_sarah", "APPROVE", "Budget approved", employeeContext);
		instance = (await storage.getInstance(instance.id))!;
		console.log(`   Status: [${instance.status}] | Advanced to: ${instance.currentStepId} | LockVersion: v${instance.lockVersion}\n`);

		// 9. Step 2: Finance requests changes (Send Back to Manager)
		console.log("🔍 Finance Lead Pam inspects and Rejects (Send Back to Manager)...");
		await engine.submitAction(instance.id, "finance_lead_1", "REJECT", "Needs vendor tax ID", employeeContext);
		instance = (await storage.getInstance(instance.id))!;
		console.log(`   Status: [${instance.status}] | Sent Back to: ${instance.currentStepId} | LockVersion: v${instance.lockVersion}\n`);

		// 10. Step 1: Manager Re-approves with updated vendor info
		console.log("👤 Manager Sarah updates vendor tax ID and Re-approves...");
		await engine.submitAction(instance.id, "boss_sarah", "APPROVE", "Tax ID added", employeeContext);
		instance = (await storage.getInstance(instance.id))!;
		console.log(`   Status: [${instance.status}] | Returned to: ${instance.currentStepId} | LockVersion: v${instance.lockVersion}\n`);

		// 11. Step 2: Finance Approves -> Workflow Completed
		console.log("🎉 Finance Lead Pam gives final approval...");
		await engine.submitAction(instance.id, "finance_lead_1", "APPROVE", "Verified & paid", employeeContext);
		instance = (await storage.getInstance(instance.id))!;
		console.log(`   Status: [${instance.status}] | LockVersion: v${instance.lockVersion} | CompletedAt: ${instance.completedAt?.toISOString()} ✨\n`);

		// 12. Retrieve full audit trail from PostgreSQL workflow_action_logs table
		console.log("📜 Full PostgreSQL Audit Trail:");
		const logs = await storage.getLogsForInstance(instance.id);
		logs.forEach((log, index) => {
			console.log(
				`   [${index + 1}] ${log.action.padEnd(8)} | Actor: ${log.actorId.padEnd(14)} | From: ${(log.fromStepId || "START").padEnd(16)} -> To: ${(log.toStepId || "END").padEnd(16)} | Comment: ${log.comment || "-"}`
			);
		});

	} catch (error) {
		console.error("❌ Demo encountered an error:", error);
	} finally {
		await prisma.$disconnect();
	}
}

runPrismaDemo();

