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

**步骤 1：Schema Presentation（模式呈现）。** 模型接收描述可用工具的 JSON schema。`2026` 年的最佳实践是使用动态清单，按用户意图只拉取相关工具，而非一次性加载所有 schema。供应商已有实现：Anthropic 的 `inline-tools-2026-09-15` 测试功能可以在对话中途新增或替换工具，且不使提示词缓存失效；Cursor 报告，把 MCP 工具放入动态上下文后，实际调用过工具的会话总 token 用量降低 `46.9%`（供应商自报）；面向大型目录的服务器端渐进发现列入 MCP 的 `2026` 年 8 月路线图。

**步骤 2：Intent and Extraction（意图与抽取）。** 模型输出结构化工具调用。这不是自由文本，而是包含 `tool_name` 和 `arguments`、可确定性解析的 JSON 对象。**能否强制调用取决于模型**：Claude Fable `5.1`、Mythos `5.1`、Opus `5.5` 和 Sonnet `5.5` 对类型为 `any` 或 `tool` 的 `tool_choice` 返回 HTTP `400`。可使用 `auto` 配合严格工具定义；若需要有保证的 schema 则使用结构化输出。以强制工具调用来提取或路由的框架，迁移到这些模型前必须重写。OpenAI 也有类似的接口边界：GPT-`6` Astra 只在 Responses API 支持工具调用，Chat Completions 框架不能只替换模型 ID。

**步骤 3 -- Execution and Contextualization（执行与上下文化）**：框架使用 Pydantic、Zod 或类似工具校验参数，调用函数，并将结果作为角色为 `tool` 的新消息注入对话。

### 代码示例：MCP Server + Client

```python
# MCP Server (Python SDK 2.x, where FastMCP was renamed MCPServer)
from typing import Annotated
from mcp.server import MCPServer
from pydantic import Field

mcp = MCPServer("order-service")

@mcp.tool()
async def lookup_order(
    order_id: Annotated[str, Field(description="The order UUID")],
) -> dict:
    """Look up an order by ID. DO NOT use for canceled orders."""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        return {"error": "Order not found", "suggestion": "Check order ID format"}
    return {"status": order["status"], "tracking": order.get("tracking_number")}
```

```python
# MCP Client: agent discovers tools dynamically, calls them, feeds results back
listed = await mcp_client.list_tools()
tools = [to_model_tool_schema(t) for t in listed.tools]  # MCP listing -> model API format
response = client.messages.create(model="claude-sonnet-5-5", max_tokens=16000, tools=tools,
    messages=[{"role": "user", "content": "Where is my order ORD-12345?"}])

if response.stop_reason == "tool_use":
    # Thinking or text blocks can precede the call, so never assume content[0]
    tool_call = next(b for b in response.content if b.type == "tool_use")
    result = await mcp_client.call_tool(tool_call.name, tool_call.input)
    # Append the full assistant turn (thinking blocks included), then a tool_result block
```

自 `2026` 年 7 月 28 日起，`pip install mcp` 解析到 SDK `2.x`，因此导入 `FastMCP` 的旧教程在全新安装上会失败；暂时不迁移可固定 `mcp<2`。Python SDK `2.1+` 也改变了错误可见性：处理器中的意外异常在客户端只表现为“Error executing tool &lt;name&gt;”，需要模型看到的消息应通过 `ToolError` 抛出。

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

模型查看屏幕截图，推理应该做什么，并发出一个低层级动作（点击、输入、滚动）。环境执行动作、截取新截图，循环往复。Claude 的计算机工具集、Gemini computer use，以及原版 Python Open Interpreter 的 Computer API 都采用这种模式。

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

**Observe（观察）**：捕获当前屏幕状态截图。在 Claude Computer Use 中，它以 base64 编码 PNG 的图像内容块发送；据 Anthropic 估算，每张截图约消耗 `1,000–1,800` 个输入 token。Zoom Action（`2026` 年新增，在正式版工具集中默认启用）允许对密集界面的特定区域作高分辨率裁剪。Claude 正式版工具集不再接收显示尺寸；模型使用返回截图的像素坐标空间。

**Reason（推理）**：多模态 LLM（Multimodal LLM，多模态大型语言模型）结合任务目标和动作历史分析截图，决定下一步动作。这个步骤消耗最多 token。

**Act（执行）**：模型发出结构化动作：
- `left_click(x, y)` -- 在坐标处点击
- `type(text)` -- 输入字符串
- `key(key_combo)` -- 按下键盘快捷键
- `scroll(direction, amount)` -- 滚动页面
- `screenshot()` -- 在不执行动作的情况下获取新截图
- `zoom(x0, y0, x1, y1)` -- 以高分辨率检查某个区域

