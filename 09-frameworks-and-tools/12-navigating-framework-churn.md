# 应对框架更迭

AI orchestration framework（AI 编排框架）的变化速度，往往快于其教学内容更新。LlamaIndex 与 LangChain 在 2024 年都对整个包结构进行了重构，并在一年内移除了最初的核心抽象。结果就是：一门一年前录制的课程，常常在第一次 `import` 时就失败。本文讨论这个问题、它为什么发生，以及如何学习和构建，使你的知识与代码都能经受住这种更迭。

一句话版本：**frameworks（框架）是你这个季度交付所依赖的东西；primitives（底层原语）才是你长期保留的东西。前者要锁定版本，后者要深入学习。**

## 目录

- [触发点：为什么一个课程在全新安装后会坏掉](#触发点-为什么一个课程在全新安装后会坏掉)
- [到底发生了什么变化](#到底发生了什么变化)
- [为什么课程和教程会过时](#为什么课程和教程会过时)
- [这个教程还新吗？30 秒检查](#这个教程还新吗-30-秒检查)
- [在更迭中存活：锁定、冻结、隔离](#在更迭中存活-锁定、冻结、隔离)
- [框架 vs 原始 SDK vs 薄层封装](#框架-vs-原始-sdk-vs-薄层封装)
- [哪些内容能跨版本迁移](#哪些内容能跨版本迁移)
- [必须升级时如何迁移](#必须升级时如何迁移)
- [一份耐久学习作战手册](#一份耐久学习作战手册)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 触发点：为什么一个课程在全新安装后会坏掉

一个常见且真实的例子是：学习者开始看一门评价很高的 LlamaIndex 视频课程，复制第一段单元格代码，却遇到

```
ImportError: cannot import name 'SimpleDirectoryReader' from 'llama_index'
```

或者，稍后遇到

```
TypeError: Can't instantiate abstract class OpenAI with abstract method _prepare_chat_with_tools
```

学习者或录制课程本身都没有问题。课程的 notebook 环境固定了旧版本（一个流行的 LlamaIndex 课程会附带 `requirements.txt`，其中写着 `llama-index==0.10.30` 和 `llama-index-llms-openai==0.1.26`），视频录制时也正是基于这些版本。今天在一个全新的 `pip install llama-index` 环境里，你会拿到一个次要版本更新了很多次的新版本，其中 import 路径和类层次结构都已经改变。第一个错误是导入路径迁移；第二个是 *partial*（部分）版本不匹配，也就是核心包和集成包不同步升级，导致基类上出现了一个新抽象方法，而旧版集成包从未实现它。

这不是 LlamaIndex 的问题，也不是课程质量的问题。它是“快速变化的框架 + 固定版本的录制教学内容”叠加后的默认结果。理解这个机制，才能让你在几秒内修好，而不是直接放弃。

---

## 到底发生了什么变化

两次重构定义了现代的 churn（快速更迭）现象。下面的版本号截至 2026 年 6 月是准确的；请把它们视为一个快照，因为它们还会继续变化。

### LlamaIndex

- **v0.10（2024 年 2 月）：大拆分。** 单体 `llama-index` 包被拆成仅包含抽象层的 `llama-index-core`，以及数百个独立版本管理的集成包（`llama-index-llms-openai`、`llama-index-embeddings-*`、`llama-index-vector-stores-*`、`llama-index-readers-*`）。独立的 `llama-hub` 也被并入。导入同时发生了两类变化，这就是旧 notebook 会立刻失败的原因：
  - 从顶层到 core：`from llama_index import VectorStoreIndex` 变成 `from llama_index.core import VectorStoreIndex`
  - 集成包迁移到各自包中：`from llama_index.llms import OpenAI` 变成 `from llama_index.llms.openai import OpenAI`
- **v0.11（2024 年 8 月）：旗舰抽象被移除。** `ServiceContext`（0.10 之前每个教程都用来连接 LLM、embedding 和 parser 的对象）在 0.10 中被弃用，并在 0.11 中被 *removed*（移除）。它的替代品是全局 `Settings` 对象。同一版本还把代码库迁移到了 Pydantic v2。
  ```python
  # OLD (pre-0.10, removed in 0.11)
  from llama_index import ServiceContext, set_global_service_context
  service_context = ServiceContext.from_defaults(llm=llm, embed_model=embed)
  set_global_service_context(service_context)

  # CURRENT
  from llama_index.core import Settings
  Settings.llm = llm
  Settings.embed_model = embed
  ```
- **Workflows（2025 年 6 月达到 1.0，如今已是 2.x）：新的应用层。** 事件驱动、类型化状态的 agentic orchestration（代理式编排）被拆出为独立的 `llama-index-workflows` 包。注意很多总结里常见的修正错误：达到 1.0 并进入 2.x 的是 *Workflows*；核心框架本身到 2026 年中期仍在 0.x 线（`llama-index` 大约在 0.14.x），并不是“1.x”线。
- **Codemod：** `llamaindex-cli upgrade <dir>` 可以自动重写旧 import。

### LangChain

- **包拆分。** `langchain-core`（Runnables、消息、基础接口，也是唯一带有向后兼容保证的包）、`langchain-community`（第三方集成）、`langchain`（chains 和 agents），以及按厂商划分的 partner packages（`langchain-openai`、`langchain-anthropic` 等）。LCEL，`|` 管道式组合模型，取代了旧的 `Chain` 子类。
- **v0.3（2024 年 9 月）：Pydantic v1 到 v2。** 传入 Pydantic v1 模型的用户代码会出问题。
- **v1.0（2025 年 10 月）：agent 运行在 LangGraph 上。** 构建 agent 的推荐方式变成了 `create_agent`，它运行在 LangGraph runtime（运行时）和 middleware（中间件）系统之上。旧版 chains（`LLMChain`、`RetrievalQA`、`AgentExecutor`、`initialize_agent`）被移到了 `langchain-classic`，虽已弃用但没有删除。到 2026 年中期，当前的 `langchain` 大约是 1.3.x，并且要求 Python 3.10+。
- **弃用映射：** `LLMChain` 对应 LCEL 管道（`prompt | llm | parser`）；`RetrievalQA` 对应 `create_retrieval_chain`；`AgentExecutor` / `initialize_agent` 对应 `create_agent`；旧版 `Memory` 类对应 LangGraph checkpointers（检查点器）。

每个框架更深层的细节见 [LangChain 深入解析](01-langchain-deep-dive.md) 和 [LlamaIndex 章节](04-llamaindex.md)。这里的重点是这个 *pattern*（模式）：单体拆成 core 加插件，原本方便的抽象被移除，agent 层转向 graph runtime（图运行时）。两大主流框架都大致在相隔一年时走上了这条路。

---

## 为什么课程和教程会过时

录制课程和博客文章记录的是一个 *snapshot*（快照）：视频以及通常配套的固定 `requirements.txt` 或托管 notebook 环境，都冻结在录制那一刻。而 live package index（实时包索引）不会冻结。学习者新建环境时，解析器会拉取当前版本，这些版本早已越过了那个 pin（版本锁定点），录制代码自然就和安装后的 API 对不上了。

失败模式是可以预期的：

- **Moved imports（导入位置迁移）**（`cannot import name ... from 'llama_index'`）：符号已经迁移到 `.core` 或某个合作方 package。
- **Removed symbols（符号被移除）**（`ImportError: ServiceContext`，或引用 `LLMChain` / `RetrievalQA`）：抽象被删除了，不只是移动。
- **Partial-upgrade mismatches（部分升级不一致）**（`Can't instantiate abstract class ...`）：核心包和集成包不同步漂移；通常的修复方式是一起升级整套包（`pip install -U llama-index llama-index-llms-openai`）。
- **Model-name deprecations（模型名弃用）**（`gpt-3.5-turbo-0301` 不再可用）：教程固定的是一个 provider 之后已经退役的 model ID。这也是同一种更迭，只是更底层一层。

大多数教学平台只会把版本约束编码在 bundled lockfile（随包附带的锁文件）或冻结的托管环境里，而不会明显展示“本课程录制于 X 版本”这样的提示。所以在代码报错之前，陈旧性是看不出来的。

---

## 这个教程还新吗？30 秒检查

在把数小时投入任何课程、文章或 notebook 之前，先做这 30 秒检查：

1. **对照框架发布节奏看日期。** 2024 年的 LlamaIndex 或 LangChain 教程，从结构上就已经至少落后了一次完整重构。
2. **打开随附的 `requirements.txt` 或 lockfile，比较 pin 与当前版本。** 如果 `llama-index==0.10.x` 对上当前 `0.14.x`，或者任何 `langchain<1.0`，就要预期会有 breakage（破坏性变更）。
3. **在代码里 grep（搜索）已知被移除的符号。** 它们的存在几乎能立刻暴露材料是否过时：
   - LlamaIndex：`ServiceContext`、`LLMPredictor`、`set_global_service_context`，或 `from llama_index import` 而没有 `.core`
   - LangChain：`LLMChain`、`RetrievalQA`、`initialize_agent`、`AgentExecutor`
4. **优先把项目自己的当前 quickstart（快速入门）当作唯一真相来源**，把第三方课程当成 *concepts*（概念）来源，而不是直接照抄代码。

---

## 在更迭中存活：锁定、冻结、隔离

防止“昨天能跑，今天坏掉”的纪律是：

- **精确锁定版本。** 一个没有版本约束的 `llama-index` 是意外破坏的最大来源。至少要对直接依赖使用 `==` 精确 pin。
- **使用真正的 lockfile（锁文件）**，把传递依赖也一起固定下来。到 2026 年，流行的是 [`uv`](https://docs.astral.sh/uv/)（`uv.lock`、`uv sync`）；Poetry（`poetry.lock`）和 pip-tools（`pip-compile`）也很成熟。正在形成的标准是工具无关的 `pylock.toml`（PEP 751）。把 `pyproject.toml` 当作意图，把 lockfile 当作现实，并提交 lockfile。
- **把拆分包作为一个整体来 pin。** 对 LlamaIndex 和 LangChain 来说，`core` 与所有集成包必须一起移动。所谓“抽象类”错误，正是部分升级的直接表现。升级要整套一起升，不是只升一个包。
- **把每个项目隔离在各自的 virtualenv 或容器里。** 永远不要装进系统 Python。托管课程 notebook 本质上就是“固定 Python base image + lockfile”的容器，而本地学习者通常会省略这一步。
- **把弃用警告当成倒计时，而不是噪音。** 运行时要让 warnings 可见；每一条警告都会指出替代方案，并且通常会标明移除版本。把警告静音，往往就是把一个可工作的应用变成下一次常规升级时就会坏掉的应用。

---

## 框架 vs 原始 SDK vs 薄层封装

这是一个 2026 年仍然现实的问题，因为框架最初存在的理由已经部分消失了。LangChain 和 LlamaIndex 出现时，各 provider API 并不一致，统一层很有价值；后来 tool/function calling（工具/函数调用）和结构化输出在主要 provider SDK 里逐渐趋同，框架的抽象价值变小了，而它的 churn（更迭）成本并没有随之下降。

| 层级 | 适用场景 | 成本 |
|------|----------|------|
| **原始 provider SDK** (`anthropic`, `openai`) | 你只调用少量模型，想要最稳定的表面 API 和最清晰的调用栈，或者你在写库代码 | 检索、agent loop（代理循环）和重试逻辑都要你自己实现 |
| **Framework**（LangChain、LlamaIndex） | 你需要大量集成（几十种 vector store、loader）或开箱即用的 RAG/agent 脚手架来快速推进 | 依赖膨胀、调用栈变深、版本更迭 |
| **Thin layer**（你自己在 SDK 外包的一层接口） | 生产系统希望在不改动调用点的情况下切换模型或框架 | 需要一点前期设计 |

对于生产环境，thin layer 往往是更合适的选择：依赖 provider SDK（或者只依赖 `langchain-core`），在你自己的小接口后面封装，把 framework 相关细节集中到一个可替换模块里。关于 abstraction leakage（抽象泄漏）的经验法则是：某一层隐藏得越多，而这些内容又越是你调试时必须理解的东西（检索排序、token budgeting、tool-call loop），它就越危险。正是这种有泄漏的 agent 抽象，推动了 LangChain 去构建 LangGraph。关于选型的深入讨论，见 [框架选型指南](08-framework-selection-guide.md)。

---

## 哪些内容能跨版本迁移

这是形成耐久学习的核心。framework API（框架 API）的半衰期大约是一年；其下层概念的半衰期则是整个领域本身。学习投入要按这个比例分配。

**可迁移内容（要深学）：**
- **RAG mechanics（RAG 机制）：** 切块与拆分策略、embedding + 相似度检索、重排序，以及 context-relevance / groundedness / answer-relevance（上下文相关性 / 事实依据性 / 答案相关性）这组三联评估。它们会在每一次 `VectorStoreIndex` 改名后继续存在。
- **The agent loop（代理循环）：** 模型调用、工具选择、工具执行、观察、重复，以及 state、memory 和 human-in-the-loop。无论它叫 `AgentExecutor`、`create_agent`，还是手写的 `while` 循环，底层循环都是一样的。
- **Provider-native primitives（provider 原生原语）：** 工具/函数调用、结构化输出、流式输出、token 和上下文预算。现在这些能力在厂商之间已经标准化，因此这是最耐久的一层。
- **工程纪律：** lockfile、可复现环境、阅读 changelog、eval harness（评测框架）。这些都是纯粹可迁移的价值。

**不可迁移内容（不要过度投入）：** 精确的 import 路径、类名、构造函数签名、当月的全局配置对象（`ServiceContext` vs `Settings`），以及这个季度被官方推荐的 chain helper（`LLMChain` vs LCEL vs `create_agent`）。背这些，其实是在背一个持续贬值的资产。

---

## 必须升级时如何迁移

当你真的需要把一个真实代码库往前推进时：

1. **先在分支里升级，先动 lockfile**，并且按 major step（大版本步进）一点一点升级（0.10 到 0.11 到 0.12），不要一次跨太多。
2. **先运行官方 codemod（如果有）**，例如 `llamaindex-cli upgrade`，再让 deprecation warnings（弃用警告）和 import errors（导入错误）驱动你的迁移清单。
3. **使用 bridge packages（桥接包）**（`langchain-classic`、`llama-index-legacy`）让应用在渐进迁移期间保持可运行，而不是一次性大爆炸迁移。
4. **用 eval harness 验证行为**，而不只是验证 import 是否通过。一个能编译但悄悄改变检索质量或 agent 成功率的迁移，是你希望在生产前就捕获到的回归。见 [LLM 评测](../14-evaluation-and-observability/01-llm-evaluation.md)。

---

## 一份耐久学习作战手册

1. **先用原始 SDK 从零搭一遍 agent loop（代理循环），不加任何 framework，这样你会理解框架到底替你自动化了什么。** 之后你会更快地排查框架故障。
2. **然后再引入 framework（框架）** 以换取广度和速度，但把它的 API 当成可替换层，放在你自己的 thin interface（薄接口）后面。
3. **锁定所有依赖，提交 lockfile，并持续让弃用警告可见。**
4. **重建推理，不要死记硬背。** 当框架改名时，把新 API 映射回它所实现的底层 primitive（`create_agent` 本质上就是 LangGraph 上的 agent loop），而不是从头再学一遍。
5. **在投入时间之前，先做上面的 30 秒检查。** 用过时课程学概念，用项目当前文档学代码。

如果你想看经过筛选且验证过时效性的课程，请见 [COURSES.md](../COURSES.md)。这个文件会带日期并反复复核，正是因为本页所描述的同类 churn。

---

## 面试题

### Q: 一位同事照着一个六个月前的 LlamaIndex 教程做，导入时失败了。你会怎么解释，并且会怎么修复？

**强回答：**
这个教程是基于更早的 pinned version（固定版本）录制的，而新的安装拉到的是更高版本，导致包结构变化了。从 v0.10 开始，LlamaIndex 变成了 `llama-index-core` 加各个独立的集成包，所以像 `from llama_index import SimpleDirectoryReader` 这样的顶层导入，现在必须改成 `from llama_index.core import SimpleDirectoryReader`；而 `ServiceContext` 则在 v0.11 中被 `Settings` 全局对象替代并移除。如果报错是 “can't instantiate abstract class OpenAI”，那就是核心包和 OpenAI 集成包出现了部分升级不一致；修复方式是一起升级它们。更长期、可持续的修复是使用 pinned lockfile（精确锁定 + 锁文件）保证环境可复现，并阅读迁移指南，而不是靠猜。再往后，我会建议同事把项目当前 quickstart 作为代码来源，而把教程只当概念材料。

### Q: 既然这些 framework churn 很快，你怎么决定到底要不要用它？

**强回答：**
我会看这个框架到底在给我带来什么。它最初的价值是平滑不一致的 provider APIs，但工具调用和结构化输出已经在主要 SDK 之间趋同，所以这部分价值在下降。如果我需要大量集成能力，或者需要开箱即用的脚手架来快速推进，那 framework 是值得的。如果我只是做少量模型调用，或者在写库代码，原始 provider SDK 会更稳定，也更容易 debug。生产上我通常会把 SDK 包在自己的一层 thin interface（薄接口）后面，这样框架或模型切换时只会影响一个模块。不管选什么，我都会 pin + lock，并把 framework-specific（框架相关）代码隔离起来，因为我默认这个季度的 blessed API（官方推荐 API）迟早会被弃用。

---

## 参考资料

- LlamaIndex v0.10 迁移指南: https://developers.llamaindex.ai/python/framework/getting_started/v0_10_0_migration/
- LlamaIndex ServiceContext 到 Settings 指南: https://developers.llamaindex.ai/python/framework/module_guides/supporting_modules/service_context_migration/
- LlamaIndex Workflows 1.0 公告（2025 年 6 月）: https://www.llamaindex.ai/blog/announcing-workflows-1-0-a-lightweight-framework-for-agentic-systems
- LangChain 和 LangGraph 1.0（2025 年 10 月）: https://www.langchain.com/blog/langchain-langgraph-1dot0
- LangChain v0.3 迁移（Pydantic v2）: https://docs.langchain.com
- `uv`（锁文件和可复现环境）: https://docs.astral.sh/uv/
- PEP 751（`pylock.toml`，标准锁文件格式）: https://peps.python.org/pep-0751/

---

*下一篇: [文档处理](../10-document-processing/01-ocr-and-layout.md)*
