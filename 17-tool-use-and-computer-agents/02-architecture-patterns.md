# 工具调用代理的架构模式

2026 年的每一种工具调用代理——从 OpenClaw 到 Claude Code，再到 Cursor 的 Background Agents——都建立在少数几个核心架构模式之一上。理解这些模式，能让你从第一性原理设计代理，而不是照搬某个具体工具。本章将拆解每种模式，并给出详细图示、代码示例、权衡取舍，以及何时使用哪种模式的指导。

## 目录

- [模式 1：Function/Tool Calling（函数/工具调用）](#模式-1-function-tool-calling-函数-工具调用)
- [模式 2：Vision-Based Automation（基于视觉的自动化）](#模式-2-vision-based-automation-基于视觉的自动化)
- [模式 3：Local Code Execution（本地代码执行）](#模式-3-local-code-execution-本地代码执行)
- [模式 4：Multi-Agent Tool Orchestration（多代理工具编排）](#模式-4-multi-agent-tool-orchestration-多代理工具编排)
- [Sandboxed vs. Unsandboxed Execution（沙箱与非沙箱执行）](#沙箱化与非沙箱执行)
- [State Management Across Tool Calls（跨工具调用的状态管理）](#跨工具调用的状态管理)
- [Error Handling and Retry Patterns（错误处理与重试模式）](#错误处理和重试模式)
- [MCP Integration Patterns（MCP 集成模式）](#mcp-集成模式)
- [Architecture Decision Tree（架构决策树）](#架构决策树)
- [System Design Interview Angle（系统设计面试视角）](#系统设计面试角度)
- [Interview Questions（面试问题）](#面试题)
- [References（参考资料）](#参考资料)

---

## 模式 1：Function/Tool Calling（函数/工具调用）

这是生产环境中部署最广泛的模式。LLM（Large Language Model，大型语言模型）决定调用哪个工具以及传入哪些参数；框架执行该调用；结果再被反馈回对话中，供下一步推理使用。

### 架构

```
+-------------------------------------------------------------------+
|              Function/Tool Calling Pattern                        |
+-------------------------------------------------------------------+
|                                                                   |
|  +------------------+                                             |
|  |  User Message     |                                            |
|  +--------+---------+                                             |
|           |                                                       |
|           v                                                       |
|  +--------+---------+     +------------------+                    |
|  |  LLM Reasoning   |---->|  Tool Selection  |                   |
|  |                   |     |                  |                    |
|  |  "I need to look  |     |  tool: search_db |                   |
|  |   up the order"  |     |  args: {id: 42}  |                    |
|  +-------------------+     +--------+---------+                   |
|                                     |                             |
|                                     v                             |
|                            +--------+---------+                   |
|                            |  Tool Executor   |                   |
|                            |  (Framework)     |                   |
|                            |                  |                   |
|                            |  Validates args  |                   |
|                            |  Calls function  |                   |
|                            |  Returns result  |                   |
|                            +--------+---------+                   |
|                                     |                             |
|                                     v                             |
|                            +--------+---------+                   |
|                            |  Result Injected |                   |
|                            |  into Context    |                   |
|                            |                  |                   |
|                            |  {status: "shipped",                 |
|                            |   tracking: "1Z..."} |               |
|                            +--------+---------+                   |
|                                     |                             |
|                                     v                             |
|                            +--------+---------+                   |
|                            |  LLM Generates   |                   |
|                            |  Final Response  |                   |
|                            +------------------+                   |
+-------------------------------------------------------------------+
```

### 三个步骤详解

**步骤 1 -- Schema Presentation（模式呈现）**：模型接收描述可用工具的 JSON schema。到 2026 年，最佳实践是使用 Dynamic Manifests（动态清单），根据用户意图只拉取相关工具，而不是一次性加载全部工具 schema。

**步骤 2 -- Intent and Extraction（意图与抽取）**：模型输出结构化工具调用。这不是自由文本；它是一个包含 `tool_name` 和 `arguments` 的 JSON 对象，框架可以确定性地解析。

**步骤 3 -- Execution and Contextualization（执行与上下文化）**：框架使用 Pydantic、Zod 或类似工具校验参数，调用函数，并将结果作为角色为 `tool` 的新消息注入对话。

### 代码示例：MCP Server + Client

```python
# MCP Server: defines a tool with strict schema
from mcp.server import Server
from pydantic import BaseModel, Field

server = Server("order-service")

class OrderLookup(BaseModel):
    """Look up an order by ID. DO NOT use for cancelled orders."""
    order_id: str = Field(..., description="The order UUID")

@server.tool()
async def lookup_order(args: OrderLookup) -> dict:
    order = await db.orders.find_one({"id": args.order_id})
    if not order:
        return {"error": "Order not found", "suggestion": "Check order ID format"}
    return {"status": order["status"], "tracking": order.get("tracking_number")}
```

```python
# MCP Client: agent discovers tools dynamically, calls them, feeds results back
tools = await mcp_client.list_tools()
response = client.messages.create(model="claude-sonnet-4-6", tools=tools,
    messages=[{"role": "user", "content": "Where is my order ORD-12345?"}])

if response.stop_reason == "tool_use":
    tool_call = response.content[0]
    result = await mcp_client.call_tool(tool_call.name, tool_call.input)
    # Feed result back as a tool_result message for the next LLM turn
```

### 何时使用这种模式

- API 集成（数据库、SaaS 工具、内部服务）
- 结构化数据检索与变更
- 任何可以提前定义工具接口的工作流
- 需要审计轨迹（audit trails）和输入校验的生产系统

### 权衡取舍

| Advantage | Disadvantage |
|-----------|--------------|
| 确定性执行（Deterministic execution） | 需要预先定义工具 schema |
| 易于审计和日志记录 | 无法与任意 UI 交互 |
| 快速（每次工具调用 50-200ms） | 模型可能“幻觉”出工具名/参数 |
| 适用于任何支持工具使用的 LLM | 工具过多时会产生 schema overload |

---

## 模式 2：Vision-Based Automation（基于视觉的自动化）

模型查看屏幕截图，推理应该做什么，并发出一个低层级动作（点击、输入、滚动）。环境执行该动作，截取新截图，循环往复。这就是 Claude Computer Use 和 Open Interpreter 的 Computer API 的工作方式。

### 架构

```
+-------------------------------------------------------------------+
|              Vision-Based Automation Pattern                      |
+-------------------------------------------------------------------+
|                                                                   |
|  +------------------+                                             |
|  |  Task Goal        |  "Fill out the expense form with           |
|  |  (NL instruction) |   last week's receipts"                    |
|  +--------+---------+                                             |
|           |                                                       |
|           v                                                       |
|  +--------+--------------------------------------------------+    |
|  |                    VISION-ACTION LOOP                      |    |
|  |                                                            |    |
|  |   +------------+    +-------------+    +------------+     |    |
|  |   |  OBSERVE   |    |  REASON     |    |  ACT       |     |    |
|  |   |            |    |             |    |            |     |    |
|  |   | Screenshot |--->| Analyze     |--->| Emit action|     |    |
|  |   | (base64)   |    | screenshot  |    | {type:     |     |    |
|  |   |            |    | + goal      |    |  "click",  |     |    |
|  |   |            |    | + history   |    |  x: 450,   |     |    |
|  |   |            |    | + prev acts |    |  y: 320}   |     |    |
|  |   +-----^------+    +-------------+    +------+-----+     |    |
|  |         |                                      |          |    |
|  |         +--------------------------------------+          |    |
|  |                    (Loop until done)                       |    |
|  +-----------------------------------------------------------+    |
|                            |                                      |
|                            v                                      |
|  +-------------------------+------------------------------+       |
|  |         Sandboxed Environment (VM / Docker + VNC)      |       |
|  |                                                        |       |
|  |   +----------+  +----------+  +----------+            |       |
|  |   | Desktop  |  | Browser  |  | Apps     |            |       |
|  |   | (Xfce)   |  | (Chrome) |  | (any)    |            |       |
|  |   +----------+  +----------+  +----------+            |       |
|  +--------------------------------------------------------+       |
+-------------------------------------------------------------------+
```

### 观察-推理-行动循环

**Observe（观察）**：捕获当前屏幕状态的截图。在 Claude Computer Use 中，这是一张以 base64 编码的 PNG，以图像内容块的形式发送。Zoom Action（2026 年新增）允许对特定区域进行高分辨率裁剪采集，用于密集界面。

**Reason（推理）**：多模态 LLM（Multimodal LLM，多模态大型语言模型）结合任务目标和动作历史分析截图，决定下一步动作。这个步骤消耗最多 token。

**Act（执行）**：模型发出结构化动作：
- `left_click(x, y)` -- 在坐标处点击
- `type(text)` -- 输入字符串
- `key(key_combo)` -- 按下键盘快捷键
- `scroll(direction, amount)` -- 滚动页面
- `screenshot()` -- 在不执行动作的情况下获取新截图
- `zoom(x0, y0, x1, y1)` -- 以高分辨率检查某个区域

### 代码示例：Computer Use 循环

```python
tools = [
    {"type": "computer_20250124", "name": "computer",
     "display_width_px": 1280, "display_height_px": 800},
    {"type": "bash_20250124", "name": "bash"},
    {"type": "text_editor_20250124", "name": "str_replace_based_edit_tool"}
]
messages = [{"role": "user", "content": "Open the browser and go to GitHub."}]

while True:  # The vision-action loop
    response = client.messages.create(
        model="claude-sonnet-4-6", max_tokens=4096, tools=tools, messages=messages)
    if response.stop_reason == "end_turn":
        break
    for block in response.content:
        if block.type == "tool_use":
            result = sandbox.execute_action(block.name, block.input)
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": block.id, "content": result}]})
```

### 何时使用这种模式

- 自动化没有 API 的遗留应用
- 图形界面（GUI, Graphical User Interface）端到端测试
- 需要在多个应用之间交互的任务
- 非开发者用自然语言描述任务的场景

### 权衡取舍

| Advantage | Disadvantage |
|-----------|--------------|
| 适用于任何 GUI 应用 | 慢（每个动作步骤 1-3 秒） |
| 不需要 API 或集成 | token 成本高（截图很大） |
| 能处理动态 UI（User Interface，用户界面） | 密集界面存在误点风险 |
| 对非技术用户更友好 | 需要沙箱化虚拟机（sandboxed VM）以确保安全 |

---

## 模式 3：Local Code Execution（本地代码执行）

用户用自然语言描述任务。LLM 生成代码。代码在本地机器上（或沙箱中）运行。系统观察输出，LLM 要么继续生成代码，要么直接给出最终答案。这就是 Open Interpreter 和 Claude Code 的部分能力实现方式。

### 架构

```
User (NL): "Analyze the CSV and plot the top 10 products"
  |
  v
[LLM Generates Code] --> Python/Bash/JS
  |
  v
[Permission Gate] --> "Run this code? [y/N]" (auto-approve, always-ask, or rules-based)
  |
  v
[Code Executor] --> Execute, capture stdout/stderr/return value
  |
  v
[Output Observer] --> Error? Feed back to LLM for fix. Success? Present to user.
  |
  v
[LLM Decides] --> Done? Return result. Need more? Generate next code block. (Loop)
```

### NL-Code-Execute-Observe 循环

**1. Natural Language to Code**：LLM 将用户意图转译为可执行代码。代码语言取决于任务——数据分析用 Python，系统操作用 bash，Web 任务用 JavaScript。

**2. Permission Gate**：执行前先请求用户批准。这是非沙箱环境中的关键安全机制。实现方式各不相同：
- **Always ask**（始终询问，Open Interpreter 默认）：每个代码块都需要显式批准
- **Auto-approve**（自动批准，trusted mode）：危险但更快
- **Rules-based**（基于规则，Claude Code 模型）：在配置中按允许/拒绝模式控制。例如：允许 `git` 命令，拒绝 `rm -rf`

**3. Execute and Capture**：代码在具备完整（或受限）系统访问权限的运行时中执行。stdout、stderr、返回值以及任何生成的文件都会被捕获。

**4. Observe and Iterate**：LLM 查看执行输出。如果有错误，就生成修复；如果输出不完整，就生成下一步。这形成一个自我纠错循环。

### 代码示例：Code Execution Agent

```python
class CodeExecutionAgent:
    def __init__(self, llm_client, sandbox=None):
        self.llm = llm_client
        self.sandbox = sandbox  # None = unsandboxed (host)
        self.history = []

    async def run(self, task: str) -> str:
        self.history.append({"role": "user", "content": task})
        for iteration in range(10):  # Max 10 code-execute cycles
            response = await self.llm.generate(messages=self.history)
            code = extract_code_block(response)
            if not code:
                return response  # No code = final answer
            if not self.sandbox and not await user_approves(code):
                return "Execution cancelled by user."
            result = await (self.sandbox or LocalExecutor()).run(code, timeout=30)
            self.history.append({"role": "assistant", "content": response})
            self.history.append({"role": "user",
                "content": f"stdout: {result.stdout}\nstderr: {result.stderr}"})
        return "Max iterations reached."
```

### 何时使用这种模式

- 数据分析与可视化任务
- 系统管理和 DevOps 自动化
- 文件处理与转换
- 任何用户只描述“做什么（what）”，由代理决定“怎么做（how）”的任务

### 权衡取舍

| Advantage | Disadvantage |
|-----------|--------------|
| 极其灵活 | 非沙箱环境下有安全风险 |
| 通过 observe 循环实现自我纠错 | 模型可能生成危险代码 |
| 可借助本地模型离线运行 | 需要用户评估代码（或信任代码） |
| 按需获得完整系统访问权限 | 非确定性（同一提示可能生成不同代码） |

---

## 模式 4：Multi-Agent Tool Orchestration（多代理工具编排）

与其让一个代理拥有大量工具，不如让多个专门代理各自负责一部分工具。由一个 orchestrator（编排器）把任务路由给合适的代理。这是代理领域的“微服务革命”。

### 架构

```
  [User Request]
       |
       v
  [ORCHESTRATOR] (Frontier model: Claude Opus, GPT-4o)
  Analyzes task, selects agent, routes and waits
       |
  +----+----+----+
  |         |         |
  v         v         v
[Code Agent]  [Data Agent]  [Web Agent]
 bash, edit,   SQL, plot,    fetch, scrape,
 git           csv            browse
  |         |         |
  v         v         v
[Sandbox]  [Sandbox]  [Sandbox]
(Docker)   (Docker)   (Docker)
```

### 编排策略

**1. Router-Based（路由式）**：orchestrator（编排器）是一个分类器。它会查看用户消息、选择合适的 specialist agent（专用代理），并转发完整任务。各代理之间没有 inter-agent communication（代理间通信）。

**2. Plan-and-Execute（规划-执行）**：一个 planning model（规划模型，frontier-class 先进模型）将任务拆分为子任务，并分配给合适的 specialist。子任务结果由规划器聚合。基准测试显示，任务完成率达到 92%，相较顺序 ReAct 提升了 3.6 倍速度。

**3. Hierarchical（层级式）**：高层代理向低层代理分配工作，后者可能继续再委派。这与组织结构相似，适用于复杂项目。

**4. Collaborative（协作式，点对点）**：代理可以直接相互沟通，分享观察并请求帮助。这是最复杂的模式，但对 emergent tasks（涌现任务）处理得很好。

### 成本优化：Plan-and-Execute 的优势

```
Traditional: [Frontier Model] handles all steps       Cost: $1.00/task

Plan-and-Execute:
  [Frontier Model] plans (1 call)                     Cost: $0.05
  [Small Model] executes steps 1-3                    Cost: $0.03
  [Frontier Model] aggregates (1 call)                Cost: $0.05
                                                      Total: $0.13/task
                                                      Savings: ~87%
```

2026 年的趋势是将 agent cost optimization（代理成本优化）视为一等公民问题，这类似于微服务时代 cloud cost optimization（云成本优化）成为必需项。

---

## 沙箱化与非沙箱执行

这是任何 tool-use agent（工具使用代理）最关键的架构决策之一。

### 对比

```
  UNSANDBOXED (Host Access)              SANDBOXED (Isolated)
  +------------------------+             +------------------------+
  | LLM output executes    |             | LLM output executes    |
  | directly on host OS    |             | inside Docker/VM/E2B   |
  |                        |             |                        |
  | Risk: rm -rf /         |             | Isolated filesystem,   |
  | Risk: data exfiltration|             | network, processes     |
  |                        |             |                        |
  | Used by: OpenClaw,     |             | Used by: OpenHands,    |
  | Open Interpreter,      |             | OpenAI Codex, Jules,   |
  | Claude Code (default)  |             | Cursor Background Agents|
  +------------------------+             +------------------------+
```

### 沙箱实现方案

| 技术 | 隔离级别 | 启动时间 | 使用场景 |
|------------|----------------|-------------|----------|
| Docker | 进程 + FS | 1-5 秒 | 大多数代理沙箱（OpenHands） |
| Firecracker | 完整 VM（microVM） | ~125ms | 高安全性、多租户 |
| gVisor | 内核级 | ~200ms | Google Cloud Run |
| E2B | 云沙箱 | 2-3 秒 | 远程代理执行 |
| WebAssembly | 语言级 | <50ms | 基于浏览器的执行 |

### 2026 年共识

默认采用 sandboxed-by-default（默认沙箱化），并提供 escape hatches（逃生/回退通道）。OpenClaw 安全危机（公共互联网上有 135,000 个暴露实例）让行业对此高度重视。新的生产级代理预计默认就应进入沙箱。Unsandboxed execution（非沙箱执行）仅保留给单用户、受监督环境。

---

## 跨工具调用的状态管理

代理需要在工具调用之间保持状态。策略取决于代理的生命周期与使用场景。

### 状态管理模式

| 模式 | 生命周期 | 存储 | 使用方 |
|---------|-----------|---------|---------|
| **Conversation State** | 短暂（单次会话） | Message array | 大多数基于 API 的代理 |
| **Session State** | 按会话（工作目录、打开文件） | Docker container / temp dir | OpenHands、Claude Code |
| **Persistent State** | 跨会话（天、周） | DB、文件、Markdown | OpenClaw（Memories/）、CLAUDE.md |
| **Environment State** | 外部（事实来源） | Git repo、database、FS | Claude Code（git status）、CI/CD |

### 实现：Session State

```python
class AgentSession:
    """Manages state across tool calls within a single session."""
    def __init__(self):
        self.conversation: list[dict] = []
        self.working_dir: str = tempfile.mkdtemp()
        self.open_files: dict[str, str] = {}  # path -> content cache
        self.tool_call_count: int = 0

    def add_tool_result(self, tool_name: str, args: dict, result: dict):
        self.tool_call_count += 1
        self.conversation.append({"role": "tool", "tool_name": tool_name,
            "args": args, "result": result, "timestamp": time.time()})
        # Update derived state from side effects
        if tool_name == "write_file":
            self.open_files[args["path"]] = args["content"]

    def get_context_for_llm(self, max_tokens: int = 100_000) -> list[dict]:
        """Return conversation history, compressed if over budget."""
        if estimate_tokens(self.conversation) < max_tokens:
            return self.conversation
        return self._compress_history(max_tokens)  # Summarize old results
```

---

## 错误处理和重试模式

工具调用会失败。网络会超时。API 会返回错误。代码会抛出异常。生产级代理需要系统化的错误处理。

### 错误分类

| Error Type | 示例 | 策略 |
|-----------|----------|----------|
| **Transient** | 网络超时、限流、503 | 指数退避重试（最多 3 次） |
| **Input** | 无效参数、格式错误 | 将错误反馈给 LLM，让其修正参数 |
| **Permission** | 鉴权失败、访问被拒绝 | 向用户报告，不要重试 |
| **Logic** | 错误工具、不可行操作 | 将错误反馈给 LLM，让其重新规划 |
| **Catastrophic** | OOM、sandbox 崩溃、无限循环 | 中止、上报、清理资源 |

### 重试模式实现

```python
class ToolExecutor:
    MAX_RETRIES = 3

    async def execute_with_retry(self, tool_name: str, args: dict) -> dict:
        for attempt in range(self.MAX_RETRIES):
            try:
                result = await self.call_tool(tool_name, args)
                if not result.get("error"):
                    return result  # Success
                error_type = classify_error(result["error"])
                if error_type == "transient":
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff
                    continue
                elif error_type == "input":
                    return {"error": result["error"], "fix_hint": "Adjust args"}
                elif error_type == "permission":
                    return {"error": result["error"], "action": "Report to user"}
                else:  # catastrophic
                    await self.cleanup_sandbox()
                    return {"error": "Fatal error. Task aborted."}
            except TimeoutError:
                if attempt < self.MAX_RETRIES - 1:
                    await asyncio.sleep(2 ** attempt)
                    continue
        return {"error": f"Failed after {self.MAX_RETRIES} retries"}
```

### 自我修正循环

这是 2026 年最强的错误处理模式。代理会观察自身失败并自主修复：

```
LLM generates code/tool call
  --> Execute --> Success? -- YES --> Return result
                     |
                     NO
                     |
                     v
              Feed error + stderr to LLM --> LLM generates fix --> Execute again
              (max 5 corrections to prevent infinite loops)
```

这就是 Claude Code、OpenHands 和 Cline 处理测试失败的方式：运行测试、查看失败、修改代码、重新运行测试，重复直到通过。

---

## MCP 集成模式

MCP 已成为 2026 年工具集成的标准协议。以下是将 MCP 融入代理架构的关键模式。

### 模式 A：Direct MCP Connection（直接 MCP 连接）

```
[Agent (Client)] <-- stdio / HTTP --> [MCP Server]
```
这是最简单的模式。一个代理，一个服务器。用于单一用途工具（数据库、文件系统）。

### 模式 B：Multi-Server Fan-Out（多服务器扇出）

```
                  +--> [GitHub MCP]
[Agent (Client)]--+--> [Postgres MCP]
                  +--> [Slack MCP]
```
代理同时连接多个 MCP 服务器。Tool schemas（工具 schema）被合并为一个 manifest（清单）。用于 Claude Code 和多工具助手。

### 模式 C：MCP Gateway（企业级）

```
[Agent 1] --+                          +--> [GitHub MCP]
[Agent 2] --+--> [MCP Gateway]  --+--> [Postgres MCP]
[Agent 3] --+    (Auth, Rate Limit,    +--> [Slack MCP]
                  Audit, Route)
```
中心网关负责认证、限流和审计日志。代理只需与网关完成认证。用于企业和多租户部署。

### MCP 路线图缺口

当前 MCP 规范（截至 2026 年 5 月）仍缺少三个关键生产原语：

1. **Identity Propagation**：缺少从 client（客户端）到 server（服务端）传递用户身份的标准化方式。网关模式是一个变通方案。
2. **Adaptive Tool Budgeting**：缺少协议级支持来限制每次工具调用的 token/成本消耗。
3. **Structured Error Semantics**：缺少标准错误码或错误分类。每个服务器定义自己的错误格式。

这些内容已列入 2026 年路线图，但尚未获批。

---

## 架构决策树

使用下列决策树为你的用例选择合适模式：

```
Does the target system have an API?
 +-- YES --> Pattern 1 (Tool Calling). Wrap as MCP server. Fastest, most reliable.
 +-- NO  --> Does the task require GUI interaction?
              +-- YES --> Pattern 2 (Vision-Based). Sandbox in VM. Accept latency.
              +-- NO  --> Is the task primarily code/data work?
                           +-- YES --> Pattern 3 (Code Exec). Sandbox if multi-tenant.
                           +-- NO  --> Complex enough for multiple specialists?
                                        +-- YES --> Pattern 4 (Multi-Agent Orch.)
                                        +-- NO  --> Pattern 1 with custom tool.
```

### 混合架构

在实践中，生产系统会组合多种模式。Claude Code 使用：
- Pattern 1（tool calling）用于文件操作和 git
- Pattern 2（vision-based）用于 computer use 功能
- Pattern 3（code execution）用于 bash 和测试运行
- Pattern 4（multi-agent）用于 subagent spawning

关键是默认采用最简单的模式（function calling），只在用例需要时再增加复杂性。

---

## 系统设计面试角度

在面试中讨论 tool-use architecture 时，可围绕以下五个维度组织答案：

### 1. Pattern Selection

先说明适配的模式：“目标系统有 REST API，因此我会使用 function/tool calling 模式，并用 MCP server 封装该 API。” 这体现了你对决策树的理解。

### 2. Sandbox Boundary

始终要谈安全性：“对于多租户部署，我会把每个用户的代理会话放在一个 Docker container（Docker 容器）里，并且不开放到内部服务的网络访问。MCP server 运行在沙箱外部并中介所有外部调用。”

### 3. State Strategy

说明状态管理方式：“我会在 Docker 容器内使用 session state（会话状态）管理工作文件，并把 environment state（git 仓库）作为事实来源。此场景下不需要持久化的代理记忆。”

### 4. Error Budget

讨论失败模式：“工具调用可能因瞬时错误失败（退避重试）、输入错误（让 LLM 自我修正）或权限错误（反馈给用户）。我会将自我修正尝试次数上限设为 5 次，然后再上报。”

### 5. Cost Model

阐述经济性：“对 orchestrator（编排器）我会采用 Plan-and-Execute 模式：Opus 负责规划任务，Haiku 执行每一步。相比全部使用 Opus，这可将成本降低约 87%。”

---

## 面试题

### Q: 设计一个客户支持代理系统，让其可使用来自 Zendesk、Salesforce 与内部知识库的数据回答问题。

**优秀回答:**
Pattern 1（function/tool calling）配合三个 MCP server，每个数据源一个。使用 Multi-Server Fan-Out（多服务器扇出）模式，并结合动态 manifest（清单），使每次查询只加载相关工具。生产环境下，再叠加 MCP Gateway（网关）处理每个数据源的 OAuth、限流（对 Salesforce API 配额尤其关键）和审计日志。状态采用 ephemeral（短暂）方式——客户支持场景不需要跨会话记忆。

### Q: 如何防止 AI 代理通过工具调用造成破坏？

**优秀回答:**
采用五层纵深防御：（1）带 deny-pattern（拒绝模式，正则）约束的 schema 校验（如拒绝 `DROP TABLE` 等）。（2）破坏性操作的权限闸门——Claude Code 的 allow/deny 规则是不错的模型。（3）沙箱隔离（Docker、只读挂载、无外网）。（4）Token 与成本上限，防止失控循环。（5）通过 MCP Gateway 保留审计轨迹。单一层不足够——模型可能产生通过校验但有害的参数（因此需要沙箱），沙箱无法阻止通过允许路径外传（因此需要审计日志）。

### Q: 解释基于视觉的 computer use 与基于 API 的 tool calling 的取舍。

**优秀回答:**
基于 API 的方式更快（每步 50-200ms vs 1-3s）、更便宜（文本 token vs 图像 token）、更稳定（确定性优于坐标点击）、更易测试。只要有 API，应始终优先选择。基于视觉的方式适合作为 fallback（备用方案），用于无 API 的应用、遗留系统或多应用工作流。2026 年的 Zoom Action 缓解了在密集界面上的误点问题。最佳实践是：对 80% 有 API 支持的任务使用 API 调用，对剩余 20% 使用 vision-based（基于视觉）方式。

---

## 参考资料

- Anthropic. "Computer Use Tool Documentation" (2024-2026)
- Anthropic. "Model Context Protocol Specification" (2025-2026)
- MCP 2026 Roadmap. "Transport Evolution, Agent Communication, Governance" (2026)
- IBM Developer. "MCP Architecture Patterns for Multi-Agent AI Systems" (2026)
- Google Cloud. "Choose a Design Pattern for Your Agentic AI System" (2025-2026)
- Microsoft Azure. "AI Agent Orchestration Patterns" (2025-2026)
- OpenHands Documentation. "Runtime Architecture" (2025-2026)
- OpenClaw Documentation. "Architecture and SOUL.md Guide" (2025-2026)
- Open Interpreter GitHub Repository (2024-2026)
- ArXiv 2603.13417. "Design Patterns for Deploying AI Agents with MCP" (2026)

---

*Previous: [Tool-Use and Computer Agent Landscape](01-tool-use-landscape.md)*
*Next Chapter: [Case Studies](../16-case-studies/)*
