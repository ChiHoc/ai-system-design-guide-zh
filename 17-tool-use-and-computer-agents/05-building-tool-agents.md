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

**4. 约束取值范围**：使用 `minimum`、`maximum`、`enum` 和 `pattern` 描述并约束有效参数。处理器中仍要保留相同校验：strict 模式并不强制所有关键字（见规则 `6`）。

**5. 保持工具原子性**：一个工具只做一件事。避免使用一个 `manage_customer` 工具同时完成创建、读取、更新和删除，应拆分为四个工具。

**6. 使用 `strict: true`**：Anthropic 的 strict 模式保证工具输入通过 schema 校验。生产环境应启用，同时为每个对象设置 `additionalProperties: false` 和 `required` 列表。它不涵盖数值约束（`minimum`、`maximum`、`multipleOf`）、字符串长度或递归 schema；Python 和 TypeScript SDK 的 schema 辅助工具会在发送前剥除这些约束，并在客户端检查，这也是处理器端必须校验的又一个原因。

**7. 不要为了取得 JSON 而强制工具调用**：在 Claude Fable `5.1`、Mythos `5.1`、Opus `5.5` 和 Sonnet `5.5` 上，`tool_choice` 设为 `any` 或 `tool` 会返回 HTTP `400`（`auto` 和 `none` 仍可用）。可使用 `auto`，在提示词中点名工具，配合 `strict: true` 保证参数符合 schema，并检查模型是否真的调用了工具。如果强制调用只是为了提取结构化数据，应改用结构化输出（`output_config.format`）。强制工具调用如今是旧技术，框架也已跟进：langchain-anthropic 的 `with_structured_output` 在这些模型上改为使用 JSON Schema 输出（Fable 和 Opus `5.5` 自 `1.7.3` 起，Sonnet `5.5` 自 `1.7.5` 起）。

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

当前规范修订版为 **`2026-07-28`**，将核心协议改为无状态：不再要求初始化握手，也没有协议层会话 ID，因此远程服务器可放在普通负载均衡器之后。采用较早 `2025-11-25` 有状态修订版的客户端仍很常见，应规划较长的双版本并存期（迁移细节见[工具使用与 MCP](../07-agentic-systems/03-tool-use-and-mcp.md)）。

### MCP 架构

```
+------------------+          JSON-RPC           +------------------+
|                  |  ========================>  |                  |
|   MCP Client     |                             |   MCP Server     |
|   (AI App)       |  <========================  |   (Your Code)    |
|                  |                             |                  |
|  - Claude Code   |  Transport:                 |  Exposes:        |
|  - Custom Agent  |  - stdio (local)            |  - Tools         |
|  - IDE Plugin    |  - Streamable HTTP (remote) |  - Resources     |
|                  |                             |  - Prompts       |
+------------------+                             +------------------+
```

### TypeScript MCP 服务器（SDK v`2`）

```typescript
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

const server = new McpServer({ name: "customer-service", version: "1.0.0" });

server.registerTool(
  "search_customers",
  {
    description: "Search customers by name, email, or ID. Returns up to 10 matches.",
    inputSchema: z.object({
      query: z.string().describe("Search term: name, email, or account ID"),
      limit: z.number().min(1).max(10).default(5).describe("Max results"),
    }),
  },
  async ({ query, limit }) => ({
    content: [{ type: "text",
      text: JSON.stringify(await db.customers.search(query, limit), null, 2) }],
  })
);

await server.connect(new StdioServerTransport());
```

TypeScript SDK v`2` 拆分为 `@modelcontextprotocol/server`、`@modelcontextprotocol/client` 和 `@modelcontextprotocol/core`。v`1` 包（`@modelcontextprotocol/sdk`）进入维护状态（只修安全和严重问题），但安装量仍占多数（`2026` 年 9 月约 2.32 亿次 npm 下载，v`2` `core` 约 3100 万次），因此两种写法都要能读懂。

### Python MCP 服务器（SDK v`2`，MCPServer）

