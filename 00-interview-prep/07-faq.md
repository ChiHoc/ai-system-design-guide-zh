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

需求很强，薪酬通常与高级软件工程师持平，在前沿实验室里往往更高。风险在于技术栈变化很快：去年重要的框架今天可能已经被弃用。跨版本持续增值的能力是评估、系统设计和基于证据的调试。参见 [Job Market Trends](06-job-market-trends-2026.md)。

---

## RAG

### 什么是 RAG？

检索增强生成（Retrieval-Augmented Generation）是在查询时获取外部上下文（文档、行、代码、图片），并把它放进 LLM 的提示词中，让模型基于这些内容作答，而不是从训练数据里幻觉生成。对于任何需要知道训练截止点之外信息的 LLM，它都是最常见的生产模式。参见 [RAG Fundamentals](../06-retrieval-systems/01-rag-fundamentals.md)。

### RAG 是如何工作的？

用户查询会被转换为检索请求，系统从知识库中检索最相关的 chunk（分块）（向量数据库、关键词索引、图数据库或混合方式），对结果重排，再将排在前面的结果作为上下文传给 LLM 生成。两个主要失败点是检索阶段（没有返回正确的 chunk）和生成阶段（模型忽略或误用 chunk）。大多数 RAG 失败都源于检索失败。

### 长上下文窗口会让 RAG 过时吗？

不会。即使 Claude Opus 4.7、Claude Sonnet 4.6、GPT-5.5 和 Gemini 3.1 Pro 已经支持 100 万到 200 万 token 的上下文窗口，RAG 在成本、延迟、新鲜度和语料规模上仍然占优。企业数据集（SharePoint、日志归档、代码 monorepo）会超出任何上下文窗口。RAG 的作用像过滤器，找到值得放进那个高价值窗口的 0.01% 数据。参见 [RAG vs Long Context](../06-retrieval-systems/14-production-rag-at-scale.md)。

### RAG 和 fine-tuning 有什么区别？

RAG 在查询时通过上下文注入知识。Fine-tuning（微调）则把行为固化到权重里。经验法则是：**RAG 用于事实，fine-tuning 用于形式**。当知识会变化、需要引用，或者数据必须留在模型外部时，用 RAG。想要稳定的语气、严格的输出格式，或者在重复任务上更低延迟时，用 fine-tuning。参见 [Fine-Tuning Strategies](../03-training-and-adaptation/02-fine-tuning-strategies.md)。

### 最好的向量数据库是哪一个？

没有单一最佳。Pinecone 在托管规模和 SLA 上更强。Qdrant 在开源性能上领先（在 1,000 万向量规模下 p99 大约 12ms）。Weaviate 的原生混合检索（BM25 + dense + metadata）最完整。到了需要超过 5,000 万向量的分布式规模时，Milvus 是合适选择；如果你已经在用 Postgres，且索引少于 1,000 万向量，pgvector 就是正确答案。参见 [Vector Databases](../06-retrieval-systems/04-vector-databases.md)。

### 什么是 contextual retrieval？

Contextual retrieval（上下文检索）是 Anthropic 的一种技术：在 embedding 和索引每个 chunk 之前，先给它加上一段由 LLM 生成的简短上下文摘要，让 chunk 自带它在文档中的位置。Anthropic 报告称，在混合检索下，检索失败减少了 49%，与 reranker（重排器）结合时减少了 67%。参见 [Contextual Retrieval](../06-retrieval-systems/10-contextual-retrieval.md)。

### 什么是 hybrid search？

Hybrid search（混合检索）把稀疏关键词检索（通常是 BM25）与稠密向量检索结合起来，并通常用 Reciprocal Rank Fusion 将两条排序结果合并成一条。稀疏分支捕捉精确 token（产品编码、函数名、稀有名词）；稠密分支捕捉同义词和意图。所有现代向量数据库都默认支持混合检索。参见 [Hybrid Search](../06-retrieval-systems/05-hybrid-search.md)。

