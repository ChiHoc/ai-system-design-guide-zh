# 构建工具使用智能体（Tool-Use Agents）

本章讲解工具使用智能体（Tool-Use Agents）的工程实践：设计 LLM（Large Language Model）可稳定调用的工具模式（tool schemas）、构建承载这些工具的 MCP（Model Context Protocol）服务器、将工具编排为工作流，并测试整套系统。这些模式决定了一个方案是停留在演示，还是能够进入生产部署。

## 目录

- [为 LLM 设计工具模式](#为-llm-设计工具模式)
- [MCP 服务器创建](#mcp-服务器创建)
- [工具注册与发现](#工具注册与发现)
- [输入校验与输出格式化](#输入校验与输出格式化)
- [工具编排：串联工具](#工具编排-串联工具)
- [构建自定义 Agent Skills](#构建自定义-agent-skills)
- [创建函数调用（Function-Calling）端点](#创建函数调用-function-calling-端点)
- [测试工具使用智能体](#测试工具使用智能体)
- [工具使用的可观测性（Observability）](#工具使用的可观测性-observability)
- [常见错误与反模式](#常见错误与反模式)
- [工具版本管理与向后兼容性](#工具版本管理与向后兼容性)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 为 LLM 设计工具模式

工具模式是 LLM 与你的系统之间的契约。设计良好的模式可以减少幻觉参数（hallucinated arguments）、防止误用，并让模型的工具选择更加可靠。

### 优秀工具定义的解剖

```json
{
  "name": "search_customers",
  "description": "Search for customers by name, email, or account ID. Returns up to 10 matching customer records. Use this when the user asks about a specific customer. Do NOT use this for aggregate queries like 'how many customers do we have'.",
  "input_schema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search term: customer name, email address, or account ID (e.g., 'john@acme.com' or 'ACC-12345')"
      },
      "limit": {
        "type": "integer",
        "description": "Max results to return (1-10). Default: 5",
        "default": 5,
        "minimum": 1,
        "maximum": 10
      }
    },
    "required": ["query"]
  }
}
```

### 模式设计规则

**1. 精准命名**：使用 `verb_noun` 形式。应使用 `search_customers`，而不是 `search` 或 `customer_tool`。

**2. 说明何时不要使用**：模型也需要负面示例。“请勿用于聚合查询（aggregate queries）”比只列出可用场景更能防止误用。

**3. 提供参数示例**：在描述字符串中包含示例值。模型会用这些值来校准输出。

**4. 约束取值范围**：使用 `minimum`、`maximum`、`enum` 和 `pattern` 在模式层面阻止无效参数，而不是在处理器里兜底。

**5. 保持工具原子性**：一个工具只做一件事。避免使用一个 `manage_customer` 工具同时完成创建、读取、更新和删除，应拆分为四个工具。

**6. 使用 `strict: true`**：Anthropic 的 strict 模式保证模型输出与模式完全一致。生产环境中应始终启用。

```
Good Tool Design:                    Bad Tool Design:

+-------------------+                +-------------------+
| search_customers  |                | customer_tool     |
| - query (string)  |                | - action (string) |
| - limit (int 1-10)|                | - data (object)   |
+-------------------+                | - options (any)   |
| create_customer   |                +-------------------+
| - name (string)   |                "action" can be
| - email (string)  |                "search", "create",
+-------------------+                "update", "delete"
| update_customer   |                => model confused,
| - id (string)     |                   schema too loose,
| - fields (object) |                   hard to validate
+-------------------+
```

---

## MCP 服务器创建

MCP 服务器是独立进程，用于向任何兼容 MCP 的客户端（Claude、GPT、基于 Llama 的 agents）暴露工具、资源和提示。你只需编写一次服务器，任何 LLM 都可以使用它。

### MCP 架构

```
+------------------+          JSON-RPC           +------------------+
|                  |  ========================>  |                  |
|   MCP Client     |                             |   MCP Server     |
|   (AI App)       |  <========================  |   (Your Code)    |
|                  |                             |                  |
|  - Claude Code   |  Transport:                 |  Exposes:        |
|  - Custom Agent  |  - stdio (local)            |  - Tools         |
|  - IDE Plugin    |  - Streamable HTTP (remote)  |  - Resources     |
|                  |                             |  - Prompts       |
+------------------+                             +------------------+
```

### TypeScript MCP 服务器

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "customer-service", version: "1.0.0" });

server.tool(
  "search_customers",
  "Search customers by name, email, or ID. Returns up to 10 matches.",
  {
    query: z.string().describe("Search term: name, email, or account ID"),
    limit: z.number().min(1).max(10).default(5).describe("Max results"),
  },
  async ({ query, limit }) => ({
    content: [{ type: "text",
      text: JSON.stringify(await db.customers.search(query, limit), null, 2) }],
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Python MCP 服务器（FastMCP）

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("customer-service")

@mcp.tool()
async def search_customers(query: str, limit: int = 5) -> str:
    """Search customers by name, email, or ID. Returns up to 10 matches.
    Args:
        query: Search term - customer name, email, or account ID
        limit: Max results to return (1-10, default 5)
    """
    return json.dumps(await db.customers.search(query, limit), indent=2)
```

两套 SDK 遵循相同模式：创建服务器、用类型化模式注册工具、连接传输层。TypeScript SDK 使用 Zod 进行校验；Python 使用类型标注（type hints）和 docstrings。

### 部署模式

| 模式 | 传输方式 | 使用场景 |
|------|-----------|----------|
| 本地（stdio） | stdin/stdout 管道 | 桌面工具、IDE 插件 |
| 远程（Streamable HTTP） | HTTP + SSE | 云服务、共享服务器 |
| 混合 | 两者都支持 | 本地开发，远程部署 |

---

## 工具注册与发现

在生产环境中，智能体需要动态发现可用工具，而不是硬编码工具列表。

### 静态注册

在配置文件中声明 MCP 服务器（例如 `claude_desktop_config.json`）。每个条目将服务器名称映射到命令、参数和可选环境变量。它简单，但不够灵活——每个服务器都会在启动时加载，不管是否相关。

### 动态发现（Tool Search）

Anthropic 的 Tool Search（2025）解决了模式过载问题。与其把 200 个工具模式全部加载进上下文（这会降低推理质量），不如让智能体发送一个轻量级搜索查询，只返回 3-5 个相关工具模式。这样上下文窗口就能聚焦于推理，而不是解析未使用的模式。

### MCP 发现协议

MCP 客户端通过标准 JSON-RPC 方法发现能力：`tools/list` 返回可用工具，`resources/list` 返回数据资源，`prompts/list` 返回提示模板。这使得运行时发现成为可能，而不需要硬编码。

---

## 输入校验与输出格式化

### 输入校验分层

```
+---------------------+
|  Schema Validation   |  <-- JSON Schema / Zod / Pydantic
|  (type, range, enum) |      Catches: wrong types, out-of-range
+----------+----------+
           |
           v
+---------------------+
|  Business Validation |  <-- Your handler code
|  (exists, permitted) |      Catches: invalid IDs, unauthorized
+----------+----------+
           |
           v
+---------------------+
|  Execution           |  <-- Actual operation
+---------------------+
```

始终在两个层面都进行校验。模式校验用于捕获格式错误输入。业务校验用于捕获语义上无效的输入。

```python
@mcp.tool()
async def transfer_funds(
    from_account: str,
    to_account: str,
    amount: float
) -> str:
    """Transfer funds between accounts."""
    # Schema already enforced types via type hints

    # Business validation
    if amount <= 0:
        return "Error: Amount must be positive."
    if amount > 10000:
        return "Error: Transfers over $10,000 require manual approval."
    if from_account == to_account:
        return "Error: Cannot transfer to the same account."

    from_acct = await db.accounts.get(from_account)
    if not from_acct:
        return f"Error: Account {from_account} not found."

    # Execute
    result = await db.transfers.execute(from_account, to_account, amount)
    return f"Transferred ${amount:.2f}. Confirmation: {result.id}"
```

### 输出格式化

当模型需要基于结果继续推理时，返回结构化数据。当前结果已经最终确定时，返回人类可读文本。

```python
# Good: structured for further reasoning
return json.dumps({
    "customers": [
        {"id": "ACC-123", "name": "Jane Smith", "email": "jane@acme.com"},
        {"id": "ACC-456", "name": "John Doe", "email": "john@acme.com"}
    ],
    "total_matches": 2,
    "has_more": False
})

# Bad: unstructured blob
return "Found Jane Smith (ACC-123, jane@acme.com) and John Doe (ACC-456, john@acme.com)"
```

---

## 工具编排：串联工具

真实任务通常需要多个工具按顺序调用。常见有两种编排模式：

### 模式 1：由 LLM 编排的串联（LLM-Orchestrated Chaining）

LLM 根据前一个结果决定下一步调用哪个工具：

```
User: "Find customer Jane Smith and create a high-priority ticket for her billing issue"

Turn 1:  LLM -> search_customers("Jane Smith")
         Result: {"id": "ACC-123", "name": "Jane Smith", ...}

Turn 2:  LLM -> create_ticket("ACC-123", "Billing issue", "...", "high")
         Result: "Ticket TK-789 created."

Turn 3:  LLM -> "I found Jane Smith (ACC-123) and created ticket TK-789."
```

每次工具调用都是一次独立的 API 往返（round-trip）。模型会在各次调用之间进行推理。

### 模式 2：程序化工具调用（Programmatic Tool Calling）

Anthropic 的 programmatic tool calling（2025）允许模型生成代码，在没有往返的情况下串联工具：

```
LLM generates code:
  customer = search_customers("Jane Smith")
  if customer.results:
    ticket = create_ticket(customer.results[0].id, ...)
    return f"Created {ticket.id} for {customer.results[0].name}"
  else:
    return "Customer not found"
```

这会作为一次 API 调用执行，将延迟从 3 次往返降低到 1 次。

### 模式 3：服务端组合（Server-Side Composition）

在 MCP 服务器内部组合工具——一个 `resolve_customer_issue` 工具内部调用 `search` 和 `create_ticket`，把多步逻辑对 LLM 隐藏起来。对于固定、定义明确的工作流，而 LLM 不需要在步骤之间推理的场景，应使用这种方式。

### 何时使用各模式

| 模式 | 延迟 | 灵活性 | 最适合场景 |
|---------|---------|-------------|----------|
| LLM 编排 | 高（N 次往返） | 非常高 | 复杂、分支逻辑 |
| 程序化 | 低（1 次往返） | 高 | 线性链路、批处理 |
| 服务端组合 | 最低 | 低 | 固定、常见工作流 |

---

## 构建自定义 Agent Skills

Agent Skills（Anthropic，2025）是一组可动态加载的指令、工具和资源。一个 skill 就是一个文件夹：

```
my-skill/
  SKILL.md          # Instructions the agent loads into system prompt
  tools/            # MCP tool implementations
  resources/        # Data files, templates, schemas
  tests/            # Evaluation cases
```

在运行时，SkillManager 会注册可用 skills 并按需激活它们——把 skill 的指令注入系统提示词（system prompt），并把其工具加入可用工具集。这样可以让基础 agent 保持轻量，同时支持深度专精。

---

## 创建函数调用（Function-Calling）端点

为了让你的 API 能被任意 LLM 调用，可以使用 FastAPI 并结合 Pydantic 模型来暴露。自动生成的 OpenAPI 规范（`/openapi.json`）也可以充当函数调用的工具模式（tool schema）。你也可以将同样的逻辑封装进 MCP 服务器，以便与 Claude、GPT 或其他兼容 MCP 的客户端直接集成。

---

## 测试工具使用智能体

### 三层测试

```
+---------------------------+
|   Eval Suites             |  End-to-end: does the agent
|   (Agent + LLM + Tools)  |  complete the task?
+-------------+-------------+
              |
+-------------v-------------+
|   Integration Tests       |  Does tool X work correctly
|   (Tool + Dependencies)   |  with real DB / API?
+-------------+-------------+
              |
+-------------v-------------+
|   Unit Tests              |  Does validation logic
|   (Tool Logic Only)       |  handle edge cases?
+---------------------------+
```

### 工具单元测试

对每个工具处理器进行隔离测试，并模拟依赖项。覆盖内容包括：输入校验边界条件（超出范围值、缺失字段）、错误信息质量（是否能指导模型恢复）、输出格式（有效 JSON、正确模式）。

### Agent 行为评测集

建立一个包含 100+ 条真实查询及其预期结果的数据集：

```python
eval_cases = [
    {
        "input": "Find Jane Smith's account and check her last payment",
        "expected_tools": ["search_customers", "get_payment_history"],
        "max_tool_calls": 5,
    },
    {
        "input": "What is the meaning of life?",
        "expected_tools": [],  # Should NOT call any tools
        "max_tool_calls": 0,
    },
]
```

对于每个用例，衡量：工具选择准确率（是否选对工具？）、参数质量（参数是否正确？）、任务完成率，以及效率（工具调用次数）。每次模型版本变更和每次工具模式变更后都要运行评测。

---

## 工具使用的可观测性（Observability）

每次工具调用都应记录：trace/span ID、时间戳、工具名、输入参数、输出大小、延迟、状态、所用模型、token 用量，以及 session ID。

### 关键指标

| 指标 | 衡量内容 | 告警阈值 |
|--------|-----------------|-----------------|
| 工具调用成功率 | 返回有效结果的调用占比 | < 95% |
| 工具选择准确率 | 是否选对了工具 | < 90% |
| 平均每任务工具调用数 | 工具使用效率 | > 基线的 2 倍 |
| 单次工具调用延迟 | 工具处理器响应时间 | > 5s（p99） |
| 幻觉参数（Hallucinated arguments） | 即使经过模式校验仍出现无效参数 | > 2% |
| 每任务成本 | LLM + 工具执行总成本 | > 预算 |

### 链路追踪架构

```
+-------------+     +----------------+     +--------------+
|  Agent      |---->|  Tool Handler  |---->|  Backend     |
|  (LLM call) |     |  (MCP Server)  |     |  (DB/API)    |
+------+------+     +--------+-------+     +------+-------+
       |                     |                     |
       v                     v                     v
+------+---------------------+---------------------+------+
|                    Trace Collector                       |
|              (OpenTelemetry / Langfuse)                  |
+---------------------------+------------------------------+
                            |
                            v
                   +--------+--------+
                   |   Dashboard     |
                   |   - Success %   |
                   |   - Latency     |
                   |   - Cost        |
                   +-----------------+
```

---

## 常见错误与反模式

| 反模式 | 问题 | 修复 |
|-------------|---------|-----|
| 工具过载 | 50+ 个工具会降低选择准确率 | 使用动态发现，每轮只加载 5-10 个工具 |
| 描述模糊 | “处理客户操作”太过宽泛 | 补充何时使用、何时不使用、示例 |
| 万能工具（God tools） | 一个带 `action` 参数的工具包办所有事 | 拆分为原子化工具，每个工具只做一个操作 |
| 缺少错误上下文 | 工具只返回“Error”而没有细节 | 返回可执行的提示：“ACC-999 not found. Use search_customers...” |
| 输出无结构 | 工具返回的是需要模型解析的散文 | 需要结构化推理时返回 JSON |
| 没有幂等性 | `create_ticket` 被调用两次会创建重复项 | 接收幂等键，在创建前检查 |
| 暴露内部 ID | 工具要求数据库 UUID，而模型无法知道这些值 | 接受人类可读标识符，内部再解析 |
| 忽略速率限制 | 智能体循环发起 100 次 API 调用，结果被限流 | 在处理器中做退避（backoff），返回“retry in X seconds” |

---

## 工具版本管理与向后兼容性

随着工具的演进，你必须保持与依赖它们的 agent（智能体）的兼容性。

**规则：**
1. **加法性变更**（新增可选参数）：无需提升版本。旧调用仍可正常工作。
2. **破坏性变更**（重命名、移除参数、语义变更）：需创建一个新工具名称并使用新 schema。保留旧工具继续运行，并在其说明中添加“DEPRECATED: Use new_tool instead”。所有弃用调用（deprecated call）都应记录（log）以便监控。
3. **不得移除工具**，直到确认没有活跃 agent 依赖它为止。

---

## 面试题

### 问：你需要给一个 LLM agent 提供 200 个内部工具（internal tools）访问权限。你会如何处理 schema 过载？

**优秀回答：**
我不会将全部 200 个工具 schema 加载到上下文（context）中。相反，我会采用两阶段方案。第一阶段是工具发现（tool discovery）阶段，让 agent 先描述它需要执行的任务，并通过轻量检索（embedding 相似度或关键词匹配）返回最相关的 5–10 个工具 schema。第二阶段是工具执行阶段，仅将被选中的工具加入上下文，供实际的 LLM 调用。

这与 Anthropic 的 Tool Search 模式一致。发现步骤可作为一次单独的、成本更低的 LLM 调用，甚至可以是非 LLM 的检索流程。关键洞见在于，与任务无关的工具 schema 占用的上下文窗口（context window）空间，会直接降低模型推理质量。我会将工具选择准确率作为核心指标来衡量——如果 agent 应该调用 `get_customer_by_id` 却调用了 `search_customers`，则说明发现阶段需要调优。

对于 MCP 实现，我会将工具按领域服务器（domain-specific servers）分组（例如 customer-service、billing、analytics），并且只连接当前对话相关的服务器。

### 问：为一个处理客户支持（customer support）的 tool-use agent 设计一套测试策略。

**优秀回答：**
我会在三层进行测试。第一层是每个工具处理器（tool handler）的单元测试：校验输入边界用例、错误信息和输出格式。这些测试在每次提交（commit）时通过 CI 运行，并使用 mock 依赖。

第二层是集成测试（integration tests），验证工具在真实（staging）数据库上的行为。例如，`create_ticket` 实际创建一条记录，而 `search_customers` 能返回该记录。这类测试可捕捉工具与后端之间的 schema 漂移。

第三层是完整 agent 的评测套件（eval suites），覆盖 LLM 与工具的联动。我会构建一个包含 100+ 条真实场景客户查询的数据集（dataset），并标注期望的工具调用序列与输出标准。评测指标包括工具选择准确率（是否选择了正确的工具？）、参数质量（参数是否正确？）、任务完成率（是否解决问题？）和效率（消耗了多少次工具调用？）。

我会在每次模型版本变更和每次工具 schema 变更时都运行评测。若 schema 变更后工具选择准确率下降 2%，说明需要修订描述（description），而非模型本身。

---

## 参考资料

- Anthropic. "Tool Use with Claude" API Documentation (2025)
- Model Context Protocol. "Build an MCP Server" (2025)
- MCP TypeScript SDK: github.com/modelcontextprotocol/typescript-sdk
- MCP Python SDK: github.com/modelcontextprotocol/python-sdk
- Anthropic. "Introducing Advanced Tool Use" (2025)
- Anthropic. "Agent Skills" Beta Documentation (2025)

---

*Previous: [Computer-Use Agents](04-computer-use-agents.md)*