```python
import json
from mcp.server import MCPServer  # v2 renamed FastMCP to MCPServer; pin mcp<2 to stay on v1

mcp = MCPServer("customer-service")

@mcp.tool()
async def search_customers(query: str, limit: int = 5) -> str:
    """Search customers by name, email, or ID. Returns up to 10 matches.
    Args:
        query: Search term - customer name, email, or account ID
        limit: Max results to return (1-10, default 5)
    """
    return json.dumps(await db.customers.search(query, limit), indent=2)

if __name__ == "__main__":
    mcp.run()  # stdio by default; mcp.run(transport="streamable-http") for remote
```

自 MCP Python SDK `2.0.0`（`2026` 年 7 月 28 日）起，`pip install mcp` 会安装 `2.x`，旧教程中导入 `mcp.server.fastmcp` 的代码在全新安装上会失败。两套 SDK 遵循相同模式：创建服务器、用类型化模式注册工具、连接传输层。TypeScript SDK 使用 Zod 校验；Python 使用类型标注和 docstring。

### 部署模式

| 模式 | 传输方式 | 使用场景 |
|------|-----------|----------|
| 本地（stdio） | stdin/stdout 管道 | 桌面工具、IDE 插件 |
| 远程（Streamable HTTP） | 向单一端点发送 HTTP POST；以 JSON 或流式方式响应 | 云服务、共享服务器 |
| 混合 | 两者都支持 | 本地开发，远程部署 |

远程服务器是网络服务，也会遭受网络服务常见的攻击。`2026` 年 8 月 15 日至 10 月 1 日，GitHub 安全公告数据库发布了 `73` 条标题含 MCP 的公告（其中 `9` 条为严重级别）；最突出的是常用 `mcp-atlassian` 服务器的 `25` 条公告，其 HTTP token 验证器接受任何非空字符串（CVE-`2026-77244`，于 `0.22.0` 修复）。应向签发方核验 token，而非只检查是否存在；本地 HTTP 服务器应绑定回环地址并启用 DNS rebinding 防护；上传和附件工具要视为数据外泄通道。

官方 SDK 也是攻击面的一部分。`2026` 年 9 月底，两者都发布了 OAuth 混淆攻击公告（TypeScript 的 CVE-`2026-104850`，Python 的 GHSA-qx49-fqc8-xw99，CVSS `7.5`）：恶意 MCP 服务器可指定自己的授权服务器，接收客户端已存储的刷新 token 与客户端密钥。最低修复版本为 TypeScript `1.31.0` 或 `2.2.0`，以及 Python `1.30.0` 或 `2.2.0`；升级并非完整修复：机器到机器凭据提供方还须配置预期签发方，升级前保存的凭据在绑定签发方或清除之前仍有暴露风险。多服务器客户端的设计规则是：将每份凭据绑定到签发方，绝不让服务器决定密钥流向何处。

近期版本还收紧了服务器默认值，生产部署应保留：TypeScript `2.1.0` 及之后版本和当前 Python 版本将请求体限制为 `4 MiB`；Python `1.30.0` 和 `2.2.0` 在有状态会话空闲 `30` 分钟后将其关闭，每台服务器最多 `10,000` 个会话。

---

## 工具注册与发现

在生产环境中，智能体需要动态发现可用工具，而不是硬编码工具列表。

### 静态注册

在配置文件中声明 MCP 服务器（例如 `claude_desktop_config.json`）。每个条目将服务器名称映射到命令、参数和可选环境变量。它简单，但不够灵活——每个服务器都会在启动时加载，不管是否相关。

### 动态发现（Tool Search）

Anthropic 的 Tool Search（`2025`）解决了 schema 过载问题。与其把 `200` 个工具 schema 全部加载进上下文（这会降低推理质量），不如把大多数工具标记为 `defer_loading: true`，并给模型一个搜索工具（`tool_search_tool_regex_20251119` 或 `tool_search_tool_bm25_20251119`）；模型搜索后只会收到 `3–5` 个相关 schema。被发现的 schema 会附加到请求中而非替换原有前缀，因此提示词缓存得以保留。至少一个工具，即搜索工具本身，必须保持非延迟加载。