### 什么是 GraphRAG？

GraphRAG 会从语料中提取实体和关系，构建知识图谱，并通过遍历而不是仅靠（或同时靠）向量相似度来查询。它适合 **聚合类问题**（例如“汇总这 50 份合同中的所有法律风险”），因为向量 RAG 返回的往往是相关但彼此割裂的 chunk。Microsoft 的 LazyGraphRAG 将昂贵的社区摘要推迟到查询时执行，从而降低摄取成本。参见 [GraphRAG](../06-retrieval-systems/07-graph-rag.md)。

### RAG 的最佳 chunk 大小是多少？

没有通用答案。300-500 token、重叠 50 token 的 chunk 对正文来说是合理默认值。代码和结构化数据更适合更大的 chunk（1,000-2,000 token）。更大的收益来自 **structure-aware chunking（结构感知切分）**（按标题、段落、代码块切分）、**contextual chunking（上下文切分）**（预置摘要）以及 **hierarchical chunking（分层切分）**（索引小 chunk，返回父级上下文）。参见 [Chunking Strategies](../06-retrieval-systems/02-chunking-strategies.md)。

---

## 智能体

### 什么是 AI 智能体？

AI 智能体是一个系统：LLM 决定下一步做什么，执行一个工具，观察结果，再次决策，如此循环。最简单的智能体是 ReAct 模式：Thought → Action → Observation → repeat。现代智能体（Claude Opus 4.7、GPT-5.5 reasoning、DeepSeek-R2）把推理步骤内置到了模型本身。参见 [Agent Fundamentals](../07-agentic-systems/01-agent-fundamentals.md)。

### 智能体和聊天机器人有什么区别？

聊天机器人只响应消息。智能体会在世界中**执行动作**：运行代码、调用 API、读取文件、发送消息、预订预约。这个区别很重要，因为动作很难回滚，所以智能体需要完全不同的护栏、沙箱以及人类在环模式。参见 [Agentic Security](../07-agentic-systems/09-agentic-security-and-sandboxing.md)。

### 什么是 MCP（Model Context Protocol）？

MCP 是一个开放协议，让 LLM 应用通过标准接口连接工具和数据源。Anthropic 于 2024 年 11 月发布了它。治理权于 2025 年 12 月转移到 Linux Foundation 的 Agentic AI Foundation。采用已经非常普遍：Anthropic、OpenAI、Google、Microsoft、AWS 都支持它。截至 2026 年 5 月，已有超过 2,300 个公开 MCP 服务器。参见 [Tool Use and MCP](../07-agentic-systems/03-tool-use-and-mcp.md)。

### 最好的智能体框架是哪一个？

三大框架覆盖了大多数生产需求。**LangGraph**（基于图，2026 年初在星标数上超过 CrewAI）是有状态多智能体控制流并带 checkpointing 的默认选择。**CrewAI**（现已到 v1.13，在 60% 以上的 Fortune 500 中使用）适合基于角色的业务自动化。**Microsoft Agent Framework**（2026 年 2 月 RC 1.0、2026 年 Q2 GA）是面向企业 .NET 和 Python 的 AutoGen 与 Semantic Kernel 的整合继任者。参见 [Framework Selection Guide](../09-frameworks-and-tools/08-framework-selection-guide.md)。

### 什么是 agentic RAG？

Agentic RAG 用一个循环替代线性的“先检索再生成”流程：智能体决定检索什么，评估结果是否足够，如果不够就再次查询。常见模式包括 Self-RAG（模型输出反思 token）、Corrective RAG（单独的 grader）、Adaptive RAG（分类器决定深度）以及 multi-hop decomposition（多跳分解）。建议按每次查询 8-12 秒、三到四轮迭代来预算。参见 [Agentic RAG](../06-retrieval-systems/08-agentic-rag.md)。

### computer-use 智能体是如何工作的？