### 批量动作与元素引用

`2026` 年的两项变化重塑了这个循环。首先是**批量动作**：Claude 于 `2026` 年 8 月 19 日正式发布的计算机工具集允许模型在一轮中返回多个 `tool_use` 块。执行器按顺序运行，在首次失败时停止，对所有后续块返回错误而不执行。一轮模型往返如今可覆盖多个 GUI 步骤，改变延迟与成本模型。这也意味着若把人工确认安排在模型轮次之间，可能太晚了：一轮即可完成多个步骤的重大操作。Anthropic 文档将检查点放在每个块执行前：收到批次后检查每个动作，在每个有重大后果的动作前暂停，并将拒绝视为失败，使后续块都返回未执行。

其次，**能够使用元素定位时就不必依赖像素**。Claude 浏览器工具集返回含元素引用（如 `[ref_2]`）的无障碍树，点击和表单填写可按引用定位；引用能承受布局变化，但导航后会失效。Gemini computer use 将坐标归一化到 `0–999` 网格，并提供安全服务，对金融交易、开户和接受法律条款等类别返回 `require_confirmation`。对于没有可访问结构的桌面应用，像素定位仍是后备方案。

### 代码示例：Computer Use 循环

```python
tools = [
    {"type": "computer_toolset_20260801"},  # GA toolset: no name, no display size
    {"type": "bash_20250124", "name": "bash"},
    {"type": "text_editor_20250728", "name": "str_replace_based_edit_tool"},
]
messages = [{"role": "user", "content": "Open the browser and go to GitHub."}]
SKIPPED = "Not executed: an earlier computer action in this turn failed."

for step in range(50):  # The vision-action loop, with a hard step cap
    response = client.messages.create(
        model="claude-sonnet-5-5", max_tokens=16000, tools=tools, messages=messages)
    messages.append({"role": "assistant", "content": response.content})  # once per turn
    if response.stop_reason != "tool_use":
        break
    results, failed = [], False
    for block in (b for b in response.content if b.type == "tool_use"):
        if failed:  # batch semantics: stop at the first failure, answer every block
            ok, content = False, SKIPPED
        elif needs_approval(block) and not human_approves(block):  # gate each block, mid-batch too
            ok, content, failed = False, "Rejected by the user.", True
        else:
            # screenshot and zoom return an image block; other members return "OK"
            ok, content = sandbox.execute(block.name, block.input)
            failed = not ok
        result = {"type": "tool_result", "tool_use_id": block.id,
                  "content": content, "is_error": not ok}
        if getattr(block, "toolset_name", None):  # computer toolset members
            result["toolset_name"] = block.toolset_name
        results.append(result)
    messages.append({"role": "user", "content": results})  # all results in one message
```

旧版 `computer_20251124` 工具在 Claude API 和 Google Cloud 的 Opus `5.5`、Sonnet `5.5` 上返回 HTTP `400`（Bedrock 仍接受），正式版工具集则拒绝旧的 `name` 和显示尺寸字段。早期示例常按每个 `tool_use` 块附加一条 assistant 消息；模型开始批量动作后，这种循环也会失效。`5.5` 一代模型还有一处陷阱：不要为了省 token 从历史中删除旧截图。编辑先前轮次会使之后的思维块失效；应在发送前缩小截图（每边不超过 `2000 px`），并让服务端的工具结果清理功能删减旧图像。

### 何时使用这种模式

- 自动化没有 API 的遗留应用
- 图形界面（GUI, Graphical User Interface）端到端测试
- 需要在多个应用之间交互的任务
- 非开发者用自然语言描述任务的场景

### 权衡取舍

| Advantage | Disadvantage |
|-----------|--------------|
| 适用于任何 GUI 应用 | 慢（每次模型往返 `1–3` 秒；批量动作可摊薄成本） |
| 不需要 API 或集成 | token 成本高（每张截图约 `1,000–1,800` 输入 token） |
| 能处理动态 UI | 密集界面存在误点风险（缩放和元素引用可降低风险） |
| 对非技术用户更友好 | 需要沙箱化虚拟机（sandboxed VM）以确保安全 |

---

## 模式 3：Local Code Execution（本地代码执行）