### 在会话中途更改工具且保留缓存

编辑顶层 `tools` 数组会改变提示词前部，使整个缓存失效；对长时程代理会话而言成本很高。Anthropic 于 `2026` 年 9 月 22 日推出的 `inline-tools-2026-09-15` 测试功能允许应用在对话中途的系统消息里新增工具、修改 schema，或替换 MCP 工具集，而不使缓存失效。配合 MCP connector，响应会在 `mcp_tool_listing` 块中记录从每台服务器取到的工具列表；把该块回传还能固定列表，阻止服务器在会话中途悄悄修改工具定义。

### MCP 发现协议

MCP 客户端通过标准 JSON-RPC 方法发现能力：`tools/list` 返回可用工具，`resources/list` 返回数据资源，`prompts/list` 返回提示模板；`2026-07-28` 修订版还增加所有服务器必须实现的 `server/discover`，用于声明支持的协议版本、能力和身份（客户端可先调用它来选择版本）。连接之前，客户端还可通过 Server Cards 查找服务器；这是一项实验性扩展 SEP-`2127`，卡片列在 `/.well-known/ai-catalog.json` 的 AI Catalog 条目中，也可通过仍处于预览阶段的 MCP Registry 查找。面向超大工具目录的服务器端渐进发现列在 `2026` 年 8 月 MCP 路线图上，尚未进入规范。

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

还要决定哪些错误允许模型看到。自 MCP Python SDK `2.1.0` 起，处理器中的意外异常只记录在服务器端，客户端仅看到 `Error executing tool <name>`。对堆栈跟踪和连接字符串来说，这是正确的默认值，但它也隐藏了模型恢复所需的可操作消息。应像下面的处理器一样显式返回此类消息，或从 `mcp.server.mcpserver.exceptions` 抛出 `ToolError`，让模型读取指定消息。

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

这会作为一次 API 调用执行，将延迟从 `3` 次往返降低到 `1` 次。在 Claude API 上，需要添加代码执行工具，并在每个自定义工具的 `allowed_callers` 中列出它；它不能与 `strict: true`、强制 `tool_choice` 或 MCP 工具组合，因此应逐工具选择。相同思路通常称为 code mode 或 CodeAct，于 `2026` 年扩散到多个框架（Agno CodeMode、Microsoft Agent Framework 的 Hyperlight CodeAct 提供方、DSPy `3.4` 的解释器）；Microsoft 报告其所评测工作负载的 token 用量降低超过 `60%`（供应商自报）。

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

Agent Skills（Anthropic，`2025`；自 `2026` 年 8 月 19 日起已在 Claude API 结束测试）是包含指令、脚本和资源的文件夹，代理只在任务需要时加载。一个 skill 就是一个文件夹：

```
my-skill/
  SKILL.md          # YAML frontmatter (name, description) + instructions
  scripts/          # Code the agent can run
  references/       # Docs it reads on demand
  assets/           # Templates, schemas, data files
  tests/            # Your evaluation cases (not part of the spec, but keep them)
```

加载是渐进的：起初上下文中只有每项 skill 的名称与描述；当模型判定其相关时才加载 `SKILL.md` 正文，支持文件则按需读取。这让基础代理保持轻量，也让提示词前缀稳定，便于缓存；将所有 skill 一次性注入系统提示词会同时破坏这两点。