computer-use 智能体会截取桌面或浏览器截图，决定鼠标和键盘动作，执行后再截一张图。三种主流生产方案是 Claude Computer Use（通过截图实现跨操作系统）、Google Gemini Computer Use（通过 DOM 感知优化浏览器场景）、OpenAI Operator（聚焦网页任务）。Claude Sonnet 4.6 在 OSWorld-Verified 上达到 72.5%，相较于 2024 年 10 月发布时的 14.9% 有明显提升。参见 [Computer-Use Agents](../17-tool-use-and-computer-agents/04-computer-use-agents.md)。

### 什么是 context engineering？

Context engineering（上下文工程）是为智能体每次推理回合整理其看到的完整 token 集合（system prompt、tools、检索数据、先前工具结果、消息历史），这不同于只写一次好指令的 prompt engineering。它之所以重要，是因为长时间运行的智能体会出现 **context rot（上下文腐化）**：窗口被过时的工具输出填满后，准确率会下降。核心技术包括 compaction（压缩，汇总并重启循环）、just-in-time loading（即时加载，保留引用并按需取回）、structured note-taking（结构化记录，将进度写在窗口外）和 sub-agent isolation（子智能体隔离，把细节密集的子任务委派到干净窗口并返回简短摘要）。目标是每轮使用最小的高信号 token 集。参见 [Context Engineering](../05-prompting-and-context/05-context-engineering.md)。

### 什么是 Agent Skills？

Agent Skills 是智能体按需加载的一组指令、脚本和资源文件夹，用于让智能体在某项任务上专门化。每个 skill 都是一个 `SKILL.md` 文件，包含 YAML 元数据和可选的随附文件。它们采用 **progressive disclosure（渐进式展开）**：名称和描述放在系统提示里，完整的 `SKILL.md` 只在智能体判断相关时加载，引用的文件也按需加载，以保持上下文尽量小。Skills 与 MCP 互补：MCP 把智能体连到工具和数据，Skills 教它如何使用这些工具。参见 [Building Tool-Use Agents](../17-tool-use-and-computer-agents/05-building-tool-agents.md)。

---

## 模型

### 现在最好的 LLM 是什么？

截至 2026 年 6 月，没有单一最佳模型，但能力上限已经上移：**Claude Fable 5**（6 月 9 日）是 Anthropic 最强且广泛发布的模型，是带安全护栏的 Mythos 级模型，价格为每 100 万 token 输入 $10、输出 $50。低于这个上限时，排行榜会按任务分化。**Claude Opus 4.8** 在 SWE-Bench Pro 上以 69.2% 领先长周期编码任务，且价格只有 Fable 的一半。**GPT-5.5** 保持着 SWE-bench Verified（88.7%）和 Terminal-Bench 的领先表现。**Gemini 3.1 Pro** 在 GPQA Diamond 上以 94.3% 领先科学推理。**Claude Sonnet 4.6** 仍然是性价比最高的主力模型，价格为 $3/$15。参见 [Model Taxonomy](../02-model-landscape/01-model-taxonomy.md)。

### Claude / GPT / Gemini / DeepSeek 的费用是多少？

价格每月都会变化。截至 2026 年 6 月，前沿封闭模型大致是每百万输入 token $3-15、每百万输出 token $15-75，缓存可将重复前缀成本降低 75%-90%。中端模型（Claude Sonnet 4.6、GPT-5.5-mini、Gemini 3.1 Flash）大致为每百万输入 $0.30-3、每百万输出 $1-15。**DeepSeek 重新定义了价格底线**：V4 Pro 为每 100 万 token 输入 $0.435、输出 $0.87（2026 年 5 月 22 日起 75% 折扣永久化），V4 Flash 为每 100 万 token 输入 $0.14、输出 $0.28，并提供 100 万 token 上下文窗口，在很多任务上大约比封闭前沿模型便宜 10 倍。请始终交叉核对提供商的定价页面以获取当前费率。参见 [Pricing and Costs](../02-model-landscape/03-pricing-and-costs.md)。