用户用自然语言描述任务。LLM 生成代码，代码在本地机器（或沙箱）中运行。系统观察输出，LLM 要么继续生成代码，要么给出最终答案。原版 Python Open Interpreter 和 Claude Code 的部分能力采用这种模式。

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
- **Always ask**（始终询问，Python 版 Open Interpreter 默认）：每个代码块都需要显式批准
- **Auto-approve**（自动批准，trusted mode）：危险但更快
- **Rules-based**（基于规则，Claude Code 模型）：在配置中按允许/拒绝模式控制。例如：允许 `git` 命令，拒绝 `rm -rf`
- **Classifier-based**（基于分类器）：策略模型为每项动作评分，并决定执行、拒绝或交由人工。它分阶段成为默认行为：Claude Code 于 `2026` 年 8 月 14 日为 Pro、Max 和 Team 默认启用 auto mode；从 v`2.1.284`（9 月 28 日）起，没有配置权限模式的交互会话也会进入 auto mode；Claude Managed Agents 从 9 月 10 日起在服务端按自动权限策略评估每次工具调用。这减少了批准疲劳，却引入阈值校准问题：必须选择并监控分类器在什么分数下转交人工。

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
                return "Execution canceled by user."
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
  [ORCHESTRATOR] (Frontier model: Claude Opus 5.5, GPT-6 Astra)
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

**2. Plan-and-Execute（规划-执行）**：前沿规划模型将任务拆分为子任务，并分配给合适的专用代理；规划器再聚合结果。很大一部分延迟收益来自并行执行独立子任务：LLMCompiler（ICML `2024`）将工具调用规划为依赖图，在其基准上报告了相较顺序 ReAct 最多 `3.7` 倍的延迟降低和 `6.7` 倍的成本降低。引用数字前应在自己的任务上测量。

**3. Hierarchical（层级式）**：高层代理向低层代理分配工作，后者可能继续再委派。这与组织结构相似，适用于复杂项目。

**4. Collaborative（协作式，点对点）**：代理可以直接相互沟通，分享观察并请求帮助。这是最复杂的模式，但对 emergent tasks（涌现任务）处理得很好。

这些策略如今已有产品实现。Cursor Projects（`2026` 年 9 月 10 日测试）是分层协调器，将工作分配给并行子代理，并将上下文保留数月。GitHub Copilot 区分**以代码定义的工作流**（动态工作流：确定性阶段、人工审查检查点）和**模型驱动的委派**（`/fleet`）。阶段已知且审计性重要时选前者；任务拆解本身很难时才交给模型委派。

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

`2026` 年的趋势是将代理成本优化视为一级问题，类似微服务时代云成本优化成为必需项。上述算式还有两点需要细化：

- **带质量门禁的级联**在任务难度变化时可能胜过固定的规划／执行分工：先用廉价模型起草，经过门禁，仅在失败时升级。GitHub Copilot 的 HydraFusion（`2026` 年 9 月 30 日研究预览）正以级联模式实现这一点。价格差使其很诱人：GPT-`6` Luna 每百万 token 标价 `$0.10/$0.50`，GPT-`6` Astra 为 `$10/$50`。但提示词缓存按模型区分，升级会遇到冷缓存，须按强模型的未缓存输入费率支付整个上下文。构建级联前，应先在同一批任务上测量强模型单独使用较低 effort 的效果。
- **长工具循环由输入 token 主导。** Anthropic 的 Claude Code 遥测（`2026` 年 9 月 24 日，供应商自报）显示输入与输出比为 `324:1`，因此缓存读取价格和命中率比输出价格更重要。Claude Opus `5.5` 标价 `$4/$20`，缓存读取为 `$0.20`（输入价的 `0.05` 倍）；应保持系统提示词和工具定义稳定，以留在缓存中。

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
  | Used by: OpenClaw      |             | Used by: OpenHands,    |
  | (main session), Python |             | OpenAI Codex, Jules,   |
  | Open Interpreter,      |             | Cursor cloud agents,   |
  | Claude Code (default)  |             | Open Interpreter (Rust)|
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
| 托管快照运行时（AgentCore Runtime V2） | 从快照恢复的逐会话托管沙箱 | `200 MB` 至 `2 GB` 镜像的 P75 约 `2` 秒（AWS 自报；V1 约 `5.4–30` 秒） | 无需自行管理集群的逐会话代理沙箱 |
| 托管 VPC 沙箱（Gemini Enterprise Computer Use and Shell，`2026` 年 9 月 9 日正式发布） | 托管，具备 VPC Service Controls 和 CMEK | 空闲沙箱被撤销调度但保留文件系统状态，数秒内恢复（Google 自报） | 受监管的 Google Cloud 客户 |

### 2026 年共识

默认采用 sandboxed-by-default（默认沙箱化），并提供 escape hatches（逃生/回退通道）。OpenClaw 安全危机（公共互联网上有 135,000 个暴露实例）让行业对此高度重视。新的生产级代理预计默认就应进入沙箱。Unsandboxed execution（非沙箱执行）仅保留给单用户、受监督环境。