**Skill 如今也是供应链。** `2026` 年 9 月的两项进展改变了交付方式：
- **通过 MCP 发布 Skill：**官方 MCP 扩展 `io.modelcontextprotocol/skills`（SEP-`2640`，9 月 13 日定稿）允许服务器在相关工具旁发布 skill。每个 skill 都携带文件清单和逐文件 SHA-`256` 摘要；主机必须在使用前校验摘要，把任何批准绑定到完整清单（文件改变、增加或删除都使批准失效），将 skill 内容视为不可信，并在 skill 获得工具权限或运行主机侧代码前取得明确批准。截至 9 月底，官方 SDK 支持仍处于开放 PR 阶段。
- **扫描器还不够：**Pretext（arXiv `2609.39607`）构造的恶意 skill 绕过了 NVIDIA 的 SkillSpector（一种静态加 LLM 的 skill 扫描器），且最多在 `97%` 的尝试中成功投送载荷（对能从漏报中学习的扫描器版本仍达 `77%`）。手法是把载荷从代码移入自然语言，并将指令拆散到不同文件。应固定 skill 版本，像升级依赖一样审查更新，在运行时限制其能力，而不是只信安装前扫描。

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

**SDK 升级后要确认追踪仍能看到调用。** Anthropic Python SDK `1.0` 和 OpenAI Python SDK `3.0` 于 `2026` 年 8 月迁移到 `httpx2`。基于 `httpx` 的埋点和测试替身（OpenTelemetry HTTP 埋点、respx、vcrpy）可能悄然漏掉所有模型调用，除非按 Anthropic 升级指南应用 `httpx2.alias_httpx()` shim。空白轨迹不会报错，因此应增加断言 span 存在的金丝雀测试。

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
| 为取得 JSON 而强制工具调用 | 最新 Claude 模型上的 `tool_choice` `any`／`tool` 返回 `400` | 使用 `auto` 加 `strict: true`，或结构化输出 |
| 泄漏原始异常 | 堆栈跟踪和连接字符串进入模型及其可复述的日志 | 返回经过筛选的错误消息；让 SDK 隐藏意外异常 |
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

**使用外部工具时也要遵守同样的纪律。** 供应商可能很快更改内置工具 schema。Google 的 `antigravity-preview-09-2026` 代理（`2026` 年 9 月 17 日）将内置工具参数从 snake_case 改为 PascalCase，以行范围编辑取代整文件重写，并新增 `find_by_name` 和 `grep_search`；它替代的 `05-2026` 版本将在 `2026` 年 10 月 5 日停用，仅相隔 `18` 天。本地执行这些工具或解析 `function_call` 步骤的代码必须跟着改变。应固定带日期的代理和工具版本，对收到的工具定义运行契约测试，并在取到的 MCP 工具列表与固定版本不同时告警（批准后偷偷改定义即“抽地毯”攻击）。

---

## 面试题

### 问：你需要给一个 LLM agent 提供 200 个内部工具（internal tools）访问权限。你会如何处理 schema 过载？

**优秀回答：**
我不会将全部 200 个工具 schema 加载到上下文（context）中。相反，我会采用两阶段方案。第一阶段是工具发现（tool discovery）阶段，让 agent 先描述它需要执行的任务，并通过轻量检索（embedding 相似度或关键词匹配）返回最相关的 5–10 个工具 schema。第二阶段是工具执行阶段，仅将被选中的工具加入上下文，供实际的 LLM 调用。

这与 Anthropic 的 Tool Search 模式一致。发现步骤可作为一次单独的、成本更低的 LLM 调用，甚至可以是非 LLM 的检索流程。关键洞见在于，与任务无关的工具 schema 占用的上下文窗口（context window）空间，会直接降低模型推理质量。我会将工具选择准确率作为核心指标来衡量——如果 agent 应该调用 `get_customer_by_id` 却调用了 `search_customers`，则说明发现阶段需要调优。

第二个约束是提示词缓存。长代理会话主要消耗输入 token，若在顶层工具数组里反复替换 schema，每次都会使缓存失效，成本可能超过所节省的上下文。我会使用附加已发现 schema 的机制（带搜索工具的延迟加载，或提供方支持时在对话中途定义工具），使已缓存前缀保持有效。

对于 MCP 实现，我会按领域服务器分组工具（例如 customer-service、billing、analytics），只连接当前对话相关的服务器，并固定从每台服务器取得的工具列表，防止定义在会话中途变化。

