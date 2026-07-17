<!-- Improved compatibility of back to top link: See: https://github.com/othneildrew/Best-README-Template/pull/73 -->
<a id="readme-top"></a>
<!--
*** Thanks for checking out the Best-README-Template. If you have a suggestion
*** that would make this better, please fork the repo and create a pull request
*** or simply open an issue with the tag "enhancement".
*** Don't forget to give the project a star!
*** Thanks again! Now go create something AMAZING! :D
-->

<!-- PROJECT SHIELDS -->
[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]
[![LinkedIn][linkedin-shield]][linkedin-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <h3 align="center">@jarfajar/ts-workflow-engine</h3>

  <p align="center">
    A lightweight, code-first, framework-agnostic workflow and approval engine for Node.js & TypeScript. Build complex state machines, human-in-the-loop approval matrices, and dynamic routing with zero database lock-in.
    <br />
    <a href="https://github.com/jarfajar2314/ts-workflow-engine"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/jarfajar2314/ts-workflow-engine">View Demo</a>
    &middot;
    <a href="https://github.com/jarfajar2314/ts-workflow-engine/issues/new?labels=bug&template=bug-report---.md">Report Bug</a>
    &middot;
    <a href="https://github.com/jarfajar2314/ts-workflow-engine/issues/new?labels=enhancement&template=feature-request---.md">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->
## About The Project

Building robust approval matrices (like Leave Requests, Expense Claims, or Document Publishing) often results in messy, hardcoded database logic. **TS Workflow Engine** solves this by letting you define your business logic purely in TypeScript using a fluent Builder API.

Because it is built on the Adapter Pattern, the core engine has zero opinions about your database. You can run it entirely in memory for lightning-fast testing, or plug in Prisma for production database persistence with PostgreSQL or SQL databases.

Key highlights:
- ⚡ **Code-First & Type-Safe**: Define workflows in pure TypeScript using a clean, fluent `WorkflowBuilder` API.
- 🔌 **Adapter-Driven Architecture**: Core engine contains zero I/O logic.
- 🗄️ **Official Prisma & PostgreSQL Support**: Persist workflow definitions, live execution states, and full audit action logs via `PrismaDefinitionAdapter` and `PrismaStorageAdapter`.
- 🔒 **Optimistic Concurrency Control (OCC)**: Built-in `lockVersion` safety prevents race conditions and concurrent mutation conflicts.
- ⚡ **Atomic Database Transactions**: Status updates and audit action logging execute inside single database transactions.
- 🔔 **Typed Lifecycle Events & Webhook Hooks**: Subscribe to `workflowStart`, `stepChange`, `workflowComplete`, `workflowReject`, and `error` events or integrate custom `EventAdapter` classes.
- 🔐 **Custom Identity Resolvers**: Decouple authorization logic (`ResolverAdapter`) to validate managers, roles, dynamic assignees, or custom user permissions.
- 🔄 **Advanced Routing**: Out-of-the-box support for sequential steps, branching, rejection terminations, and **Send Back** re-approval cycles.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

* [![TypeScript][TypeScript]][TypeScript-url]
* [![Node.js][Node.js]][Node-url]
* [![Prisma][Prisma]][Prisma-url]
* [![Vitest][Vitest]][Vitest-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->
## Getting Started

To get a local copy up and running follow these simple steps.

### Prerequisites

* npm
  ```sh
  npm install npm@latest -g
  ```

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/jarfajar2314/ts-workflow-engine.git
   ```
2. Install NPM packages
   ```sh
   npm install
   ```
3. Build the package
   ```sh
   npm run build
   ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE EXAMPLES -->
## Usage

### 1. In-Memory Usage (Testing & Prototyping)

```typescript
import {
  WorkflowBuilder,
  WorkflowEngine,
  CodeDefinitionAdapter,
  InMemoryStorage,
  ResolverAdapter,
  StepDefinition,
} from "@jarfajar/ts-workflow-engine";

class SimpleResolver implements ResolverAdapter {
  async getAuthorizedActors(stepDef: StepDefinition, context: any) {
    if (stepDef.approverStrategy === "USER") return [stepDef.approverValue];
    return [];
  }
}

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
    onReject: "MANAGER_APPROVAL",
  })
  .build();

const definitions = new CodeDefinitionAdapter();
definitions.register(leaveWorkflow);

const storage = new InMemoryStorage();
const engine = new WorkflowEngine(definitions, storage, new SimpleResolver());

// Listen for lifecycle events
engine.on("stepChange", (event) => {
  console.log(`Step transitioned: ${event.fromStepId} -> ${event.toStepId}`);
});

let instance = await engine.startWorkflow("LEAVE_REQUEST", "leave_doc", "req_101", "employee_1");
await engine.submitAction(instance.id, "boss_user_1", "APPROVE");
await engine.submitAction(instance.id, "hr_admin_99", "APPROVE");
```

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
const definitions = new PrismaDefinitionAdapter(prisma);
const storage = new PrismaStorageAdapter(prisma);
const engine = new WorkflowEngine(definitions, storage, myCustomResolver);

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
    onReject: "MANAGER",
  })
  .build();