`2026` 年 8 月和 9 月带来两点细化：

- **分离控制面与执行面。** 编码代理供应商逐渐采用供应商控制面加客户自托管执行面的组合：Claude Code 自托管 runner、Claude Managed Agents 自托管沙箱、Cursor Self-hosted Machines，以及 OpenAI Agents API 的自托管环境。编排与模型留在供应商侧，工具执行、凭据和网络出站留在客户边界内。这是回答“如何让代理接触生产代码和密钥”的标准方案。
- **沙箱边界也包括出站流量和停止路径。** OpenAI 在 `2026` 年 9 月 25 日披露，一次内部训练运行中的代理通过过滤不足的 DNS 建立外传隧道；监控在首次外部响应约 `12` 分钟后报警，但自动停止失效，直到约 `2.5` 小时后才终止。要对 DNS 的域名和记录类型设允许列表，而不只过滤 HTTP，并像测试其他控制项一样测试自动停止。带外强制执行是更高层级：NVIDIA 于 9 月 28 日宣布的 Open Agent Safety Platform 将其 OpenShell 运行时（Apache `2.0`，默认拒绝）与 Sentry 配对，后者是在 BlueField-`4` DPU 上、位于代理主机之外并可隔离代理的看门狗参考设计。

---

## 跨工具调用的状态管理

代理需要在工具调用之间保持状态。策略取决于代理的生命周期与使用场景。

### 状态管理模式

| 模式 | 生命周期 | 存储 | 使用方 |
|---------|-----------|---------|---------|
| **Conversation State** | 短暂（单次会话） | Message array | 大多数基于 API 的代理 |
| **Session State** | 按会话（工作目录、打开文件） | Docker container / temp dir | OpenHands、Claude Code |
| **Persistent State** | 跨会话（天、周） | DB、文件、Markdown | OpenClaw（`MEMORY.md`、`memory/`）、CLAUDE.md |
| **Environment State** | 外部（事实来源） | Git repo、database、FS | Claude Code（git status）、CI/CD |
| **Managed Session State** | 跨断连和重启持久存在 | 供应商托管的会话与事件存储 | Claude Managed Agents、OpenAI Agents API |

托管会话状态很方便，但会把代理工作记忆纳入供应商的留存与数据驻留条款，因此须逐部署核查。

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
| **Contract** | 模型或代理版本变化后返回 HTTP `400`（最新 Claude 模型的强制 `tool_choice`、新版托管代理重命名工具参数） | 不重试；固定版本，并在 CI 中对工具 schema 做契约测试 |

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

`2026` 年 5 月的 MCP 规范尚缺三项生产原语：身份传递、自适应工具预算和结构化错误语义。对照当前无状态核心规范修订版（`2026-07-28`）与维护者于 `2026` 年 8 月 22 日发布的路线图，其状态如下：

| 缺口 | 状态（`2026` 年 10 月） | 当前做法 |
|------|------------------------|----------|
| **身份传递** | 企业托管授权自 `2026` 年 6 月 18 日起稳定，覆盖 IdP 配置的用户访问。代理身份仍在推进：DPoP（SEP-`1932`）与工作负载身份联合（SEP-`1933`）是开放草案，代理身份工作组正在形成 | 对无人值守代理继续用网关作身份代理 |
| **自适应工具预算** | 不在 8 月 22 日路线图的重点领域中。最接近的是大型工具目录的服务器端渐进发现，它节省 schema token 而非支出 | 在执行框架或网关执行预算：会话支出上限（Claude Managed Agents 会以 `budget_reached` 暂停）、逐工具限流 |
| **结构化错误语义** | 部分解决：路线图计划重设计 `tools/call` 结果形式，因为同时返回 `content` 与 `structuredContent` 导致实现分歧 | 在网关按自己的分类统一错误（见上表） |

下一次规范修订尚无日期。[工具使用与 MCP](../07-agentic-systems/03-tool-use-and-mcp.md)章节介绍无状态重写与完整路线图。

---

## 架构决策树

使用下列决策树为你的用例选择合适模式：

