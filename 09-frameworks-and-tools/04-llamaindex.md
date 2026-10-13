# LlamaIndex

当 LangChain 专注于「Orchestration（编排）」时，**LlamaIndex** 则是 **Data-Centric AI（数据中心化 AI）** 的代表。它已经从一个 RAG 库演进为一个面向 **Workflows（工作流）** 和 **Agentic Data Manipulation（智能体式数据操作）** 的框架；其背后的公司后来把商业重心收窄到文档解析和抽取（参见[战略信号](#战略信号-公司押注文档解析)）。

## 目录

- [数据框架理念](#数据框架理念)
- [LlamaIndex Workflows（工作流）](#llamaindex-workflows-工作流)
- [高级索引：超越向量搜索](#高级索引)
- [LlamaCloud 与托管式摄入（Managed Ingestion）](#llamacloud-与托管式摄入)
- [智能体作为工具](#智能体作为工具)
- [LlamaIndex Workflows：事件驱动应用框架](#llamaindex-workflows-事件驱动应用框架)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 数据框架理念

LlamaIndex 的构建信念是：**数据比模型更重要**。
- **The Node（节点）**：每个数据片段都是一个带有丰富元数据的 “Node”（关系、摘要，以及父子链接）。
- **The Retriever（检索器）**：LlamaIndex 提供了最丰富多样的检索器集合（Summary、Knowledge Graph、Tree 和 Keyword）。

---

## LlamaIndex Workflows（工作流）

2024 年，LlamaIndex 推出了 **Workflows**，作为对 LangGraph 的回应。
- **事件驱动架构（Event-Driven Architecture）**：节点通过发出 `Events` 进行通信。
- **并发（Concurrency）**：Workflows 原生支持异步，在大规模并行数据处理中比线性链更出色。

```python
# Conceptual Workflow
class RAGWorkflow(Workflow):
    @step
    async def ingest(self, ev: StartEvent) -> RetrievalEvent:
        # Custom logic...
        return RetrievalEvent(results=nodes)
```

---

## 高级索引

1. **属性图（Property Graphs）**：将向量分块链接到图节点，用于 RAG。
2. **上下文感知分割器（Context-Aware Splitters）**：按“意义”（Meaning）而不是“Token 数量”对文本分组（使用更小的 LLM 来寻找最佳断点）。
3. **动态路径选择（Dynamic Pathing）**：检索器根据问题的复杂度决定要查询哪个索引。

---

## LlamaCloud 与托管式摄入

面向企业级规模，LlamaIndex 重点放在 **LlamaCloud** 上。
- **托管式摄入（Managed Ingestion）**：将 PDF 解析、OCR 和表格提取作为服务来处理。
- **将解析视为模型（Parsing as a Model）**：使用视觉语言模型去“理解”布局，而不是依赖基于规则的解析器。LlamaParse 和较新的 LiteParse 是该公司的解析产品；Extract 产品将解析后的文档转为类型化记录。

### 战略信号：公司押注文档解析

2026 年 9 月 11 日，CEO Jerry Liu 在 `llama_index` README 中新增说明（PR #23020），指出公司的主要关注点已转向 LlamaParse、LiteParse 以及 ParseBench、ExtractBench 基准，开源框架仍作为开放工具包提供。发布节奏与此一致：`llama-index` 0.14.22（5 月 14 日）、0.14.23（6 月 24 日）、0.14.24（8 月 19 日）和 0.14.25（2026 年 9 月 21 日，主要处理跨集成包的安全警报依赖修复），而 `llama-index-workflows` 仍在快速更新（2026 年 9 月 25 日发布 2.25.0）。8、9 月的博客内容几乎都围绕抽取：ExtractBench（8 月 11 日）、测试版 Turbo 抽取层（9 月 3 日）、LiteParse 更新（9 月 22 日）和 Extract v2.5（10 月 1 日）。

对设计的含义是：在 LlamaIndex 最擅长的地方使用它（摄入、解析、检索原语），并把它置于自有检索接口之后。对于预期运行多年的系统，不要把它作为通用 agent 运行时；开源发布节奏变慢，意味着所依赖的集成获得修复的频率也会降低。

---

## 智能体作为工具

LlamaIndex 将智能体视为 **高阶检索器（high-level retrievers）**。
- 你可以把一个复杂的 LlamaIndex 查询引擎“封装”（wrap）成一个工具，并交给 LangGraph 智能体。
- **收益（Benefit）**：智能体获得“智能数据访问（Smart Data Access）”，而无需了解向量数据库或图模式（Graph schema）的技术细节。

---

## LlamaIndex Workflows：事件驱动应用框架

2024 年的说法是“Workflows 就是我们的 LangGraph。”如今的说法不同了：Workflows 是一个适用于任何 AI 应用的通用事件驱动框架，RAG 只是其中一种用途。Workflows 现在位于独立的 `llama-index-workflows` 包中，`llama-index-core` 依赖该包，并以 `llama_index.core.workflow` 重新导出；文档将它作为主要应用入口，索引与检索器则是在步骤内部调用的基础构件（[LlamaIndex workflows docs](https://developers.llamaindex.ai/python/framework/understanding/workflows/)）。一个值得澄清的命名细节是：**Workflows** 包在 2025 年年中到达 1.0 版本，如今作为独立包已进入 2.x 版本线（`llama-index-workflows` 2.25.0，2026 年 9 月 25 日）；核心 `llama-index` 框架本身仍停留在 0.x 版本线（0.14.25，2026 年 9 月 21 日）。关于这类版本变化如何破坏教程及应对方法，可参见[应对框架变化](12-navigating-framework-churn.md)。

### 架构上发生了什么变化

| 维度 | Workflows 之前的 LlamaIndex | 以 Workflows 为中心的 LlamaIndex |
|-----------|--------------------------|-----------------------------------|
| 主要抽象 | Query engine，chat engine | 带有 `@step` 方法的 `Workflow` 类 |
| 控制流 | 线性；嵌套查询引擎 | 步骤消费 / 发出类型化的 `Event` 子类 |
| 状态 | 隐式存在于引擎实例中 | 显式 `Context`，带可序列化状态 |
| 并发 | 通过异步查询引擎进行协作 | 一等公民：发出多个事件、fan out、join |
| 持久化 | 无 | Context 可序列化为字典（`to_dict` / `from_dict`）以便恢复 |
| 流式传输 | 按引擎 | 任意步骤中的 `ctx.write_event_to_stream()` |
| 人在环（HITL） | 手动 | `InputRequiredEvent` / `HumanResponseEvent` 模式 |

### 事件驱动心智模型

```python
from llama_index.core.workflow import (
    Workflow, step, Event, StartEvent, StopEvent, Context
)

class RetrievedEvent(Event):
    nodes: list

class JudgedEvent(Event):
    nodes: list
    keep: bool

class GraphRAG(Workflow):
    @step
    async def plan(self, ctx: Context, ev: StartEvent) -> RetrievedEvent:
        await ctx.store.set("query", ev.query)  # workflows 2.x: state lives on ctx.store
        nodes = await self.retriever.aretrieve(ev.query)
        return RetrievedEvent(nodes=nodes)

    @step
    async def judge(self, ctx: Context, ev: RetrievedEvent) -> JudgedEvent:
        keep = await self.relevance_judge(ev.nodes, await ctx.store.get("query"))
        return JudgedEvent(nodes=ev.nodes, keep=keep)

    @step
    async def answer(self, ctx: Context, ev: JudgedEvent) -> StopEvent:
        if not ev.keep:
            return StopEvent(result="No good evidence found.")
        return StopEvent(result=await self.llm.acomplete(...))
```

这一设计带来两个性质：

1. 引擎完全按 **事件类型** 分发，因此新增一个分支只需要新增一个 `Event` 子类，以及一个消费该事件的步骤。不需要修改中心路由器。
2. **并发是数据驱动的**：一个步骤发出三个 `RetrievedEvent`，会自动 fan out 出三个下游 `judge` 调用，而汇合步骤会通过 `ctx.collect_events` 将它们收集起来。

### Workflows 与 LangGraph 对比

```mermaid
flowchart LR
    A[Need stateful multi-step LLM app] --> B{What is the dominant complexity?}
    B -->|Data ingestion, parsing, retrieval, indexing| C[LlamaIndex Workflows]
    B -->|Multi-agent reasoning, supervisor patterns, HITL approvals| D[LangGraph]
    B -->|Both, equal weight| E[Use both: LlamaIndex for the RAG/data side as a tool inside LangGraph]
    C --> F[Smaller graph surface, integrates LlamaParse / LlamaCloud natively]
    D --> G[Typed state, time-travel debugging, mature checkpoint store]
```

| 维度 | LlamaIndex Workflows（2.x） | LangGraph（1.x） |
|-----------|----------------------------|-----------------|
| 控制流原语 | 事件分发 | 图节点与边，以及类型化 reducer 状态 |
| 状态模型 | 自由形式的 `Context`（类 dict） | 带 reducers 的 Pydantic / TypedDict 状态 |
| 恢复 / 时间旅行 | 可序列化的 context，基础恢复 | 一等公民检查点，可从任意节点分支（[LangGraph persistence docs](https://docs.langchain.com/oss/python/langgraph/persistence)） |
| 原生集成 | LlamaParse、LlamaCloud、全部 LlamaHub 加载器 | LangSmith eval、全部 LangChain 集成 |
| 最适合的复杂度 | 数据形态：解析、嵌入、检索、精炼 | 逻辑形态：规划、行动、反思、委派 |
| 多智能体助手 | `AgentWorkflow`、function-calling 智能体（[LlamaIndex AgentWorkflow](https://developers.llamaindex.ai/python/framework/understanding/agent/multi_agent/)） | `create_agent`（LangChain 1.x）、监督者和群体模式包、自定义图 |
| 流式 UI | `ctx.write_event_to_stream` + AG-UI 协议 | `astream_events` v2，AG-UI 协议 |

什么时候应该优先选择 LlamaIndex Workflows 而不是 LangGraph：

- 难点在于 **数据摄入（data ingestion）**，而不是推理。LlamaCloud、LlamaParse 和属性图栈都是原生能力，而不是通过适配器桥接出来的（[LlamaCloud overview](https://www.llamaindex.ai/llamacloud)）。
- 你需要的是 **文档驱动的并行处理（document-driven parallelism）**：解析 1000 份 PDF，为每个 chunk 分发一个 embedding 步骤，然后汇聚成一次索引更新。
- 你正在 LlamaIndex.TS 的 **TypeScript** 生态中开发（应先对照 Python 核心检查功能覆盖度；大部分投入流向 Python 和托管式解析产品）。

什么时候 LangGraph 更占优：

- 难点在于 **智能体控制循环（agent control loop）** 本身：多个智能体、监督者模式、持久化中断、重放。
- 你需要开箱即用的 **时间旅行调试（time-travel debugging）**。LlamaIndex 的恢复能力适合崩溃恢复，但不像 LangGraph checkpoints 那样支持从任意历史状态分支。
- 你已经在 LangSmith eval 栈上，希望无需桥接就能获得 trace 级集成。

### 真实世界中的定位

很多成熟架构会同时使用两者：LlamaIndex Workflows 负责数据平面（摄入、索引、混合检索、重排）并作为工具封装起来，而 LangGraph 则负责上层的智能体控制平面。这一模式在 [AIMultiple framework comparison](https://research.aimultiple.com/agentic-ai-frameworks/) 和 LlamaIndex 自己的 [hybrid integration cookbook](https://developers.llamaindex.ai/python/framework/understanding/workflows/) 中都有提到。

如果你只为一个新的 greenfield app 选择一个框架，问题可以简化为：**你的团队会把更多时间花在数据管道（data plumbing）上，还是智能体编排（agent orchestration）上？** 这个答案决定框架。

---

## 面试题

### 问：LangChain 和 LlamaIndex 现在都有 “Graph/Workflow” 特性。你如何选择？

**标准答案：**
对于主要复杂度在摄入、多模态解析和复杂检索上的 **Data-Intensive** 任务，我会选择 **LlamaIndex Workflows**。它的事件驱动架构适合大规模并行数据处理。对于复杂度集中在“推理（Reasoning）”和“Human-in-the-loop（人在环）”逻辑上的 **Logic-Intensive** 多智能体系统，我会选择 **LangGraph**。在许多高级架构中，我们会同时使用 **Both（两者）**：LlamaIndex 作为 RAG 引擎，LangGraph 作为整体智能体监督者（agentic supervisor）。我还会考虑厂商方向：LlamaIndex 在 2026 年 9 月表示其重心是解析与提取，所以我会把它放在自有接口之后的数据平面，而不会把控制平面押在它身上。

### 问：LlamaIndex 中的“属性图（Property Graph）”是什么？为什么它优于基础的 Vector RAG？

**标准答案：**
属性图将向量的 **语义灵活性（Semantic flexibility）** 与数据库的 **结构精确性（Structural precision）** 结合起来。在基础 RAG 中，你可能会找到一段关于“Project Alpha”的内容，但不知道它的所有者是谁。而在属性图中，这个向量分块是一个与 `User` 节点和 `Timeline` 节点相连的节点。这使得可以进行 **Global Reasoning（全局推理）**，例如“找出上个月由 Tom 撰写的所有关于 Project Alpha 的文档”。基础 RAG 很可能会漏掉许多相关节点，因为它们不包含精确的关键词“Alpha”。

---

## 参考资料
- LlamaIndex. "Announcing Workflows 1.0: A Lightweight Framework for Agentic systems" (Jun 30, 2025): https://www.llamaindex.ai/blog/announcing-workflows-1-0-a-lightweight-framework-for-agentic-systems
- `llama_index` README 重点方向说明（PR #23020，2026 年 9 月 11 日）：https://github.com/run-llama/llama_index
- LlamaIndex. 集成目录（LlamaHub 已迁至此处）：https://developers.llamaindex.ai/python/framework/community/integrations

---

*下一篇：[DSPy：编程语言模型](05-dspy.md)*