### Claude Opus 和 Claude Sonnet 有什么区别？

Opus 是 Anthropic 的前沿层级（Opus 4.8：4.x 系列中最聪明，价格 $5/$25）。Sonnet 是生产主力：大约有 90% 的 Opus 质量，价格约为其 60%。Haiku 是快速层：便宜、低延迟，适合路由和分类。三者之上还有 Claude Fable 5（$10/$50），这是值得支付 2 倍 Opus 价格的能力上限。正确的模式是：把简单查询路由给 Haiku，中等查询给 Sonnet，复杂查询给 Opus，只有顶尖能力要求的工作才用 Fable。参见 [Model Selection](../02-model-landscape/04-model-selection-guide.md)。

### 我应该使用开源模型吗？

如果你关注高并发下的单次查询成本、数据驻留，或者需要微调，那么答案是肯定的。开源权重的质量已经接近闭源前沿，只差约 5-15 个百分点（Qwen3-Embedding-8B 领先 MTEB Multilingual，Llama 4 Maverick 和 DeepSeek V4 Pro 都是有竞争力的前沿选择）。代价在于运维：你要自己负责推理栈、GPU 账单和安全补丁。参见 [Model Landscape](../02-model-landscape/01-model-taxonomy.md)。

### 什么是 prompt caching？

Prompt caching（提示缓存）会在推理服务器上把固定 prompt 前缀的 KV cache（键值缓存）保持为热状态，这样后续调用只需为新增 token 付费。所有主要提供商都支持它。缓存读取比新 token 便宜 75%-90%。但要注意：缓存写入通常贵 25%，因此只有在 TTL（通常是 5 分钟）内至少重复使用同一个前缀 3-5 次时，缓存才划算。参见 [KV Cache and Context Caching](../04-inference-optimization/02-kv-cache-and-context-caching.md)。

---

## 评估

### 如何评估一个 LLM？

LLM 评估是分层进行的：**无参考指标**（通过 LLM-as-judge 衡量真实性、相关性、连贯性）用于快速迭代，**黄金测试集**用于回归，**任务专属指标**（如 QA 的 exact match、翻译的 BLEU、代码的 pass@k）用于特定任务。对于 RAG，使用 RAG Triad：context relevance、faithfulness、answer relevance。参见 [LLM Evaluation](../14-evaluation-and-observability/01-llm-evaluation.md)。

### 什么是 LLM-as-judge？

LLM-as-judge 是用一个 LLM 按照评分标准（正确性、帮助性、安全性）给另一个 LLM 的输出打分。它适用于人类评估无法扩展的场景，但存在已知偏差：位置偏差、冗长偏差、自我偏好偏差。标准做法是使用更强的模型作为 judge（Claude Opus 4.8 或 GPT-5.5 reasoning）、随机化位置，并用一小批人工标注样本进行校验。

### 最好的 LLM 可观测性工具是哪一个？

领先的平台有 **Langfuse**（最佳自托管开源方案，2026 年 1 月被 ClickHouse 收购）、**Braintrust**（最适合基于评测的 CI/CD 和质量门控）、**LangWatch**（最适合智能体仿真）、**LangSmith**（LangChain 原生）以及 **Arize Phoenix**（OTel 原生）。应根据部署方式（SaaS vs self-hosted）、是否需要 CI/CD 门控，以及你对某个特定框架的使用程度来选择。参见 [Observability](../14-evaluation-and-observability/02-observability.md)。

### 什么是 RAGAS？

RAGAS（Retrieval Augmented Generation Assessment）是用于 RAG 评估的 Python 库。它提供无参考指标（faithfulness、answer relevance、context relevance）和基于参考的指标（context recall、context precision），并使用 LLM-as-judge 计算。它是任何 RAG 评估流水线的事实起点。参见 [RAG Evaluation](../06-retrieval-systems/13-rag-evaluation-patterns.md)。

