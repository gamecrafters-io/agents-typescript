<a id="readme-top"></a>

<div align="center">
  <h1>@gamecrafters/agents</h1>

  <p>
    Stateful AI agents with tool calling, session memory, and evaluation for
    TypeScript and Node.js.
  </p>

[![npm][npm-shield]][npm-url]
[![Node.js][node-shield]][npm-url]
[![Issues][issues-shield]][issues-url]
[![License][license-shield]][npm-url]

  <p>
    <a href="#usage">Usage</a>
    &middot;
    <a href="https://github.com/gamecrafters-io/agents-typescript/issues/new">Report a bug</a>
    &middot;
    <a href="https://github.com/gamecrafters-io/agents-typescript/issues/new">Suggest a feature</a>
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
    <li>
      <a href="#usage">Usage</a>
      <ul>
        <li><a href="#sessions">Sessions</a></li>
        <li><a href="#evaluation">Evaluation</a></li>
        <li><a href="#building-blocks">Building Blocks</a></li>
      </ul>
    </li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
  </ol>
</details>

## About The Project

`@gamecrafters/agents` builds agents on OpenAI's chat completions API. An agent
answers a query by asking the model, running the tools it calls, and asking
again until the model replies without calling any. Each session remembers its
conversation, and each run records the agent's state after every step, so you
can inspect, continue, and evaluate what the agent did.

Key features:

- Tools from plain functions, with arguments described by Zod schemas: the
  model sees JSON Schema, and each call is validated and given its defaults.
- Session memory, so a session's next query continues its conversation.
- Evaluation of a final response with an LLM judge, of a single tool-calling
  step, or of a whole run.
- Building blocks for your own workflows: messages, an LLM wrapper, output
  parsers, and a state machine.

### Built With

- [TypeScript](https://www.typescriptlang.org/)
- [OpenAI Node.js SDK](https://github.com/openai/openai-node)
- [Zod](https://zod.dev/)

[Back to top](#readme-top)

## Getting Started

### Prerequisites

- Node.js: 26 or later
- An OpenAI API key
- An ES module project, since the package has no CommonJS build

### Installation

1. Install the package, and Zod to describe tool arguments.

   ```sh
   npm install @gamecrafters/agents zod
   ```

2. Set your OpenAI API key in the environment.

   ```dotenv
   OPENAI_API_KEY=your_api_key
   ```

[Back to top](#readme-top)

## Usage

Give an agent a tool and ask it a question:

```typescript
import {Agent, tool} from '@gamecrafters/agents';
import * as z from 'zod';

const add = tool(({a, b}) => a + b, {
  name: 'add_numbers',
  description: 'Add two numbers.',
  parameters: z.object({a: z.number(), b: z.number()}),
});

const agent = new Agent({
  modelName: 'gpt-4o-mini',
  instructions: 'You are a calculator.',
  tools: [add],
});

const run = await agent.invoke('What is 2 + 3?');
console.log(run.getFinalState()?.messages.at(-1)?.content);
```

The agent calls `add_numbers`, sends the result back to the model, and prints
its answer, such as `2 + 3 = 5.`

### Sessions

Runs in the same session continue one conversation. The session defaults to
`default`.

```typescript
await agent.invoke('What is 2 + 3?', 'alice');
await agent.invoke('Add 10 to that.', 'alice'); // Sees the first answer.

agent.getSessionRuns('alice'); // Both runs, oldest first.
agent.resetSession('alice'); // Forgets them.
```

### Evaluation

Score a run against a test case:

```typescript
import {AgentEvaluator} from '@gamecrafters/agents';

const evaluator = new AgentEvaluator();
const result = evaluator.evaluateTrajectory(
  {
    id: 'add',
    description: 'Add two numbers with the tool.',
    userQuery: 'What is 2 + 3?',
    expectedTools: ['add_numbers'],
    maxSteps: 5,
  },
  run,
);
console.log(result.overallScore, result.feedback);
```

`evaluateSingleStep` checks the tool calls of one decision, and
`evaluateFinalResponse` has an LLM judge (`gpt-4o-mini`) rate an answer.

### Building Blocks

| Export                                                      | Use it to                                   |
| ----------------------------------------------------------- | ------------------------------------------- |
| `tool`, `Tool`                                              | Turn a function into a tool.                |
| `SystemMessage`, `UserMessage`, `AssistantMessage`, …       | Build a conversation.                       |
| `LLM`                                                       | Call chat completions with messages, tools. |
| `StringOutputParser`, `JsonOutputParser`, `ZodOutputParser` | Read a value from a reply.                  |
| `StateMachine`, `Step`, `EntryPoint`, `Termination`         | Build your own step-by-step workflow.       |
| `ShortTermMemory`                                           | Keep objects per session.                   |

[Back to top](#readme-top)

## Roadmap

TODO

[Back to top](#readme-top)

## Contributing

Use issues to discuss bugs and proposals. To submit a code change:

1. Fork the repository.
2. Create a branch: `git checkout -b feature/feature-name`.
3. Make your changes, then run the checks from the repository root:
   `npm install`, `npm run build`, `npm run typecheck`, `npm run lint`,
   `npm test`, and `npm run prettier`.
4. Commit your changes: `git commit -m "feat: Describe the change"`.
5. Push your branch: `git push origin feature/feature-name`.
6. Open a pull request describing the change and how you verified it.

[Back to top](#readme-top)

## License

This project is licensed under the MIT License.

[Back to top](#readme-top)

[npm-shield]: https://img.shields.io/npm/v/@gamecrafters/agents.svg?style=for-the-badge
[npm-url]: https://www.npmjs.com/package/@gamecrafters/agents
[node-shield]: https://img.shields.io/node/v/@gamecrafters/agents.svg?style=for-the-badge
[issues-shield]: https://img.shields.io/github/issues/gamecrafters-io/agents-typescript.svg?style=for-the-badge
[issues-url]: https://github.com/gamecrafters-io/agents-typescript/issues
[license-shield]: https://img.shields.io/npm/l/@gamecrafters/agents.svg?style=for-the-badge