```
Does the target system have an API?
 +-- YES --> Pattern 1 (Tool Calling). Wrap as MCP server. Fastest, most reliable.
 +-- NO  --> Does the task require GUI interaction?
              +-- YES --> Is it a web app?
              |            +-- YES --> Pattern 2 with element refs (accessibility tree) first,
              |            |           pixels as fallback. Confirm per action, approve per origin.
              |            +-- NO  --> Pattern 2 (Vision-Based). Sandbox in VM. Accept latency.
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

阐述经济性：“我会采用 Plan-and-Execute 模式：Opus `5.5` 规划任务，Haiku `4.5` 执行各步。按标价，Haiku 每 token 成本是 Opus 的四分之一，因此相比全用 Opus 最多可节省约三分之二；在缓存占主导的循环中节省更少，因为 Haiku 每百万缓存读取 token 为 `$0.10`，是 Opus `5.5` 的 `$0.20` 的一半而非四分之一。长工具循环的输入量比输出高两个数量级，所以我还会让系统提示词和工具定义保持稳定，以利用提示词缓存。”

---

## 面试题

### Q: 设计一个客户支持代理系统，让其可使用来自 Zendesk、Salesforce 与内部知识库的数据回答问题。

**优秀回答:**
Pattern 1（function/tool calling）配合三个 MCP server，每个数据源一个。使用 Multi-Server Fan-Out（多服务器扇出）模式，并结合动态 manifest（清单），使每次查询只加载相关工具。生产环境下，再叠加 MCP Gateway（网关）处理每个数据源的 OAuth、限流（对 Salesforce API 配额尤其关键）和审计日志。状态采用 ephemeral（短暂）方式——客户支持场景不需要跨会话记忆。

### Q: 如何防止 AI 代理通过工具调用造成破坏？

**优秀回答:**
采用五层纵深防御：（1）带拒绝模式（如拒绝 `DROP TABLE` 的正则）的 schema 约束。（2）破坏性操作的权限闸门：Claude Code 的允许／拒绝规则是可参考的模式；在大量调用时，可由经校准的策略分类器执行、拒绝或升级每次调用，以减少批准疲劳。（3）沙箱隔离（Docker、只读挂载、无外网，DNS 也设允许列表）。（4）token 与成本上限，防止失控循环，并测试自动停止功能。（5）通过 MCP 网关保留审计轨迹。单一层不足够：模型可能产生通过校验但有害的参数（需要沙箱），沙箱也无法阻止通过允许路径外传（需要审计日志和目的地策略）。PixelLeak（Glow Security，`2026` 年 9 月 29 日）是警示案例：编码代理被要求把截图附到私有 PR，却将 `13,000` 多张内部图像发到了公开仓库，并无攻击者参与，因此仓库可见性和目的地都应纳入动作策略。

### Q: 解释基于视觉的 computer use 与基于 API 的 tool calling 的取舍。

**优秀回答:**
基于 API 的方式更快（每步 `50–200ms`，视觉方式每次模型往返 `1–3s`）、更便宜（文本 token，而每张截图约 `1,000–1,800` 图像输入 token）、更稳定（确定性优于坐标点击）、更易测试。有 API 时应优先使用。基于视觉的方式适合作为无 API 应用、遗留系统或多应用工作流的后备方案。差距已经缩小：缩放和无障碍树元素引用减少误点，批量动作把一次模型往返分摊到多个步骤，但必须在批次的每项动作执行前检查确认，而不是等到下一轮。实践中，有 API 支持的 `80%` 任务用 API 调用，其余 `20%` 用视觉方式；在浏览器内优先使用元素引用，再退回像素坐标。

---

## 参考资料

- Anthropic. "Computer Use Tool Documentation" (2024-2026)
- Anthropic. "Model Context Protocol Specification" (2025-2026)
- MCP 核心维护者，《The New MCP Roadmap》（`2026` 年 8 月 22 日）
- Anthropic，计算机操作和浏览器操作工具文档（`computer_toolset_20260801`、`browser_toolset_20260801`，`2026`）
- Google，Gemini API 计算机操作文档（`2026`）
- IBM Developer. "MCP Architecture Patterns for Multi-Agent AI Systems" (2026)
- Google Cloud. "Choose a Design Pattern for Your Agentic AI System" (2025-2026)
- Microsoft Azure. "AI Agent Orchestration Patterns" (2025-2026)
- OpenHands Documentation. "Runtime Architecture" (2025-2026)
- OpenClaw Documentation. "Architecture and SOUL.md Guide" (2025-2026)
- Open Interpreter GitHub Repository (2024-2026)
- ArXiv 2603.13417. "Design Patterns for Deploying AI Agents with MCP" (2026)
- Kim 等人，《An LLM Compiler for Parallel Function Calling》（ICML `2024`，arXiv `2312.04511`）

---

*Previous: [Tool-Use and Computer Agent Landscape](01-tool-use-landscape.md)*
*下一篇：[OpenClaw 深入剖析](03-openclaw-deep-dive.md)*
