import { describe, it, expect, beforeEach, vi } from "vitest";
import {
	WorkflowEngine,
	WorkflowBuilder,
	CodeDefinitionAdapter,
	InMemoryStorage,
	ResolverAdapter,
	StepDefinition,
	EventAdapter,
	WorkflowEventMap,
} from "../src";

class TestResolver implements ResolverAdapter {
	async getAuthorizedActors(
		stepDef: StepDefinition,
		_context: any,
	): Promise<string[]> {
		if (stepDef.approverStrategy === "USER") {
			return [stepDef.approverValue];
		}
		return [];
	}
}

describe("WorkflowEngine Event Emitter & Lifecycle Hooks", () => {
	let definitions: CodeDefinitionAdapter;
	let storage: InMemoryStorage;
	let resolver: TestResolver;
	let engine: WorkflowEngine;

	beforeEach(() => {
		definitions = new CodeDefinitionAdapter();
		storage = new InMemoryStorage();
		resolver = new TestResolver();
		engine = new WorkflowEngine(definitions, storage, resolver);

		const workflow = new WorkflowBuilder("EVENT_TEST_WORKFLOW")
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
				onReject: "STEP_1",
			})
			.build();

		definitions.register(workflow);
	});

	it("emits 'workflowStart' when a workflow is initiated", async () => {
		const startListener = vi.fn();
		engine.on("workflowStart", startListener);

		const instance = await engine.startWorkflow(
			"EVENT_TEST_WORKFLOW",
			"document",
			"doc_123",
			"creator_user",
		);

		expect(startListener).toHaveBeenCalledTimes(1);
		const payload: WorkflowEventMap["workflowStart"] =
			startListener.mock.calls[0][0];
		expect(payload.instance.id).toBe(instance.id);
		expect(payload.blueprint.code).toBe("EVENT_TEST_WORKFLOW");
		expect(payload.actorId).toBe("creator_user");
	});

	it("emits 'stepChange' when advancing steps or sending back", async () => {
		const stepChangeListener = vi.fn();
		engine.on("stepChange", stepChangeListener);

		const instance = await engine.startWorkflow(
			"EVENT_TEST_WORKFLOW",
			"document",
			"doc_124",
			"creator_user",
		);

		// Approve STEP_1 -> STEP_2
		await engine.submitAction(instance.id, "user_1", "APPROVE", "Looks good");
		expect(stepChangeListener).toHaveBeenCalledTimes(1);
		let payload: WorkflowEventMap["stepChange"] =
			stepChangeListener.mock.calls[0][0];
		expect(payload.fromStepId).toBe("STEP_1");
		expect(payload.toStepId).toBe("STEP_2");
		expect(payload.action).toBe("APPROVE");
		expect(payload.actorId).toBe("user_1");
		expect(payload.comment).toBe("Looks good");

		// Reject STEP_2 -> Send back to STEP_1
		await engine.submitAction(instance.id, "user_2", "REJECT", "Fix details");
		expect(stepChangeListener).toHaveBeenCalledTimes(2);
		payload = stepChangeListener.mock.calls[1][0];
		expect(payload.fromStepId).toBe("STEP_2");
		expect(payload.toStepId).toBe("STEP_1");
		expect(payload.action).toBe("REJECT");
		expect(payload.comment).toBe("Fix details");
	});

	it("emits 'workflowComplete' when a workflow finishes", async () => {
		const completeListener = vi.fn();
		engine.on("workflowComplete", completeListener);

		const instance = await engine.startWorkflow(
			"EVENT_TEST_WORKFLOW",
			"document",
			"doc_125",
			"creator_user",
		);

		await engine.submitAction(instance.id, "user_1", "APPROVE");
		expect(completeListener).not.toHaveBeenCalled();

		await engine.submitAction(instance.id, "user_2", "APPROVE", "Final ok");
		expect(completeListener).toHaveBeenCalledTimes(1);
		const payload: WorkflowEventMap["workflowComplete"] =
			completeListener.mock.calls[0][0];
		expect(payload.instance.status).toBe("COMPLETED");
		expect(payload.fromStepId).toBe("STEP_2");
		expect(payload.actorId).toBe("user_2");
		expect(payload.comment).toBe("Final ok");
	});

	it("emits 'workflowReject' when a workflow is terminated", async () => {
		const rejectListener = vi.fn();
		engine.on("workflowReject", rejectListener);

		const instance = await engine.startWorkflow(
			"EVENT_TEST_WORKFLOW",
			"document",
			"doc_126",
			"creator_user",
		);

		await engine.submitAction(instance.id, "user_1", "REJECT", "Denied");
		expect(rejectListener).toHaveBeenCalledTimes(1);
		const payload: WorkflowEventMap["workflowReject"] =
			rejectListener.mock.calls[0][0];
		expect(payload.instance.status).toBe("REJECTED");
		expect(payload.fromStepId).toBe("STEP_1");
		expect(payload.actorId).toBe("user_1");
		expect(payload.comment).toBe("Denied");
	});

	it("triggers methods on registered EventAdapter interface", async () => {
		class CustomAuditAdapter implements EventAdapter {
			onWorkflowStart = vi.fn();
			onStepChange = vi.fn();
			onWorkflowComplete = vi.fn();
			onWorkflowReject = vi.fn();
			onError = vi.fn();
		}

		const adapter = new CustomAuditAdapter();
		const adapterEngine = new WorkflowEngine(definitions, storage, resolver, {
			eventAdapters: adapter,
		});

		const instance = await adapterEngine.startWorkflow(
			"EVENT_TEST_WORKFLOW",
			"doc",
			"doc_201",
			"user_1",
		);
		expect(adapter.onWorkflowStart).toHaveBeenCalledTimes(1);

		await adapterEngine.submitAction(instance.id, "user_1", "APPROVE");
		expect(adapter.onStepChange).toHaveBeenCalledTimes(1);

		await adapterEngine.submitAction(instance.id, "user_2", "APPROVE");
		expect(adapter.onWorkflowComplete).toHaveBeenCalledTimes(1);
	});

	it("isolates errors in event listeners and dispatches 'error' / 'onError'", async () => {
		const failingListener = vi.fn().mockImplementation(() => {
			throw new Error("Webhook service unavailable");
		});
		const errorListener = vi.fn();

		engine.on("stepChange", failingListener);
		engine.on("error", errorListener);

		const instance = await engine.startWorkflow(
			"EVENT_TEST_WORKFLOW",
			"document",
			"doc_301",
			"user_1",
		);

		// Action should succeed even though listener throws an error
		await expect(
			engine.submitAction(instance.id, "user_1", "APPROVE"),
		).resolves.not.toThrow();

		// Verify state was saved despite listener failure
		const updated = await storage.getInstance(instance.id);
		expect(updated?.currentStepId).toBe("STEP_2");

		// Verify error event was dispatched
		expect(errorListener).toHaveBeenCalledTimes(1);
		const errPayload: WorkflowEventMap["error"] = errorListener.mock.calls[0][0];
		expect(errPayload.event).toBe("stepChange");
		expect(errPayload.error.message).toBe("Webhook service unavailable");
	});
});
