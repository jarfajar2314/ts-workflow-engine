<a id="readme-top"></a>

[![MIT License](https://img.shields.io/github/license/jarfajar2314/ts-workflow-engine.svg?style=for-the-badge)](file:///c:/Users/User/Codes/Other/workflow-engine/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)

<br />
<div align="center">
  <h2 align="center">@jarfajar/ts-workflow-engine</h2>

  <p align="center">
    A lightweight, code-first, framework-agnostic workflow and approval engine for Node.js & TypeScript. Build complex state machines, human-in-the-loop approval matrices, and dynamic routing with zero database lock-in.
  </p>
</div>

---

## Features

- ⚡ **Code-First & Type-Safe**: Define workflows in pure TypeScript using a clean, fluent `WorkflowBuilder` API.
- 🔌 **Adapter-Driven Architecture**: Core engine contains zero I/O logic. Plug in memory storage for unit tests or database adapters for production.
- 🗄️ **Official Prisma & PostgreSQL Support**: Persist workflow definitions, live execution states, and full audit action logs directly to PostgreSQL/SQL via `PrismaDefinitionAdapter` and `PrismaStorageAdapter`.
- 🔐 **Custom Identity Resolvers**: Decouple authorization logic (`ResolverAdapter`) to validate managers, roles, dynamic assignees, or custom user permissions.
- 🔄 **Advanced Routing**: Out-of-the-box support for sequential steps, branching, rejection terminations, and **Send Back** re-approval cycles.

---

## Installation

```bash
npm install @jarfajar/ts-workflow-engine
```

If using Prisma for database persistence:
```bash
npm install @prisma/client
npm install -D prisma
```

---

## Quick Start

### 1. In-Memory Usage (Testing & Rapid Prototyping)

```typescript
import {
	WorkflowBuilder,
	WorkflowEngine,
	CodeDefinitionAdapter,
	InMemoryStorage,
	ResolverAdapter,
	StepDefinition,
} from "@jarfajar/ts-workflow-engine";

// Define identity resolver
class SimpleResolver implements ResolverAdapter {
	async getAuthorizedActors(stepDef: StepDefinition, context: any) {
		if (stepDef.approverStrategy === "USER") return [stepDef.approverValue];
		return [];
	}
}

// 1. Define blueprint
const leaveWorkflow = new WorkflowBuilder("LEAVE_REQUEST")
	.addStep("MANAGER_APPROVAL", {
		name: "Manager Approval",
		approverStrategy: "USER",
		approverValue: "boss_user_1",
		onApprove: "HR_APPROVAL",
		onReject: "TERMINATE",
	})
	.addStep("HR_APPROVAL", {
		name: "HR Approval",
		approverStrategy: "USER",
		approverValue: "hr_admin_99",
		onApprove: "COMPLETE",
		onReject: "MANAGER_APPROVAL", // Send back to manager if rejected
	})
	.build();

// 2. Register blueprint and initialize engine
const definitions = new CodeDefinitionAdapter();
definitions.register(leaveWorkflow);

const storage = new InMemoryStorage();
const engine = new WorkflowEngine(definitions, storage, new SimpleResolver());

// 3. Start workflow instance
let instance = await engine.startWorkflow("LEAVE_REQUEST", "leave_doc", "req_101", "employee_1");

// 4. Submit approvals
await engine.submitAction(instance.id, "boss_user_1", "APPROVE");
await engine.submitAction(instance.id, "hr_admin_99", "APPROVE");
```

---

### 2. Database Storage with Prisma & PostgreSQL

```typescript
import { PrismaClient } from "@prisma/client";
import {
	WorkflowBuilder,
	WorkflowEngine,
	PrismaDefinitionAdapter,
	PrismaStorageAdapter,
} from "@jarfajar/ts-workflow-engine";

const prisma = new PrismaClient();

// 1. Initialize Prisma Adapters
const definitions = new PrismaDefinitionAdapter(prisma);
const storage = new PrismaStorageAdapter(prisma);
const engine = new WorkflowEngine(definitions, storage, myCustomResolver);

// 2. Save blueprint directly into PostgreSQL
const poWorkflow = new WorkflowBuilder("PURCHASE_ORDER")
	.addStep("MANAGER", {
		name: "Manager Review",
		approverStrategy: "DYNAMIC",
		approverValue: "managerId",
		onApprove: "FINANCE",
		onReject: "TERMINATE",
	})
	.addStep("FINANCE", {
		name: "Finance Audit",
		approverStrategy: "USER",
		approverValue: "finance_lead",
		onApprove: "COMPLETE",
		onReject: "MANAGER", // Send Back
	})
	.build();

await definitions.registerWorkflow(poWorkflow);

// 3. Start instance and submit actions
const instance = await engine.startWorkflow("PURCHASE_ORDER", "order", "po_501", "alex");
await engine.submitAction(instance.id, "sarah_manager", "APPROVE", "Approved", { managerId: "sarah_manager" });

// 4. Query PostgreSQL Audit Logs
const auditTrail = await storage.getLogsForInstance(instance.id);
console.log(auditTrail);
```

---

## Demos

Run the included runnable examples:

```bash
# Run in-memory demo
npm run demo

# Run Prisma + PostgreSQL demo (requires database connection in .env)
npm run demo:prisma
```

---

## Roadmap

- [x] Core Execution Engine & State Machine
- [x] Code-First Fluent Builder API (`WorkflowBuilder`)
- [x] Fast In-Memory Adapters for Unit Testing
- [x] Official Prisma & PostgreSQL Adapters (`PrismaDefinitionAdapter`, `PrismaStorageAdapter`)
- [ ] Drizzle ORM Storage & Definition Adapters
- [ ] Webhook / Event Emitter Lifecycle Hooks (`onStepChange`, `onWorkflowComplete`)
- [ ] Visual Dashboard UI for Workflow Inspection

---

## License

Distributed under the MIT License. See [LICENSE](file:///c:/Users/User/Codes/Other/workflow-engine/LICENSE) for more information.