### 你如何在生产环境中检测和处理模型漂移（model drift）？

模型漂移（model drift）来自两个方面：**provider** 悄悄更新了模型（或你迁移了版本），以及你的**流量（traffic）**偏离了你对提示词（prompt）和评估集（eval）进行调优时的分布。检测方式是：明确固定模型版本（pin model versions），每天对固定版本与最新版本运行 canary eval 套件，对输出分布统计（如长度、拒答率、格式有效性）以及抽样在线切片（sampled live slice）上的人类打分质量（judge-scored quality）进行跟踪，并对偏差触发告警。应对方式是：一套冻结的黄金样本集（frozen golden set）可帮助你判断是模型发生变化还是流量变化；在采用新版本前重新运行提示词评估（prompt evals），并保留旧版本热备以实现即时回退（rollback）。将无故质量下降视为事故（incident），按值班响应流程处理，而不是当作偶发现象。

---

## Inference

### 什么是 vLLM？

vLLM 是一个开源的 LLM 推理引擎（inference engine），首创了 PagedAttention（类似虚拟内存分配 KV cache 的方式）。当工作负载是“Llama、Mistral、Qwen 或 DeepSeek 在 continuous batching 下运行”时，它是默认的开源推理引擎。它是主要引擎中最易运维、最容易打补丁的方案。多模态（multimodal）部署必须使用 v0.18.2+，因为存在 2026 年 2 月披露的 CVE。见 [Serving Infrastructure](../04-inference-optimization/06-serving-infrastructure.md)。

### vLLM 和 SGLang 的区别是什么？

两者都是开源推理引擎（inference engine）。vLLM 的模型覆盖面更广，且运维成熟度更高。SGLang 在结构化输出（structured-output）和函数调用（function-calling）任务上，由于异步约束解码（async constrained decoding）可实现约 29% 的吞吐量提升，并且通过 RadixAttention 具备行业领先的前缀缓存复用（prefix-cache reuse）。重要提醒：截至 2026 年 5 月，SGLang 的多模态路径存在未修复的 CVE，因此多模态流量应改用 vLLM v0.18.2+。

### 什么是 TensorRT-LLM？

NVIDIA 的推理引擎（inference engine）。在 H100/H200/B200 上，它相比 vLLM 和 TGI 可提供 2-4 倍更高吞吐量，但代价是 1-2 周的搭建成本（setup）和较强的 NVIDIA 锁定（lock-in）。当你已投入 NVIDIA 资源，且吞吐收益足以覆盖运维成本税（operational tax）时，这是正确选择。

### 如何优化 LLM 推理成本？

五个高杠杆手段：**模型级联（model cascading）**（将简单请求路由到小模型、复杂请求交给 frontier 模型）、**提示词缓存（prompt caching）**（可减少重复前缀 75%-90%）、**语义缓存（semantic caching）**（对相似问题直接跳过 LLM 调用）、**量化（quantization）**（使用 FP8 或 4-bit 权重以在单 GPU 上承载更多负载）、以及**持续批处理（continuous batching）**（vLLM/SGLang 按 iteration 级批处理）。这些方法通常能在不牺牲质量的前提下，将推理成本（inference cost）稳定降低约 10 倍。见 [Cost Optimization](../04-inference-optimization/07-cost-optimization-playbook.md)。

### 什么是推测解码（speculative decoding）？

推测解码（speculative decoding）允许 LLM 在一次前向计算中生成多个 token：先由更便宜的“草稿”模型（draft model）或主模型上的额外头（如 Medusa）预测若干后续 token，再在目标模型上进行一次并行校验。其收益是生成耗时（wall-clock）提升 2-3 倍，且不损失质量（zero quality loss）。该能力内置于 vLLM 与 TensorRT-LLM。见 [Speculative Decoding](../04-inference-optimization/03-speculative-decoding.md)。

### 什么是 token 预算，如何实施？