### 问：为一个处理客户支持（customer support）的 tool-use agent 设计一套测试策略。

**优秀回答：**
我会在三层进行测试。第一层是每个工具处理器（tool handler）的单元测试：校验输入边界用例、错误信息和输出格式。这些测试在每次提交（commit）时通过 CI 运行，并使用 mock 依赖。

第二层是集成测试（integration tests），验证工具在真实（staging）数据库上的行为。例如，`create_ticket` 实际创建一条记录，而 `search_customers` 能返回该记录。这类测试可捕捉工具与后端之间的 schema 漂移。

第三层是完整 agent 的评测套件（eval suites），覆盖 LLM 与工具的联动。我会构建一个包含 100+ 条真实场景客户查询的数据集（dataset），并标注期望的工具调用序列与输出标准。评测指标包括工具选择准确率（是否选择了正确的工具？）、参数质量（参数是否正确？）、任务完成率（是否解决问题？）和效率（消耗了多少次工具调用？）。

我会在每次模型版本变更和每次工具 schema 变更时都运行评测。若 schema 变更后工具选择准确率下降 2%，说明需要修订描述（description），而非模型本身。

---

### 问：你的提取服务为取得 JSON 而强制工具调用。迁移到最新 Claude 模型后，每个请求都返回 HTTP `400`。发生了什么？如何在保留 schema 保证的前提下修复？

**优秀回答：**
Claude Fable `5.1`、Mythos `5.1`、Opus `5.5` 和 Sonnet `5.5` 拒绝类型为 `any` 或 `tool` 的 `tool_choice`；只支持 `auto` 和 `none`。强制工具调用原本就是取得结构化输出的变通办法，如今提供方在最新模型上移除了它。

修复取决于强制调用的用途。如果工具仅用于塑造输出，我会删除它并使用原生结构化输出（带 JSON Schema 的 `output_config.format`），直接约束响应。如果工具确实执行工作，我会改用 `auto`，在提示词中点名工具，设置 `strict: true` 保证任何实际调用的参数符合 schema，并在循环中检查模型未调用工具就直接回答的情形：重试一次，仍无调用则报错。

后续有两点比修复本身更重要。首先，这是模型升级触发的故障，因此切换前应增加契约测试，用新模型 ID 运行所有请求形式，包括同样会受检查约束的 `count_tokens` 调用。其次，处理器仍须保留范围和长度检查，因为 strict 模式不强制 `minimum`、`maximum` 或字符串长度。

---

## 参考资料

- Anthropic，《Tool Use with Claude》API 文档，包括严格工具使用和结构化输出
- Anthropic，Claude Platform 更新日志（强制 `tool_choice` 移除、`inline-tools-2026-09-15` 测试功能，`2026` 年 8 至 9 月）
- Model Context Protocol，`2026-07-28` 规范修订版与《Build an MCP Server》
- Model Context Protocol，《The New MCP Roadmap》（`2026` 年 8 月 22 日）
- Model Context Protocol，Skills 扩展 SEP-`2640`（`2026` 年 9 月）
- MCP TypeScript SDK: github.com/modelcontextprotocol/typescript-sdk
- MCP Python SDK：github.com/modelcontextprotocol/python-sdk（v`2` 迁移指南见 py.sdk.modelcontextprotocol.io）
- Anthropic. "Introducing Advanced Tool Use" (2025)
- Anthropic，Agent Skills 文档（自 `2026` 年 8 月起在 Claude API 正式发布）
- Kaisar 与 Dhar，《Pretext》（arXiv `2609.39607`，`2026` 年 9 月）
- GitHub 安全公告数据库：已审核 MCP 公告（github.com/advisories?query=type%3Areviewed+mcp）
- MCP SDK 安全公告 GHSA-6qxp-vccf-f47h／CVE-`2026-104850`（TypeScript）与 GHSA-qx49-fqc8-xw99（Python），OAuth 授权服务器混淆攻击（`2026` 年 9 月）

---

*Previous: [Computer-Use Agents](04-computer-use-agents.md)*
