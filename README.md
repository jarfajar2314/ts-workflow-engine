<a id="readme-top"></a>

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]
[![LinkedIn][linkedin-shield]][linkedin-url]

<br />
<div align="center">
  <!-- <a href="https://github.com/your_username/ts-workflow-engine">
    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Typescript_logo_2020.svg/512px-Typescript_logo_2020.svg.png" alt="Logo" width="80" height="80">
  </a> -->

<h3 align="center">Workflow Engine</h3>

  <p align="center">
    A lightweight, code-first, framework-agnostic workflow and approval engine for Node.js. Build complex state machines, human-in-the-loop approvals, and dynamic routing with zero database lock-in.
    <br />
    <a href="https://github.com/your_username/ts-workflow-engine"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/your_username/ts-workflow-engine">View Demo</a>
    &middot;
    <a href="https://github.com/your_username/ts-workflow-engine/issues/new?labels=bug&template=bug-report---.md">Report Bug</a>
    &middot;
    <a href="https://github.com/your_username/ts-workflow-engine/issues/new?labels=enhancement&template=feature-request---.md">Request Feature</a>
  </p>
</div>

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
  </ol>
</details>

## About The Project

Building robust approval matrices (like Leave Requests, Expense Claims, or Document Publishing) often results in messy, hardcoded database logic. **TS Workflow Engine** solves this by letting you define your business logic purely in TypeScript using a fluent Builder API.

Because it is built on the Adapter Pattern, the core engine has zero opinions about your database. You can run it entirely in memory for lightning-fast testing, or plug it into Prisma, TypeORM, or Drizzle for production.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

- [![TypeScript][TypeScript]][TypeScript-url]
- [![NodeJS][Node.js]][Node-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Getting Started

To get a local copy up and running follow these simple steps.

### Prerequisites

- npm
    ```sh
    npm install npm@latest -g
    ```

### Installation

1. Clone the repo
    ```sh
    git clone https://github.com/jarfajar2314/workflow-engine.git
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

## Usage

Define your workflow using the fluent WorkflowBuilder and run it instantly using the built-in InMemory adapters.

```typescript
import {
	WorkflowBuilder,
	WorkflowEngine,
	CodeDefinitionAdapter,
	InMemoryStorage,
} from "ts-workflow-engine";

// 1. Define your blueprint
const leaveWorkflow = new WorkflowBuilder("LEAVE_REQUEST", 1)
	.addStep("MANAGER_APPROVAL", {
		approverStrategy: "MANAGER",
		approverValue: "",
		onApprove: "HR_APPROVAL",
		onReject: "TERMINATE",
	})
	.addStep("HR_APPROVAL", {
		approverStrategy: "ROLE",
		approverValue: "hr_admin",
		onApprove: "COMPLETE",
		onReject: "MANAGER_APPROVAL",
	})
	.build();

// 2. Register the adapters
const definitions = new CodeDefinitionAdapter();
definitions.register(leaveWorkflow);

const storage = new InMemoryStorage();

// 3. Initialize the Engine
const engine = new WorkflowEngine(definitions, storage, myCustomResolver);

// 4. Start and progress a workflow
const instance = await engine.startWorkflow("LEAVE_REQUEST", "ref-123");
await engine.submitAction(instance.id, "boss_user_id", "APPROVE");
```

_For more examples, please refer to the [Documentation](https://example.com)_

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Roadmap

- [x] Core Execution Engine
- [x] Code-First Fluent Builder API
- [x] In-Memory Adapters for Testing
- [ ] Official Prisma Storage Adapter
- [ ] Drizzle ORM Storage Adapter
- [ ] Visualizer Dashboard UI

See the [open issues](https://github.com/your_username/ts-workflow-engine/issues) for a full list of proposed features (and known issues).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Top contributors:

<a href="https://github.com/jarfajar2314/workflow-engine/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=jarfajar2314/workflow-engine" alt="contrib.rocks image" />
</a>

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contact

Muhammad Fajar Yusuf Firdaus - mfajaryusuff@gmail.com

Project Link: [https://github.com/jarfajar2314/workflow-engine](https://github.com/jarfajar2314/workflow-engine)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[contributors-shield]: https://img.shields.io/github/contributors/your_username/ts-workflow-engine.svg?style=for-the-badge
[contributors-url]: https://github.com/your_username/ts-workflow-engine/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/your_username/ts-workflow-engine.svg?style=for-the-badge
[forks-url]: https://github.com/your_username/ts-workflow-engine/network/members
[stars-shield]: https://img.shields.io/github/stars/your_username/ts-workflow-engine.svg?style=for-the-badge
[stars-url]: https://github.com/your_username/ts-workflow-engine/stargazers
[issues-shield]: https://img.shields.io/github/issues/your_username/ts-workflow-engine.svg?style=for-the-badge
[issues-url]: https://github.com/your_username/ts-workflow-engine/issues
[license-shield]: https://img.shields.io/github/license/your_username/ts-workflow-engine.svg?style=for-the-badge
[license-url]: https://github.com/your_username/ts-workflow-engine/blob/master/LICENSE.txt
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://linkedin.com/in/linkedin_username
[TypeScript]: https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white
[TypeScript-url]: https://www.typescriptlang.org/
[Node.js]: https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white
[Node-url]: https://nodejs.org/