token 预算是针对选定范围的硬上限（hard ceiling）消耗控制：按单请求（最大输入 + `max_tokens` 输出）、按用户/租户（tenant）每日、按 agent 任务（step budgets，防止 runaway loop）以及按团队每月昂贵层级（expensive tiers）分配。执行层应在网关（gateway）而非提示词中实现：在分发前计数 token，拒绝或降级超出单请求上限的请求，原子地扣减租户配额，并在超出步骤预算时优雅终止 agent 执行并上报升级（clean escalation）。实践上通常是“预算 + 路由”组合：当租户接近配额时，路由将其降级到更低成本层级，而非直接阻断。

### 如何设计跨多个 LLM provider 的故障降级（fallback）？

应将 provider 当作不仅仅有可用性差异，而且有策略差异（policy differences）的不可靠依赖。常见模式是：按任务类型配置一个主 provider，加一到两个备选 provider；按 provider 配置熔断器（circuit breaker），监控错误率、P95 延迟和限流余量，并在触及硬阈值前进行预先流量切换（pre-emptive traffic shifting）。真正上线的设计与白板方案有三点关键差异：**provider 配对提示词（provider-paired prompts）**（为 Claude 调优的提示词在 GPT-5.5 上通常效果下降，因此提示词必须按 provider 版本化）、**缓存经济学（cache economics）**（故障切换会重置前缀缓存，因此“热”主干道有时可战胜名义更便宜的“冷”后备）、以及**策略感知降级（policy-aware fallback）**（provider 可能拒绝你产品所需的内容类别，这类失败类别常规健康检查无法捕获）。每月用 game-day drill 验证整条链路。

---

## Memory

### 最佳的 AI agent memory 框架是什么？

截至 2026 年 5 月，较成熟的四个选项是：**Mem0**（最广泛的独立内存层，LoCoMo 上 92.5，LongMemEval 上 94.4）、**Zep**（具备时间感知的生产级流水线与原生对话摘要）、**Letta**（为长时运行 agents 提供类操作系统分页的无限内存）、**Cognee**（面向 KG-first 的 RAG 重型工作流）。按场景选择：聊天机器人个性化 → Mem0；大规模生产 agent → Zep；长时程任务 agent → Letta；KG 驱动的 RAG → Cognee。见 [Agentic Memory](../08-memory-and-state/04-agentic-memory-mem0.md)。

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

OWASP LLM Applications Top 10（v2.0，2025 年发布）是 LLM 安全风险的权威清单。主要条目包括：Prompt injection、不安全输出处理（insecure output handling）、训练数据投毒（training data poisoning）、模型拒绝服务（model denial of service）、供应链漏洞（supply chain vulnerabilities）、敏感信息泄露（sensitive information disclosure）、不安全插件设计（insecure plugin design）、过度代理权限（excessive agency）、过度依赖（overreliance）和模型盗用（model theft）。2026 年针对 agentic 应用的更新在高风险项中新增了 goal hijacking、identity abuse、cascading failures。见 [LLM Security](../12-security-and-access/01-llm-security.md)。

### 什么是 AI agents 的沙箱（sandboxing）？

沙箱（sandboxing）将 agent 生成并执行的代码与宿主系统隔离。标准实现是使用短生命周期微虚拟机（E2B、Docker、Firecracker），它们可在 10ms 内启动、运行代码并销毁。没有沙箱时，受到 prompt injection 的 agent 可能执行 `rm -rf /` 或外传机密；有了沙箱，最坏情况也只是销毁一个一次性容器。

---

## 相关阅读

- [问题库（110 道高级面试题）](01-question-bank.md)
- [回答框架](02-answer-frameworks.md)
- [常见陷阱](03-common-pitfalls.md)
- [白板练习](04-whiteboard-exercises.md)
- [AI 就业市场趋势](06-job-market-trends-2026.md)

---

*有想加入这里的问题？在仓库里提交 issue 或 PR。*
