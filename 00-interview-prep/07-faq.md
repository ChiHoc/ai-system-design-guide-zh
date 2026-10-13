# 常见问题：AI 工程、RAG 与智能体

针对人们最常问的现代 AI 系统设计问题，给出简短、直接的答案。每个回答都指向该主题在文档中深入讲解的章节。

## 目录

- [通用：AI 工程师角色](#通用)
- [RAG 与检索](#rag)
- [智能体与工具使用](#智能体)
- [模型与选型](#模型)
- [评估与可观测性](#评估)
- [推理与成本](#inference)
- [记忆与状态](#memory)
- [安全与安全性](#security)

---

## 通用

### 什么是 AI 工程师？

AI 工程师是在大语言模型（Large Language Models，LLM）之上构建生产系统的人。这个角色位于传统软件工程与机器学习研究之间：更少做模型训练，更多围绕已有模型进行系统设计。日常工作涵盖提示词与上下文工程、检索流水线、智能体循环、评估框架，以及让这一切持续在线的基础设施。参见 [AI Job Market Trends](06-job-market-trends-2026.md)。

### AI 工程师和 ML 工程师有什么区别？

ML 工程师负责训练、微调并发布模型。AI 工程师将现有模型（通常通过 API）组合成产品。ML 工程师把大量时间花在数据集和训练循环上。AI 工程师把大量时间花在提示词、RAG、智能体、评测和延迟上。在同时做这两类工作的跨国大公司里，这条边界会变得模糊。参见 [Transition Guide](../TRANSITION_GUIDE.md)。

### 我该如何成为 AI 工程师？

如果你已经在写生产代码，差距并不大：学习 LLM 的行为、学习 RAG 和智能体模式、学习评估，并掌握一套推理栈（inference stack）。[Transition Guide](../TRANSITION_GUIDE.md) 会把你当前的角色（后端、前端、QA、PM、数据、DevOps）映射到合适的 AI 岗位，并列出需要补齐的具体技能。

### AI 工程应该学习什么编程语言？

Python 是 AI 工作的默认语言。TypeScript 是最常见的第二语言，因为前端和边缘智能体栈大多在这里构建。C# 和 Go 常出现在企业基础设施岗位中。大多数生产 AI 代码看起来都像普通应用代码：HTTP 客户端、队列消费者、数据库调用，再加上对模型提供商的调用。

### AI 工程是个好职业吗？

对有经验的工程师来说，是的：需求旺盛，薪酬与高级软件工程相当，在前沿实验室往往高得多（levels.fyi 自报的 2026 年 10 月中位数：Anthropic 软件工程师为 $883K，OpenAI 为 $710K，而美国 AI 工程师整体为 $160K）。但入门门槛更窄。在 AI 暴露程度最高的职业中，初级岗位在招聘信息中的占比从 2021 年的 29% 降至 2026 年的 10%（Indeed Hiring Lab）；尽管应届毕业生失业率尚未激增，但自 2022 年末以来，受影响最大的专业（以计算机科学为首）的毕业生起薪相对受影响最小的专业下降了约 13%（美国人口普查局工作论文，2026 年 9 月）。因此，最佳路径是保留资历的横向转岗。另一个风险是快速迭代：去年重要的框架今天可能已进入维护模式。跨版本持续增值的能力是评估、系统设计和基于证据的调试。参见 [Job Market Trends](06-job-market-trends-2026.md)。

### 我在哪里能获得模拟 AI 系统设计面试或导师指导？

要与人练习，而不只是读网页。模拟面试会暴露自学难以发现的问题：还没讲到评估就时间耗尽、没有说明取舍，以及面试官改变约束时卡住。维护本指南的 Om 为希望进入高级 AI 岗位的工程师提供一对一模拟 AI 系统设计面试、答案和简历评审，以及持续导师指导。可在 [EngineBogie](https://enginebogie.com/u/ombharatiya) 或 [Topmate](https://topmate.io/ombharatiya) 预约。与同样准备类似面试流程的人互相模拟也有效，并以 [Answer Frameworks](02-answer-frameworks.md) 作为评分标准。

---

## RAG

### 什么是 RAG？

检索增强生成（Retrieval-Augmented Generation）是在查询时获取外部上下文（文档、行、代码、图片），并把它放进 LLM 的提示词中，让模型基于这些内容作答，而不是从训练数据里幻觉生成。对于任何需要知道训练截止点之外信息的 LLM，它都是最常见的生产模式。参见 [RAG Fundamentals](../06-retrieval-systems/01-rag-fundamentals.md)。

### RAG 是如何工作的？

用户查询会被转换为检索请求，系统从知识库中检索最相关的 chunk（分块）（向量数据库、关键词索引、图数据库或混合方式），对结果重排，再将排在前面的结果作为上下文传给 LLM 生成。两个主要失败点是检索阶段（没有返回正确的 chunk）和生成阶段（模型忽略或误用 chunk）。大多数 RAG 失败都源于检索失败。

### 长上下文窗口会让 RAG 过时吗？

不会。顶级模型如今普遍拥有约 100 万 token 的上下文窗口（Claude Opus 5.5、Sonnet 5.5 和 Fable 5.1；GPT-6 Astra 和 GPT-6 Sol 为 105 万；Gemini 3.8 Flash），但 RAG 在成本、延迟、新鲜度和语料规模上仍然占优。长提示词被视为惩罚项而非便利：输入超过 272K token 后，OpenAI 会按长上下文费率对整个请求计费（GPT-6 Sol 从每 1M $2/$10 变为 $4/$15）；xAI 则在 200K 及以上将每个 token 的价格翻倍。相比之下，Anthropic 对 Claude 4.6 及更高版本在 100 万 token 内采用统一定价。企业数据集（SharePoint、日志归档、代码 monorepo）会超出任何上下文窗口。RAG 的作用像过滤器，找到值得放进那个高价值窗口的 0.01% 数据。参见 [RAG vs Long Context](../06-retrieval-systems/14-production-rag-at-scale.md)。

### RAG 和 fine-tuning 有什么区别？

RAG 在查询时通过上下文注入知识。Fine-tuning（微调）则把行为固化到权重里。经验法则是：**RAG 用于事实，fine-tuning 用于形式**。当知识会变化、需要引用，或者数据必须留在模型外部时，用 RAG。想要稳定的语气、严格的输出格式，或者在重复任务上更低延迟时，用 fine-tuning。参见 [Fine-Tuning Strategies](../03-training-and-adaptation/02-fine-tuning-strategies.md)。

### 最好的向量数据库是哪一个？

没有单一最佳。Pinecone 在托管规模和 SLA 上更强。Qdrant 在开源性能上领先（在 1,000 万向量规模下 p99 大约 12ms）。Weaviate 的原生混合检索（BM25 + dense + metadata）最完整。到了需要超过 5,000 万向量的分布式规模时，Milvus 是合适选择；如果你已经在用 Postgres，且索引少于 1,000 万向量，pgvector 就是正确答案（请使用修复了 IVFFlat 溢出 CVE 的 0.8.7 或更高版本）。参见 [Vector Databases](../06-retrieval-systems/04-vector-databases.md)。

### 什么是 contextual retrieval？

Contextual retrieval（上下文检索）是 Anthropic 的一种技术：在 embedding 和索引每个 chunk 之前，先给它加上一段由 LLM 生成的简短上下文摘要，让 chunk 自带它在文档中的位置。Anthropic 报告称，在混合检索下，检索失败减少了 49%，与 reranker（重排器）结合时减少了 67%。参见 [Contextual Retrieval](../06-retrieval-systems/10-contextual-retrieval.md)。

### 什么是 hybrid search？

Hybrid search（混合检索）把稀疏关键词检索（通常是 BM25）与稠密向量检索结合起来，并通常用 Reciprocal Rank Fusion 将两条排序结果合并成一条。稀疏分支捕捉精确 token（产品编码、函数名、稀有名词）；稠密分支捕捉同义词和意图。Weaviate、Qdrant、Milvus 和 Elasticsearch 都原生融合两者。Pinecone 是例外：其 BM25 全文检索（2026 年 9 月 9 日 GA）每次请求只按一种评分类型排序，因此需要分别执行两种检索，再在客户端融合结果列表。参见 [Hybrid Search](../06-retrieval-systems/05-hybrid-search.md)。

### 什么是 GraphRAG？

GraphRAG 会从语料中提取实体和关系，构建知识图谱，并通过遍历而不是仅靠（或同时靠）向量相似度来查询。它适合 **聚合类问题**（例如“汇总这 50 份合同中的所有法律风险”），因为向量 RAG 返回的往往是相关但彼此割裂的 chunk。Microsoft 的 LazyGraphRAG 将昂贵的社区摘要推迟到查询时执行，从而降低摄取成本。参见 [GraphRAG](../06-retrieval-systems/07-graph-rag.md)。

### RAG 的最佳 chunk 大小是多少？

没有通用答案。300-500 token、重叠 50 token 的 chunk 对正文来说是合理默认值。代码和结构化数据更适合更大的 chunk（1,000-2,000 token）。更大的收益来自 **structure-aware chunking（结构感知切分）**（按标题、段落、代码块切分）、**contextual chunking（上下文切分）**（预置摘要）以及 **hierarchical chunking（分层切分）**（索引小 chunk，返回父级上下文）。参见 [Chunking Strategies](../06-retrieval-systems/02-chunking-strategies.md)。

---

## 智能体

### 什么是 AI 智能体？

AI 智能体是一个系统：LLM 决定下一步做什么，执行一个工具，观察结果，再次决策，如此循环。最简单的智能体是 ReAct 模式：Thought → Action → Observation → repeat。当前前沿模型将推理步骤内置于模型本身：Claude Opus 5.5 和 Sonnet 5.5 不允许关闭思考；GPT-6 Astra 和 Gemini 3.8 Flash 则提供 reasoning-effort 或 thinking-level 设置，而非独立的 Thought 步骤。参见 [Agent Fundamentals](../07-agentic-systems/01-agent-fundamentals.md)。

### 智能体和聊天机器人有什么区别？

聊天机器人只响应消息。智能体会在世界中**执行动作**：运行代码、调用 API、读取文件、发送消息、预订预约。这个区别很重要，因为动作很难回滚，所以智能体需要完全不同的护栏、沙箱以及人类在环模式。参见 [Agentic Security](../07-agentic-systems/09-agentic-security-and-sandboxing.md)。

### 什么是 MCP（Model Context Protocol）？

MCP 是一个开放协议，让 LLM 应用通过标准接口连接工具和数据源。Anthropic 于 2024 年 11 月发布了它。治理权于 2025 年 12 月转移到 Linux Foundation 的 Agentic AI Foundation（AAIF），AAIF 现在还托管 A2A、goose 和 AGENTS.md。采用已经非常普遍：Anthropic、OpenAI、Google、Microsoft、AWS 都支持它，截至 2026 年 5 月已有超过 2,300 个公开 MCP 服务器。当前规范版本 **2026-07-28** 将协议核心改为无状态（没有 `initialize` 握手，也没有会话头）；`pip install mcp` 现在会安装 2.x Python SDK，其中 FastMCP 更名为 `MCPServer`。应像维护任何面向互联网的依赖一样及时修补 MCP 服务器和 SDK：2026 年 8 月 15 日至 10 月 1 日间发布了 73 条标题含 MCP 的安全公告，其中 9 条为严重级别。参见 [Tool Use and MCP](../07-agentic-systems/03-tool-use-and-mcp.md)。

### 最好的智能体框架是哪一个？

三大框架覆盖了大多数生产需求。**LangGraph**（1.2.x）是带 checkpointing 的有状态多智能体控制流默认选择，且在使用量上遥遥领先：截至 2026 年 10 月 1 日的一个月内，PyPI 下载量约 4,370 万次，而 CrewAI 约 240 万次。CrewAI 的 GitHub 星标仍更多（约 5.9 万对 4.3 万），这提醒我们星标衡量关注度，下载量衡量依赖使用。**CrewAI**（1.15.x）适合基于角色的业务自动化，并且自加入状态 checkpointing（1.14）和声明式 Flows（1.15）后，也具备了持久性竞争力。**Microsoft Agent Framework** 于 2026 年 4 月 GA（1.0），作为现已进入维护模式的 AutoGen 和 Semantic Kernel 的继任者，是企业 .NET 与 Python 团队的默认选择。实验室 SDK（Strands Agents、Claude Agent SDK、OpenAI Agents SDK、Google ADK）的下载量如今超过除 LangChain 和 LangGraph 外的所有独立 Python 智能体框架，这支持一种常见分工：叶子节点使用实验室 SDK，核心使用中立编排器。下载量包含 CI 安装，应将其视为相对信号。参见 [Framework Selection Guide](../09-frameworks-and-tools/08-framework-selection-guide.md)。

### 什么是 agentic RAG？

Agentic RAG 用一个循环替代线性的“先检索再生成”流程：智能体决定检索什么，评估结果是否足够，如果不够就再次查询。常见模式包括 Self-RAG（模型输出反思 token）、Corrective RAG（单独的 grader）、Adaptive RAG（分类器决定深度）以及 multi-hop decomposition（多跳分解）。建议按每次查询 8-12 秒、三到四轮迭代来预算。参见 [Agentic RAG](../06-retrieval-systems/08-agentic-rag.md)。

### computer-use 智能体是如何工作的？

computer-use 智能体会截取桌面或浏览器截图，决定鼠标和键盘动作，执行后再截一张图。产品已分化为三种形态：你自行托管的 API 工具（Anthropic 的 `computer_toolset_20260801`，自 2026 年 8 月 19 日起在 Claude API 上 GA；Gemini computer use 在 `gemini-3.8-flash` 上预览，并内置 `require_confirmation` 检查）；由供应商托管的运行时（OpenAI Agents API 自 2026 年 9 月 10 日起公测，9 月 29 日新增在 OpenAI 托管浏览器中使用计算机的能力）；以及拥有自身云端计算机和身份的持久智能体（Microsoft Copilot Autopilot，私有预览）。应谨慎解读基准数字。OSWorld-Verified 已趋于饱和；在更难的 OSWorld 2.x 排行榜（XLANG，2026 年 9 月 17 日）上，Claude Opus 5 在最高 effort 下仅完整完成 44.33% 的任务，但部分得分为 77.67%。Anthropic 报告的 Opus 5.5 的 81.8% 同样是部分得分。应按二元完成率规划容量。参见 [Computer-Use Agents](../17-tool-use-and-computer-agents/04-computer-use-agents.md)。

### 什么是 context engineering？

Context engineering（上下文工程）是为智能体每次推理回合整理其看到的完整 token 集合（system prompt、tools、检索数据、先前工具结果、消息历史），这不同于只写一次好指令的 prompt engineering。它之所以重要，是因为长时间运行的智能体会出现 **context rot（上下文腐化）**：窗口被过时的工具输出填满后，准确率会下降。核心技术包括 compaction（压缩，汇总并重启循环）、just-in-time loading（即时加载，保留引用并按需取回）、structured note-taking（结构化记录，将进度写在窗口外）和 sub-agent isolation（子智能体隔离，把细节密集的子任务委派到干净窗口并返回简短摘要）。目标是每轮使用最小的高信号 token 集。参见 [Context Engineering](../05-prompting-and-context/05-context-engineering.md)。

### 什么是 Agent Skills？

Agent Skills 是智能体按需加载的一组指令、脚本和资源文件夹，用于让智能体在某项任务上专门化。每个 skill 都是一个 `SKILL.md` 文件，包含 YAML 元数据和可选的随附文件。它们采用 **progressive disclosure（渐进式展开）**：名称和描述放在系统提示里，完整的 `SKILL.md` 只在智能体判断相关时加载，引用的文件也按需加载，以保持上下文尽量小。Skills 与 MCP 互补：MCP 把智能体连到工具和数据，Skills 教它如何使用这些工具。Skills 于 2026 年 8 月 19 日结束 Claude API Beta；MCP 服务器现可通过官方 `io.modelcontextprotocol/skills` 扩展提供它们（2026 年 9 月 13 日 Final；截至 9 月下旬，官方 SDK 支持仍处于开放 PR），该扩展将审批绑定到技能文件的 SHA-256 清单：任何文件被修改、新增或删除都会撤销审批。应将技能视为依赖：在智能体加载前固定版本并审查更新。参见 [Building Tool-Use Agents](../17-tool-use-and-computer-agents/05-building-tool-agents.md)。

---

## 模型

### 现在最好的 LLM 是什么？

截至 2026 年 10 月 1 日，没有单一最佳模型；应按任务和价格层级选择（价格均为每 1M 输入/输出 token）。**Claude Opus 5.5**（9 月 22 日，$4/$20）是 Anthropic 推荐的起点，并以 58 分位居 Artificial Analysis Intelligence Index v4.3.2 榜首。**Claude Sonnet 5.5**（9 月 28 日，$2/$10）在同一指数得分 56，价格减半；**Claude Fable 5.1**（$10/$50）则适用于 Opus 5.5 提高 effort 后仍无法胜任的工作。（AA 将 Claude 分数标为“with fallback”：安全机制介入时，部分任务会由旧模型执行。）OpenAI 产品线包括 **GPT-6 Astra**（$10/$50，能力上限模型，指数 53）、**GPT-6 Sol** 和 **GPT-6.1 Sol**（$2/$10；6.1 增加 0.05x 缓存读取），以及面向大规模工作负载的 **GPT-6 Luna**（$0.10/$0.50）。**Gemini 3.8 Flash** 是低成本多模态主力，介绍价为 $0.75/$3.75，2027 年 1 月 1 日将翻倍至 $1.50/$7.50。Google 于 9 月 30 日发布 **Gemini 4 Argon**，但截至 10 月 1 日它仅向网络防御者逐步推出，尚未进入 Gemini API。指数分数不能跨指数版本或测试框架比较，切换前请自行运行评估。参见 [Model Taxonomy](../02-model-landscape/01-model-taxonomy.md)。

### Claude / GPT / Gemini / DeepSeek 的费用是多少？

价格每月都会变化，因此应为每个数字注明日期。截至 2026 年 10 月 1 日（Standard 层级、每 1M 输入/输出 token）：能力上限层为 $10/$50（Claude Fable 5.1、GPT-6 Astra）；Claude Opus 5.5 为 $4/$20；中端层已趋同为 $2/$10（Claude Sonnet 5.5、GPT-6 Sol、GPT-6.1 Sol）；高吞吐层从 $0.10/$0.50（GPT-6 Luna）到 $0.75/$3.75（Gemini 3.8 Flash，优惠价至 2026 年 12 月 31 日，之后为 $1.50/$7.50）。**DeepSeek 现在按时段定价**：V4.1-Flash 高峰期为 $0.30/$1.20，非高峰期减半；V4-Pro 高峰期为 $1.32/$3.96；高峰期仅覆盖工作日的两个 UTC 时间窗口，因此旧的固定 $0.14/$0.28 与 $0.435/$0.87 已过时。三个修正因素与标价同样重要：缓存读取（多数模型为输入价的 0.1x，Opus 5.5 和 GPT-6.1 Sol 为 0.05x，Fable 5.1 为 0.025x）、长上下文附加费（OpenAI 在输入超过 272K 后、xAI 在 200K 及以上后收取）以及促销（GPT-5.6 Sol 的 $4/$20 促销仅保证至 2026 年 11 月 21 日，预算应按其 $5/$30 标价计算）。请始终交叉核对提供商的定价页面。参见 [Pricing and Costs](../02-model-landscape/03-pricing-and-costs.md)。

### Claude Opus 和 Claude Sonnet 有什么区别？

Opus 是 Anthropic 的旗舰层级：Opus 5.5（每 1M token 为 $4/$20）是 Anthropic 建议你优先尝试的模型。Sonnet 是生产主力：Sonnet 5.5（$2/$10）成本减半，在 Anthropic 自报的大多数智能体评测中与 Opus 5.5 仅相差几个百分点（FrontierCode 1.1 约落后 8 个百分点，但在 Terminal-Bench 4.0 上以 xhigh effort 达到 70.6%，高于 Opus 5.5 的 66.4%）。Haiku 是快速层：便宜、低延迟，适合路由和分类。Haiku 4.5 仍是唯一的 Haiku：Opus 5.5 发布时，Anthropic 曾称 Haiku 5.5 会在“未来几周”推出，但截至 10 月 1 日尚未发布，因此暂不应据此规划。三者之上是 Claude Fable 5.1（$10/$50），用于要求极高的推理和长周期工作，即使提高 Opus 5.5 的 effort 仍无法满足时才使用。路由模式仍然成立（简单查询用 Haiku，大多数流量用 Sonnet，复杂任务用 Opus，只有受能力上限约束的工作用 Fable），但层级间的质量差距如今小于价格差距，因此应由你的评测决定边界。迁移陷阱：5.5 代模型拒绝强制工具调用（`tool_choice` 为 `any` 或 `tool` 会返回 400），不允许关闭 thinking，且 Opus 5.5 默认 effort 为 `medium`，而 Opus 5 默认为 `high`。参见 [Model Selection](../02-model-landscape/04-model-selection-guide.md)。

### 我应该使用开源模型吗？

如果你关注高并发下的单次查询成本、数据驻留，或者需要微调，那么答案是肯定的。最好的开放权重模型在 Artificial Analysis Intelligence Index v4.3.2 上约落后闭源前沿 12 分（Xiaomi MiMo-V2.6-Pro 为 46、Z.ai GLM-5.3 为 45、Moonshot Kimi K3 为 44，而 Claude Opus 5.5 为 58），且领先者来自中国：得分最高的美国开放权重模型 Inkling-Small 为 26。不要只看排行榜，要阅读许可证。“开放”如今涵盖：纯 MIT（MiMo-V2.6、DeepSeek V4.1-Flash）；对收入超过 US$10B 的模型即服务运营商要求安全审查的 MIT（GLM-5.3）；以及要求部分模型即服务企业另行达成协议的自定义许可证（Kimi K3、Qwen Community License）。代价在于运维：你要自己负责推理栈、GPU 账单和安全补丁。参见 [Model Landscape](../02-model-landscape/01-model-taxonomy.md)。

### 什么是 prompt caching？

Prompt caching（提示缓存）会在推理服务器上把固定 prompt 前缀的 KV cache（键值缓存）保持为热状态，因此后续使用相同前缀的调用只需支付该前缀输入价格的一小部分。所有主要提供商都支持它。多数当前模型的缓存读取价格为输入价的 0.1x；Claude Opus 5.5 和 GPT-6.1 Sol 为 0.05x；Claude Fable 5.1 为 0.025x。写入有溢价：Anthropic 的 5 分钟缓存，以及 OpenAI GPT-5.6 及之后模型的固定 30 分钟 TTL，均为 1.25x；Anthropic 的 1 小时缓存为 2x；Gemini 则对显式缓存按小时收取存储费。按这些价格，1.25x 写入只需一次缓存命中即可回本，2x 写入需要两次，因此关键问题是命中率：保持前缀字节稳定（顶部不要放时间戳或重排工具），并进行测量，因为 OpenAI 和 Anthropic 现在都暴露了缓存诊断信息。参见 [KV Cache and Context Caching](../04-inference-optimization/02-kv-cache-and-context-caching.md)。

---

## 评估

### 如何评估一个 LLM？

LLM 评估是分层进行的：**无参考指标**（通过 LLM-as-judge 衡量真实性、相关性、连贯性）用于快速迭代，**黄金测试集**用于回归，**任务专属指标**（如 QA 的 exact match、翻译的 BLEU、代码的 pass@k）用于特定任务。对于 RAG，使用 RAG Triad：context relevance、faithfulness、answer relevance。参见 [LLM Evaluation](../14-evaluation-and-observability/01-llm-evaluation.md)。

### 什么是 LLM-as-judge？

LLM-as-judge 是用一个 LLM 按照评分标准（正确性、帮助性、安全性）给另一个 LLM 的输出打分。它适用于人类评估无法扩展的场景，但存在已知偏差：位置偏差、冗长偏差、自我偏好偏差。标准做法是使用与生成模型来自不同模型家族的强 judge（例如用 Claude Opus 5.5 评判 GPT-6 Sol 输出，或反过来）以限制自我偏好，随机化位置，并用一小批人工标注样本进行校验。不要假定第二个 judge 能发现第一个 judge 的错误：一项 2026 年 9 月的研究（arXiv 2609.29769）发现，对于廉价决策模型 judge 最自信的错误，约 96% 的 LLM-judge 判决重复了同一个错误答案；因此 judge 级联主要节省成本，而非提高准确性。人工标注集是检验相关性 judge 错误的唯一可靠手段。

### 最好的 LLM 可观测性工具是哪一个？

领先的平台有 **Langfuse**（最佳自托管开源方案，自 2026 年 1 月起属于 ClickHouse）、**Braintrust**（最适合基于评测的 CI/CD 和质量门控）、**LangWatch**（最适合智能体仿真）、**LangSmith**（LangChain 原生；自 2026 年 9 月 14 日起，SaaS trace 的延长保留期上限为 180 天）以及 **Arize Phoenix**（OTel 原生，采用 Elastic-2.0 许可证；Dynatrace 于 2026 年 8 月同意以 $915M 收购 Arize）。应根据部署方式（SaaS vs self-hosted）、是否需要 CI/CD 门控，以及你对某个特定框架的使用程度来选择。所有权变动如今也是选择标准：OpenAI 托管的 Evals 将于 10 月 31 日进入只读，并于 2026 年 11 月 30 日关闭；迁移指向 OpenAI 所拥有且仍采用 MIT 许可证的 Promptfoo。参见 [Observability](../14-evaluation-and-observability/02-observability.md)。

### 什么是 RAGAS？

RAGAS（Retrieval Augmented Generation Assessment）是用于 RAG 评估的 Python 库。它提供无参考指标（faithfulness、answer relevance、context relevance）和基于参考的指标（context recall、context precision），并使用 LLM-as-judge 计算。它是任何 RAG 评估流水线的事实起点。参见 [RAG Evaluation](../06-retrieval-systems/13-rag-evaluation-patterns.md)。

### 你如何在生产环境中检测和处理模型漂移（model drift）？

模型漂移（model drift）来自两个方面：**provider** 悄悄更新了模型（或你迁移了版本），以及你的**流量（traffic）**偏离了你对提示词（prompt）和评估集（eval）进行调优时的分布。检测方式是：明确固定模型版本（pin model versions），每天对固定版本与最新版本运行 canary eval 套件，对输出分布统计（如长度、拒答率、格式有效性）以及抽样在线切片（sampled live slice）上的 judge-scored quality 进行跟踪，并对偏差触发告警。应对方式是：一套冻结的黄金样本集（frozen golden set）可帮助你判断是模型发生变化还是流量变化；在采用新版本前重新运行提示词评估（prompt evals），并保留旧版本热备以实现即时回退（rollback）。静默变更很常见：Azure Foundry 会在 2026 年 12 月 9 日将 Standard 部署中的 gpt-4o 2024-05-13 自动升级为 GPT-5.6 Sol；Claude Opus 5.5 的默认 effort 为 `medium`，而 Opus 5 为 `high`，所以如果不固定设置，即使同家族升级也会在不改代码的情况下改变延迟、成本和质量。将无故质量下降视为事故（incident），按值班响应流程处理，而不是当作偶发现象。

---

## Inference

### 什么是 vLLM？

vLLM 是一个开源的 LLM 推理引擎（inference engine），首创了 PagedAttention（类似虚拟内存分配 KV cache 的方式）。当工作负载是“Llama、Mistral、Qwen 或 DeepSeek 在 continuous batching 下运行”时，它是默认的开源推理引擎，也是主要引擎中最易运维的方案。按上游当前安全建议，应运行 v`0.30.0` 或更高版本，并按计划及时修补；多模态部署还须确认所用版本已包含对应 CVE 修复。见 [Serving Infrastructure](../04-inference-optimization/06-serving-infrastructure.md)。

### vLLM 和 SGLang 的区别是什么？

两者都是开源推理引擎（inference engine）。vLLM 的模型覆盖面更广，且运维成熟度更高。SGLang 在结构化输出（structured-output）和函数调用（function-calling）任务上，由于异步约束解码（async constrained decoding）可实现约 29% 的吞吐量提升，并且通过 RadixAttention 具备行业领先的前缀缓存复用（prefix-cache reuse）。安全提醒：三项严重 SGLang CVE（CVE-2026-7301、-7302 和 -7304）列出的受影响版本截至 0.5.12，尚未记录已修复版本；因此应固定使用 0.5.13 或更高版本（当前为 v0.5.20），在构建中验证修复，将 SGLang 的 ZMQ socket 保持在 pod 内部，并且不要接受来自不可信调用方的自定义 logit processor。

### 什么是 TensorRT-LLM？

NVIDIA 的推理引擎（inference engine）。在 H100/H200/B200 上，它相比 vLLM 和 TGI 可提供 2-4 倍更高吞吐量，但代价是 1-2 周的搭建成本（setup）和较强的 NVIDIA 锁定（lock-in）。当你已投入 NVIDIA 资源，且吞吐收益足以覆盖运维成本税（operational tax）时，这是正确选择。

### 如何优化 LLM 推理成本？

五个高杠杆手段：**模型级联（model cascading）**（将简单请求路由到小模型、复杂请求交给 frontier 模型）、**提示词缓存（prompt caching）**（当前模型可使缓存前缀享受 90%-97.5% 折扣）、**语义缓存（semantic caching）**（对相似问题直接跳过 LLM 调用）、**量化（quantization）**（使用 FP8 或 4-bit 权重以在单 GPU 上承载更多负载）、以及**持续批处理（continuous batching）**（vLLM/SGLang 按 iteration 级批处理）。这些方法组合起来，通常能在不牺牲质量的前提下，将推理成本（inference cost）降低 10x。见 [Cost Optimization](../04-inference-optimization/07-cost-optimization-playbook.md)。

### 什么是推测解码（speculative decoding）？

推测解码（speculative decoding）允许 LLM 在一次前向计算中生成多个 token：先由更便宜的“草稿”模型（draft model）或主模型上的额外头（如 Medusa）预测若干后续 token，再在目标模型上进行一次并行校验。其收益是生成耗时（wall-clock）提升 2-3 倍，且不损失质量（zero quality loss）。该能力内置于 vLLM 与 TensorRT-LLM。见 [Speculative Decoding](../04-inference-optimization/03-speculative-decoding.md)。

### 什么是 token 预算，如何实施？

token 预算是针对选定范围的硬上限（hard ceiling）消耗控制：按单请求（最大输入 + `max_tokens` 输出）、按用户/租户（tenant）每日、按 agent 任务（step budgets，防止 runaway loop）以及按团队每月昂贵层级（expensive tiers）分配。执行层应在网关（gateway）而非提示词中实现：在分发前计数 token，拒绝或降级超出单请求上限的请求，原子地扣减租户配额，并在超出步骤预算时优雅终止 agent 执行并上报升级（clean escalation）。实践上通常是“预算 + 路由”组合：当租户接近配额时，路由将其降级到更低成本层级，而非直接阻断。

### 如何设计跨多个 LLM provider 的故障降级（fallback）？

应将 provider 当作不仅仅有可用性差异，而且有策略差异（policy differences）的不可靠依赖。常见模式是：按任务类型配置一个主 provider，加一到两个备选 provider；按 provider 配置熔断器（circuit breaker），监控错误率、P95 延迟和限流余量，并在触及硬阈值前进行预先流量切换（pre-emptive traffic shifting）。至少一个后备必须跨厂商：Anthropic 在 2026 年 8 月 16 日至 9 月 29 日间记录了至少 12 起重大或严重事故，而 9 月 29 日的 OpenAI 故障影响 API、ChatGPT 和 Codex 约 5 小时 20 分钟。真正上线的设计与白板方案有四点关键差异：**provider 配对提示词（provider-paired prompts）**（为 Claude 调优的提示词在 GPT-6 Sol 上通常效果下降，因此提示词必须按 provider 版本化）、**缓存经济学（cache economics）**（故障切换会重置前缀缓存，因此“热”主干道有时可战胜名义更便宜的“冷”后备）、**状态可移植性（state portability）**（Claude Fable 5.1、Opus 5.5 和 Sonnet 5.5 将 thinking block 绑定到生成它的模型和会话，因此会话中途故障切换必须移除先前的 thinking block）、以及**策略感知降级（policy-aware fallback）**（provider 可能拒绝你产品所需的内容类别，这类失败类别常规健康检查无法捕获）。每月用 game-day drill 验证整条链路。

---

## Memory

### 最佳的 AI agent memory 框架是什么？

四种成熟方案在 `2026` 年都发生了变化：**Mem0** 自 v`2.0`（`2026` 年 `4` 月）起以单次 ADD-only 流程抽取记忆，改用向量库中的实体链接并将冲突合并移至付费版 Dream；**Zep** 及其开源 Graphiti 引擎是带事实有效时间的时序知识图谱；**Letta** 于 `2026` 年 `8` 月归档 MemGPT 时代的服务器，改用 agent 通过普通文件工具编辑的 Git-backed Markdown 文件夹，默认不含向量索引；**Cognee** 面向知识图谱优先的 RAG 工作流。选择前还应与无记忆基线比较：`2026` 年 `8` 月的 MemTrapBench 中，所有受测记忆策略在会触发推理固着、信念扭曲的任务上都不如无记忆方案，即使存储内容正确且相关。见 [Agentic Memory](../08-memory-and-state/04-agentic-memory-mem0.md)。

### agents 中短期记忆与长期记忆有何区别？

短期记忆（short-term memory）存在于 LLM 的上下文窗口（context window），包括当前轮次、工具输出、scratchpad。长期记忆（long-term memory）跨会话持久化，存储于向量数据库（vector DB）、图数据库（graph）或关系数据库。内存架构通常继续细分为：**情景记忆（episodic）**（历史轨迹）、**语义记忆（semantic）**（关于用户/世界的抽取事实）、**程序性记忆（procedural）**（学习到的技能与 playbooks）。为某条事实选择正确层级很关键：若将会话偏好直接提升为长期记忆，可能会在不同会话间泄露。见 [Memory Architectures](../08-memory-and-state/01-memory-architectures.md)。

### 知识图谱如何帮助 AI agent？

知识图谱（knowledge graph）显式存储实体与关系（如 User → OWNER_OF → Project_A）。它为结构化关系提供确定性检索（deterministic retrieval），这是向量检索（vector search）无法直接做到的。最强模式通常是混合（hybrid）：先由向量检索按相似度找到入口节点，再通过图遍历扩展相关上下文。该模式常用于合规（compliance）、多跳推理（multi-hop reasoning）以及关系一等公民的领域（法律、医学、金融）。见 [Long-Term Memory](../08-memory-and-state/03-long-term-memory.md)。

---

## Security

### 什么是 prompt injection？

Prompt injection 是 LLM 时代的 SQL injection：用户输入或检索到的文档中的恶意内容会覆盖系统指令（system instructions），导致模型做出不该做的行为。**直接注入（Direct injection）**发生在用户提示词中；**间接注入（Indirect injection）**隐藏在模型读取的文档里（网页、邮件、PDF）。OWASP LLM Top 10 将其列为第一大 LLM 风险。见 [Prompt Injection Defense](../05-prompting-and-context/08-prompt-injection-defense.md)。

### 如何防止 prompt injection？

不存在银弹：Prompt injection 无法像 SQL 注入那样被彻底“转义（escape）”。生产防护栈通常组合使用：**输入隔离（input isolation）**（用 XML tags 标记不可信内容）、**双 LLM 模式（dual-LLM patterns）**（小型 guard model 在主模型读取前先判定意图）、**canary tokens**（检测模型是否泄露系统提示词）、**最小权限工具作用域（least-privilege tool scopes）**，以及对破坏性工具调用启用**人工审核环节（human-in-the-loop）**。见 [Agentic Security](../07-agentic-systems/09-agentic-security-and-sandboxing.md)。

### 什么是 OWASP LLM Top 10？

OWASP LLM Applications Top 10（2025 版）是 LLM 安全风险的权威清单：prompt injection、敏感信息泄露、供应链、数据和模型投毒、不当输出处理、过度代理权限、系统提示词泄露、向量与嵌入弱点、错误信息以及无界消耗。它取代了 2023 年的清单，并将不安全插件设计、过度依赖和模型盗用并入更宽泛的条目。对于智能体，还应配合独立的 OWASP Agentic Applications Top 10（2026），其涵盖 agent goal hijacking、工具滥用、身份与权限滥用、记忆与上下文投毒以及级联故障等风险。见 [LLM Security](../12-security-and-access/01-llm-security.md)。

### 什么是 AI agents 的沙箱（sandboxing）？

沙箱（sandboxing）将 agent 生成并执行的代码与宿主系统隔离。标准实现是使用短生命周期微虚拟机（E2B、Docker、Firecracker），它们可在 10ms 内启动、运行代码并销毁。没有沙箱时，受到 prompt injection 的 agent 可能执行 `rm -rf /` 或外传机密；有了沙箱，最坏情况也只是销毁一个一次性容器。

---

## 相关阅读

- [问题库（147 道高级面试题）](01-question-bank.md)
- [回答框架](02-answer-frameworks.md)
- [常见陷阱](03-common-pitfalls.md)
- [白板练习](04-whiteboard-exercises.md)
- [AI 就业市场趋势](06-job-market-trends-2026.md)

---

*有想加入这里的问题？在仓库里提交 issue 或 PR。*