await definitions.registerWorkflow(poWorkflow);

const instance = await engine.startWorkflow("PURCHASE_ORDER", "order", "po_501", "alex");
await engine.submitAction(instance.id, "sarah_manager", "APPROVE", "Approved", { managerId: "sarah_manager" });

const auditTrail = await storage.getLogsForInstance(instance.id);
```

### Runnable Demos

```bash
# Run in-memory demo
npm run demo

# Run Prisma + PostgreSQL demo
npm run demo:prisma
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ROADMAP -->
## Roadmap

- [x] Core Execution Engine & State Machine
- [x] Code-First Fluent Builder API (`WorkflowBuilder`)
- [x] In-Memory Adapters for Unit Testing
- [x] Official Prisma & PostgreSQL Adapters (`PrismaDefinitionAdapter`, `PrismaStorageAdapter`)
- [x] Webhook / Event Emitter Lifecycle Hooks (`onStepChange`, `onWorkflowComplete`, `EventAdapter`)
- [x] Optimistic Concurrency Control (OCC) & Atomic DB Transactions
- [ ] Drizzle ORM Storage Adapter
- [ ] Visualizer Dashboard UI

See the [open issues](https://github.com/jarfajar2314/ts-workflow-engine/issues) for a full list of proposed features (and known issues).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->
## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Top contributors:

<a href="https://github.com/jarfajar2314/ts-workflow-engine/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=jarfajar2314/ts-workflow-engine" alt="contrib.rocks image" />
</a>

<!-- LICENSE -->
## License

Distributed under the MIT License. See `LICENSE` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->
## Contact

Muhammad Fajar Yusuf Firdaus - [@jarfajar2314](https://github.com/jarfajar2314) - mfajaryusuff@gmail.com

Project Link: [https://github.com/jarfajar2314/ts-workflow-engine](https://github.com/jarfajar2314/ts-workflow-engine)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ACKNOWLEDGMENTS -->
## Acknowledgments

* [Best-README-Template](https://github.com/othneildrew/Best-README-Template)
* [Prisma ORM](https://www.prisma.io/)
* [Vitest](https://vitest.dev/)
* [tsup](https://tsup.repo.i/)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->
[contributors-shield]: https://img.shields.io/github/contributors/jarfajar2314/ts-workflow-engine.svg?style=for-the-badge
[contributors-url]: https://github.com/jarfajar2314/ts-workflow-engine/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/jarfajar2314/ts-workflow-engine.svg?style=for-the-badge
[forks-url]: https://github.com/jarfajar2314/ts-workflow-engine/network/members
[stars-shield]: https://img.shields.io/github/stars/jarfajar2314/ts-workflow-engine.svg?style=for-the-badge
[stars-url]: https://github.com/jarfajar2314/ts-workflow-engine/stargazers
[issues-shield]: https://img.shields.io/github/issues/jarfajar2314/ts-workflow-engine.svg?style=for-the-badge
[issues-url]: https://github.com/jarfajar2314/ts-workflow-engine/issues
[license-shield]: https://img.shields.io/github/license/jarfajar2314/ts-workflow-engine.svg?style=for-the-badge
[license-url]: https://github.com/jarfajar2314/ts-workflow-engine/blob/master/LICENSE
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://linkedin.com/in/mfajaryusuff
[TypeScript]: https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white
[TypeScript-url]: https://www.typescriptlang.org/
[Node.js]: https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white
[Node-url]: https://nodejs.org/
[Prisma]: https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white
[Prisma-url]: https://www.prisma.io/
[Vitest]: https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white
[Vitest-url]: https://vitest.dev/