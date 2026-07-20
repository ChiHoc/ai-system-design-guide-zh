# 代理记忆与状态

记忆使代理能够随着时间学习并保持上下文。代理记忆已经从“聊天历史”演进为一种**多层认知架构**，包含四个命名层级（工作记忆、情景记忆、语义记忆、程序记忆），每一层都有各自的写入模式、延迟预算和故障模式。生产系统（Mem0、Letta、Anthropic Memory Tool + Skills、Zep/Graphiti、LangMem）如今把记忆选择视为一项一等公民的架构决策。

塑造本章的 2026 轮研究浪潮包括：A-MEM（NeurIPS 2025）、HippoRAG（多跳图检索）、多层记忆架构、HaluMem（操作级记忆幻觉基准）、MINJA / MemoryGraft（仅查询式记忆投毒攻击），以及 TTT-E2E（一个跨 Stanford、Berkeley、UCSD、NVIDIA 和 Astera 的多实验室合作项目），这是一种将上下文压缩进权重中的测试时训练方法。

## 目录

- [记忆层级](#记忆层级)
- [短期：推理轨迹](#短期-推理轨迹)
- [情景记忆：过往经历](#情景记忆-过往经历)
- [语义记忆：人格](#语义记忆-人格)
- [程序记忆：学得的技能与工作流](#程序记忆-学得的技能与工作流)
- [权衡：事实 X 应该放哪一层？](#权衡-事实-x-应该放哪一层)
- [生产实现（May 2026）](#生产实现-may-2026)
- [故障模式与缓解](#失效模式与缓解措施)
- [Mem0 与个性化](#mem0-与-agentic-personalization-智能体个性化)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 记忆层级

代理使用分层方式来存储：

| 层级 | 类型 | 技术 | 目的 |
|------|------|------------|---------|
| **L1** | 工作记忆 | 上下文窗口 / KV 缓存 | 当前任务步骤、本地变量 |
| **L2** | 情景记忆 | 向量数据库 / 图 | “我上次做了什么？” |
| **L3** | 语义记忆 | SQL / 知识图谱 | 用户偏好，“真相” |
| **L4** | 程序记忆 | 技能注册表 / 工具策略 / 工作流图 | “我该如何执行这项任务？” |

### 各层的实际属性

这些层级不只是用途不同。读取模式、写入模式、延迟预算和新鲜度预期都会推动它们采用不同的存储技术：

| 维度 | L1 工作记忆 | L2 情景记忆 | L3 语义记忆 | L4 程序记忆 |
|---|---|---|---|---|
| **存储内容** | 活动轮次、工具输出、草稿区、系统提示词 | 过往会话、轨迹、带时间戳的观察 | 提炼出的事实、偏好、实体关系 | 技能、作战手册、系统提示词指令、代码/工具序列 |
| **读取模式** | 每个 token、每一轮（在注意力中） | 基于相似度 + 近期性 + 重要性的 Top-k | 在提及实体/主题时触发查询 | 匹配任务特征时加载 |
| **写入模式** | 由推理引擎持续追加；KV 缓存变更 | 仅追加日志；在轮次边界提交 | 提取、去重、写入更新；写入时冲突解决 | 在成功/失败后反思式写入；显式人工或自我编辑 |
| **延迟预算** | <50ms（驻留在 GPU HBM 中） | 100-300ms（向量 ANN + 重排序） | 200-800ms（图遍历 + LLM 提取） | 50-500ms（文件读取或小型索引查询） |
| **新鲜度预期** | token 级新鲜；会话结束即丢失 | 数小时到数月；可容忍陈旧 | 应反映*当前*状态；陈旧就是 bug | 缓慢变化；更新是刻意的 |
| **存储技术** | HBM 中的 KV 缓存（vLLM PagedAttention 块） | 向量数据库（Pinecone、Weaviate、Qdrant），仅追加日志 | 知识图谱（Neo4j、Graphiti）、KV 存储、双时态关系行 | 文件系统（Claude `/memories/`、以 `SKILL.md` 形式的 Skills）、提示词注册表、微调 LoRA |
| **查询语义** | 位置 + 注意力 | 相似度 + 近期性 + 重要性（Park 等人的加权） | 实体-关系匹配、结构化查询、双时态过滤 | 任务特征匹配，通常是文件名或标签查询 |
| **淘汰** | 滑动窗口、按 KV 块哈希做 LRU | 衰减评分、并入 L3、归档到冷存储 | 通过时间 `valid_to` 替换；为 GDPR 显式删除 | 手动弃用、与更新的技能做 A/B 比较、版本固定 |

**这在实践中意味着什么：** 当一个事实到来时，架构问题不是“要不要记住它？”，而是“*应该放在哪一层*，采用什么新鲜度契约，以及什么淘汰规则？”放错层会产生可预测的故障模式（会话偏好被提升到 L3 会跨会话泄漏；一个稳定的用户事实留在 L2 会在两周内被淘汰）。见下文 [权衡：事实 X 应该放哪一层？](#权衡-事实-x-应该放哪一层)。

---

## 短期：推理轨迹

生产代理不再只是存储“消息”；它们存储的是**状态对象**。
- **草稿区**：提示词中一个专门区域，代理在这里对自己“写笔记”，这些内容不会展示给用户。
- **KV 缓存分块**：对于长时间运行的代理，我们使用**前缀缓存**来保持“系统指令”和“标准工具”在 GPU 内存中热存，仅替换动态任务状态。

---

## 情景记忆：过往经历

情景记忆存储“运行记录”或“轨迹”。
- 如果代理上周二抓取网站失败了，情景记忆应当阻止它今天再次尝试同一个失败的选择器。
- **模式**：任务完成时，总结“经验教训”并将其存入向量数据库。新任务开始时，针对相似的过往任务执行一次**自我搜索**。

---

## 语义记忆：人格

语义记忆存储关于用户或环境的“事实”。
- *“用户偏好 JSON 输出。”*
- *“生产数据库在 3 AM 到 4 AM 之间离线。”*

**最佳实践**：语义记忆应使用**知识图谱**。与向量搜索（模糊匹配）不同，图能够对实体和关系提供确定性的检索（例如，`User` -- `OWNER_OF` --> `Project_A`）。

---

## 程序记忆：学得的技能与工作流

程序记忆存储如何做事。情景记忆回答“以前发生了什么？”，语义记忆回答“什么是真的？”，而程序记忆回答：

“完成这类任务的正确流程是什么？”

这一层捕获可复用的技能、工具使用模式、操作规程和工作流偏好。

示例：

* “生成周报时，先从 Snowflake 拉取指标，再与仪表盘核对，然后总结异常。”
* “回复客户投诉时，先分类紧急程度，检索策略，起草回复，若置信度低则升级处理。”
* “编写 SQL 时，始终先检查 schema，再生成查询，运行验证，并解释假设。”

程序记忆对于智能代理系统尤其重要，因为许多任务不仅仅是记住事实，还需要遵循正确的行动顺序。

---

## 权衡：事实 X 应该放哪一层？

首要决策不是“哪一层”，而是*“错误的代价由谁来承担？”* L2 中一次丢失检索会导致一轮失败。L3 中一个错误事实会导致*每一轮*都失败，直到被纠正。L4 中一个被投毒的技能会传播到未来的每次调用。

### 层级选择表

| 事实 / 关注点 | 层级 | 推理 |
|---|---|---|
| “用户的 API 速率限制是 1000 req/min” | 带双时态 `valid_to` 的 L3 | 租户范围内的事实；可按实体查询；必须支持替换。不是 L4 - 它是数据，不是流程。 |
| “部署我们服务的步骤” | 作为版本化技能的 L4 | 带条件分支的多步骤配方。技能可以组合；语义三元组不行。 |
| “代理上次执行这项任务的失败尝试” | 先作为原始 L2，再在可泛化时将经验反思到 L4 | 原始轨迹属于情景记忆；泛化后的教训（“不要在高峰时段做迁移”）值得以 Reflexion 风格写入 L4。 |
| “用户偏好简洁回应” | L3 | 稳定偏好，可按 `user_id` 查询，单个三元组即可。 |
| “用户在*本次对话*中要求简洁回应” | 仅 L1 | 会话作用域；不要把可能是临时性的偏好污染到 L3。 |
| 当前天气、今日股价 | 无：调用工具 | 有外部真相来源的快速变化事实不应进入记忆。 |
| “Phoenix 项目有 A、B、C 三位团队成员” | 作为图碎片的 L3 | 多跳遍历有价值；适合 Graphiti 或 Neo4j 风格存储。 |

### 成本权衡

- **L1 主导*延迟成本***：TTFT 随上下文大小增长而上升；工作记忆越长，首 token 越慢。KV 缓存压力会让高端加速器内存接近饱和。
- **L2 在规模化时主导*存储成本***：仅追加日志会随着使用量线性增长。该 [Day-30 问题](https://cipherbuilds.ai/blog/day-30-agent-memory-problem) 描述了未清理的情景存储如何在一个月后腐蚀代理质量。
- **L3 主导*写放大成本***：每一轮都可能触发提取、去重、冲突解决。Mem0 的设计明确以写入时工作换取检索速度。
- **L4 主导*治理成本***：一个坏技能会传播到未来的每次调用。Anthropic 的“[Claude Dreaming](https://www.mindstudio.ai/blog/what-is-claude-dreaming-anthropic-agent-memory)”计划性整合通过审核门控技能更新，正是在承认这一点。

### 升级规则

有意思的设计问题是 *L2 中的一段经历何时升级为 L3 或 L4*。可 دفاع的规则应基于阈值，而不是隐式衰减：

1. **N 次独立观察**到同一模式（通常 N=3 到 5）。
2. 按来源进行**置信度加权**：用户陈述 > 工具输出 > 模型推断。
3. 在整合步骤进行**人工或 LLM 评审**（不是每轮都评审）。
4. **定时批量整合**，而不是同步按轮写入（避免写放大）。
5. **双向性**：L3 中的语义事实可以在特定任务中重新实例化为情景上下文。记忆不是单行道。

---

## 生产实现（May 2026）

这些命名系统之间的差异，与其说在“它们存什么”，不如说更在于*写入纪律*、*检索算法*和*治理姿态*。

| 系统 | 最适合的场景 | 优势 | 短板 |
|---|---|---|---|
| **[Mem0](https://github.com/mem0ai/mem0)** | 面向规模化的跨会话个性化 | 图 + 向量 + KV 的混合方案。在 LoCoMo 上达到 92.5，在 April 2026 单次重设计后在 LongMemEval 上达到 94.4（[基准](https://mem0.ai/blog/ai-memory-benchmarks-in-2026)）。在正面对比中，比 OpenAI 内置记忆高 26% 的准确率。 | 每条记忆 8K 字符上限（不适合文档）；云优先姿态带来数据主权摩擦；没有正式的信念状态模型（只能覆盖或追加）。 |
| **[Letta（前身为 MemGPT）](https://docs.letta.com/concepts/memgpt/)** | 长时间运行、以连贯性为产品的自主代理 | 类操作系统的虚拟上下文分页，跨核心 / 召回 / 归档层级；代理通过工具调用把数据换入/换出。适合“代理会永远记住”的用户体验。 | 每轮延迟高于 Mem0 风格。不针对跨用户检索精度优化。 |
| **[Anthropic Memory Tool + Skills](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)** | 一个底层同时挂载 L3 和 L4 的文件系统 | 记忆位于 `/memories/`；Skills 以 `SKILL.md` 包 + 可选脚本的形式存在；Managed Agents 在每个会话中把记忆挂载到 `/mnt/memory/`，并带有不可变版本控制（April 23，2026 GA）。定时的“Claude Dreaming”在会话之间进行整合。 | 文件系统语义把复杂性推给代理（代理必须自己把目录结构整理好）。 |
| **[Zep + Graphiti](https://github.com/getzep/graphiti)** | 当“它是什么时候变成真的？”很重要的时间性事实 | 开源时间知识图谱。每条边都有 `valid_from` / `valid_to` / `invalid_at`。在 DMR 上比 MemGPT 高 94.8% 到 93.4%。双时态查询可以区分“我们在 March 12 认为的是什么？”和“现在什么是真的？” | 写入路径更重（图提取、去重、冲突解决）而不是仅向量存储。 |
| **[LangMem + LangGraph](https://langchain-ai.github.io/langmem/)** | 当你想要用 LangGraph 编排所有四种记忆类型 | 支持情景、语义，*以及*程序记忆。LangMem 中的程序记忆允许代理根据反馈更新自己的系统提示词。后台提取异步运行。 | 绑定 LangGraph；如果你不在 LangChain 技术栈上，它吸引力较低。 |
| **[OpenAI ChatGPT 记忆](https://openai.com/index/memory-and-new-controls-for-chatgpt/)** | 消费级聊天连续性，而非生产级代理记忆 | 双层架构：显式“已保存记忆”加上轻量级会话摘要预注入上下文。在推理时跳过检索步骤，因此延迟更低。 | 相比 Mem0 风格检索，精度更差。没有用于企业集成的细粒度程序化 API。 |
| **Cursor / Windsurf** | 面向软件工程代理的、具备代码库感知的 L2/L3 | 在项目打开时对代码库建立索引；用 `@` 提及来显式引入上下文。Windsurf 的“Memories”在约 48 小时使用后学习架构模式。 | 领域被代码锁定。不是通用记忆层。 |
| **[Cognition Devin](https://cognition.ai/blog/devin-sonnet-4-5-lessons-and-challenges)** | 以仓库为作用域的工程代理 | 仓库 wiki 每隔数小时自动索引；更偏好显式压缩/总结，而非由模型管理状态。Devin Search 是一个代理式代码库记忆查询接口。 | 对工程工作流有强意见。 |

**Generative Agents（Park 等人 2023）** 仍然是每篇综述都会引用的参考架构。近期性 / 重要性 / 相关性的检索公式（`alpha_recency * recency + alpha_importance * importance + alpha_relevance * relevance`，各项都归一化到 [0,1]，其中重要性由 LLM 评为 1-10）至今仍在上述大多数系统中用于生产。

**值得关注的新兴框架**（May 2026）：[Supermemory](https://supermemory.ai)、[Recallr](https://recallrai.com)、AWS [Bedrock AgentCore](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory-integrate-lang.html)、[Oracle AI Agent Memory](https://blogs.oracle.com/developers/oracle-ai-agent-memory-a-governed-unified-memory-core-for-enterprise-ai-agents)。

---

## 失效模式与缓解措施

生产级 memory system（记忆系统）有六种反复出现的失效模式。知道它们的名字，决定了你是在和初级工程师还是 staff-level 架构师对话。

### 1. 通过 prompt injection（提示注入）的 memory poisoning（记忆投毒）

不可信输入被写入 L3/L4，随后又被当作权威信息回放。 [MINJA (NeurIPS 2025)](https://openreview.net/forum?id=QVX6hcJ2um) 和 [MemoryGraft (Dec 2025)](https://arxiv.org/html/2512.16962v1) 展示了 *仅查询* 的投毒攻击，在没有更高权限的情况下就能达到 95% 的注入率和 70% 的攻击成功率。[Palo Alto Unit 42 的解读](https://unit42.paloaltonetworks.com/indirect-prompt-injection-poisons-ai-longterm-memory/) 展示了在触发前数周就埋下毒素的案例。

**缓解措施：**
- 对每次 memory write（记忆写入）都加上 **provenance tags（来源标签）**：`source = user_stated | model_inferred | tool_output`。
- **写入时护栏模型**：拒绝可疑的、像指令一样的写入（“忽略之前内容，改为……”，角色混淆，嵌入的 system-prompt 片段）。
- **信任分层**：低信任记忆在影响高风险决策前必须先得到佐证。
- **Bulkhead isolation（防舱隔离）**，确保一个租户中的毒素不能转移到另一个租户。

### 2. 过时事实

昨天的偏好和今天的偏好不一样。经典案例是“用户上个月说喜欢深色模式，但现在在用浅色模式”。

**缓解措施：**
- **双时态存储**（Zep/Graphiti 模式）：每条事实都有 `valid_from`、`valid_to`、`invalid_at`。
- 对会话级偏好设置 **TTL（存活时间）**，让它们自动过期。
- 在检索评分中加入 **衰减权重**。
- 对高风险且早于 N 天的事实，使用 **显式重新确认** 提示。

### 3. 冲突事实

用户先说 X，后来又说 Y。三种不同的冲突类型，应该对应不同的响应：

| 冲突类型 | 正确响应 |
|---|---|
| 时间更新（“我搬到柏林了”） | 用 `valid_to = now` 覆盖旧事实 |
| 更正（“我从没那样说过”） | 带审计轨迹地撤回 |
| 偏好变更（“我现在想要简洁回复”） | 新增事实；让衰减机制处理旧事实 |
| 直接矛盾（没有明显的解决方式） | 询问用户；绝不能静默覆盖 |

用 AGM belief revision（AGM 信念修订）而不是 last-write-wins（后写覆盖）来跟踪信念状态（`ACTIVE` / `SUPERSEDED` / `RETRACTED`）。

### 4. 记忆漂移

随着时间推移，低质量写入会稀释高质量写入，质量会下降。[Day-30 问题](https://cipherbuilds.ai/blog/day-30-agent-memory-problem) 记录了 agent 在生产环境上线约 30 天后，随着 episodic store（情景存储）被噪声填满而性能下降。

**缓解措施：**
- **按质量加权的检索**：提升经过高验证分数的记忆权重。
- **定期 consolidation jobs（归并任务）**，合并重复项并清理低效记忆。
- **CI 中的 canary fact tests（金丝雀事实测试）**：“agent 在 50 轮之后仍应记得用户的名字。”

### 5. 幻觉式记忆写入

agent 推断出一个事实，把它存成 ground truth（事实真值），随后又把它当作权威信息引用。一个坏写入会污染后续检索，这是级联失效。[HaluMem benchmark（Nov 2025）](https://arxiv.org/abs/2511.03506) 显示，现有系统会在写入时积累错误，并在 QA 阶段继续向前传播。

**缓解措施：**
- 使用 **schema-enforced memory objects（模式强制的记忆对象）**，将 `confirmed_facts`（带来源）和 `inferred_facts`（带置信度）分开。
- 未经明确用户信号或 tool-output（工具输出）佐证，绝不把推断自动晋升为已确认事实。
- 在 CI 中采用 HaluMem 风格的分阶段评估：分别衡量抽取精度、更新正确性和 QA 准确率，而不是把它们合并成单一端到端指标。

### 6. 跨租户泄漏

向量 ANN（近似最近邻）返回了另一个租户的邻居；缓存的 prompt 含有其他租户的数据。[实测结果](https://medium.com/@isuruig/multi-tenant-ai-infrastructure-the-5-isolation-layers-that-determine-whether-your-customers-data-stays-separate-340aaeef4922) 显示，在未隔离的多租户 RAG 中，良性查询的自然泄漏率约为 95%。

**缓解措施：**
- **物理隔离**：按租户分别建 collection（集合），不要用带元数据过滤的共享索引。
- 在 *存储层* 通过 service-account 权限强制租户范围，而不是靠应用代码。
- 为每个租户单独设置 KV-cache 前缀。
- 为记忆 blob（数据块）使用按租户划分的加密密钥，使跨命名空间读取在密码学层面就失败。

---

## Mem0 与 Agentic Personalization（智能体个性化）

**Mem0**、Zep、Letta 和 Cognee 是 agent stack（智能体栈）里 “Smart Memory（智能记忆）” 的标准框架。
- 它会自动从对话中提取 “User Insights（用户洞察）”。
- 它提供一个 “Memory API（记忆 API）”，agent 可以调用它来 `remember` 或 `forget` 特定的三元组信息。
- **影响**：agent 会显得更 “Alive（有生命感）”，因为它记得你在 3 个月前、另一个会话里提到的细节。

---

## 面试题

### 问：你如何在 agentic system（智能体系统）中处理“冲突记忆”？

**强答案：**
冲突记忆（例如，用户上周说“我喜欢蓝色”，但现在又说“我喜欢红色”）可以通过 **Temporal Weighting（时间加权）** 或 **Explicit Disputing（显式争议处理）** 来解决。在我的架构里，我会给每个记忆三元组分配 `timestamp` 和 `confidence_score`。如果新事实与旧事实冲突，agent 会被提示去 “Resolve the Conflict（解决冲突）”，方式是向用户澄清，或者默认采用最近的时间戳。我们还会使用 **Decay Functions（衰减函数）**，让更早、且未被强化的记忆最终从 active index（活动索引）中被清除。

### 问：为什么仅靠 “Context Window（上下文窗口）” 对 staff-level Agent architecture（团队级智能体架构）来说不够？

**强答案：**
第一是 **成本和延迟**：每一轮都填入 1M 个 token 的上下文，即使有 context caching（上下文缓存） 也贵得离谱。第二是 **信噪比**：大上下文窗口会出现 “In-context Learning（上下文学习）” 衰退：模型会被无关的历史轮次分散注意力。staff-level 架构会使用 **Selective Memory Retrieval（选择性记忆检索）**（基于历史的 RAG）只拉取 3-5 条最相关的历史交互，让 Reasoning Engine（推理引擎）专注于当前子目标。

### 问：你会如何为生产级 AI agent 设计 procedural memory（程序性记忆）？

**强答案：**

我会把 procedural memory 设计成 **skills registry（技能注册表）**、**workflow graph（工作流图）** 和 **tool-use policies（工具使用策略）** 的组合。每个 procedure（流程）都会定义任务类型、所需步骤、可用工具、校验检查、失效模式和升级规则。每次运行后，agent 都可以进行反思，并在发现更好方法时更新该流程。比如，如果一个 NL2SQL agent 反复失败，原因是它跳过了 schema inspection（模式检查），我们就可以把 schema inspection 编码成所有 SQL 生成任务的必需第一步，写入 procedural memory。

### 问：episodic memory（情景记忆）什么时候会从资产变成负债？

**强答案：**

episodic memory 会在三种命名模式下变成负债。第一，**索引过载**：加入 1,000 条低质量观察，会把 10 条高质量观察淹没在检索中。这在 RAG 语义下就是灾难性的遗忘。第二，**Day-30 漂移模式**：随着 episodic store 被噪声填满，agent 在生产环境中大约 30 天后质量下降，而检索无法把噪声和信号区分开。第三，**过时上下文渗漏**：过去在某种配置下成功的轨迹，在新配置下会变成 *错误* 上下文。Stripe 的成功工具序列，在用户已经切换到 Adyen 时，反而会严重误导。

缓解方式是按质量加权的检索、归并进 L3，以及对上下文敏感轨迹设置严格的最近性截断。更深层的教训是：episodic memory 从第一天起就需要 *pruning policy（剪枝策略）*。没有它，技术债会随着使用量线性累积。

### 问：当 agent 能够把内容写入自己的长期存储时，你如何防止 memory poisoning（记忆投毒）？

**强答案：**

难点在于，近期攻击（MINJA、MemoryGraft）是 *仅查询* 的，不需要更高权限。毒素会在触发前数周就被埋下。所以威胁模型应该是“每个输入都可能变成未来的权威记忆”。防御分四层：

1. **写入时的来源标注**：每条记忆都带 `source`（user-stated、model-inferred、tool-output）、`timestamp` 和 `trust_tier`。
2. **写入时护栏模型**：更小的分类器会在可疑的指令型写入进入存储前将其拒绝。
3. **佐证阈值**：高风险决策不能基于单条低信任记忆做出；它们需要多条独立的佐证写入。
4. **CI 中的 canary tests（金丝雀测试）**：合成的投毒载荷绝不能传播到输出中。每周运行。

最重要的架构分离是：agent 的 tool surface（工具面）和 memory write surface（记忆写入面）不应共享信任。工具输出在成为记忆之前，应该先经过 sanitizer（净化器）。

### 问：记忆层级选择：你会把下面这些分别放到哪一层，为什么？(a) 用户的 API 限流，(b) 部署我们服务的步骤，(c) agent 上一次执行此任务的失败尝试，(d) 今天的股票价格。

**强答案：**

(a) **L3 语义层**，并使用双时态有效性。它是一个租户范围内的事实，具有被新事实覆盖的生命周期。不是 L4，因为它是数据，不是流程。

(b) **L4 程序层**，作为 versioned skill（版本化技能）或 playbook（操作手册）。它是带条件分支的多步骤配方。技能可以组合；语义三元组不行。

(c) **L2 原始情景层**，如果失败暴露出可泛化的经验，则通过一个 *reflection hop（反思跳转）* 进入 L4。原始轨迹属于 episodic（情景）层。那个经验教训（“永远不要在高峰期跑迁移”）则值得以 Reflexion 风格写入程序层。

(d) **都不放 - 直接调用工具。** 有实时真源的快变事实，不应该进入记忆。它们本质上会过时。

通用规则是：数据放 L3，流程放 L4，观察放 L2，任何有实时真源的快变事实都不要存。

### 问：请描述你会如何设计从 episodic 到 semantic（情景到语义）的 consolidation policy（归并策略）。一条 episode（情景）在什么时候会变成事实？

**强答案：**

我会使用基于阈值的晋升策略，而不是隐式衰减：

- **频率阈值**：同一模式需要 N 次独立观察（典型值是 3 到 5）。
- **置信度加权**：user-stated > tool-output > model-inferred。
- **评审审查**：定期的批量归并任务会对候选晋升项运行一个 LLM judge（或在高风险领域由人工审阅者处理）。
- **定期执行，而非同步执行**：归并通过 cron 离线执行，而不是每轮都做。这样可以避免写放大。
- **双向流动**：L3 中的语义事实可以重新实例化为特定任务的 episodic 上下文。记忆是双向流动的。

要避免的陷阱是仅依靠衰减权重进行隐式归并。它在小规模下可行，但在生产规模下会悄悄失效，因为没有审计轨迹能解释“这个事实为什么出现在 L3 里”。

### 问：你的 agent 记忆库里有 50M 条记忆，分布在 10K 个租户中。你如何保证跨租户隔离？如果隔离失败，你的 blast radius（爆炸半径）有多大？

**强答案：**

架构上有五层隔离：

1. **存储层物理隔离**：按租户分别建 collection 或 shard，而不是带元数据过滤的共享索引。那种带 tenant-id 的共享索引模式在 bug 下会 fail open（失效时默认放行）。
2. **通过 service-account 范围强制执行**：应用代码不能绕开租户范围；数据库角色看不到其他租户。
3. **每个租户单独的 KV-cache 前缀**：防止缓存的 prompt 在租户之间泄漏。
4. **按租户划分的加密密钥**：即使 bug 把跨命名空间字节返回了，也无法读取。
5. **对每一次跨命名空间查询尝试都做审计日志**：形成深度检测。

**如果隔离失败，爆炸半径**：一次错误的向量查询，可能泄漏该查询 embedding 的 *邻域*，也就是某个租户里潜在的数百条记录。实测结果显示，在未隔离的多租户 RAG 中，自然泄漏率约为 95%。缓解方式不是“把应用代码写得更小心”；而是采用不能被应用 bug 绕过的结构性隔离。

### 问：HaluMem 显示记忆幻觉会在写入时累积，然后继续传播。你会如何在生产环境中为记忆做埋点，以捕捉这一点？

**强答：**

大多数团队掉进的陷阱，是只在 QA 阶段（端到端）衡量记忆质量。HaluMem 证明，60-80% 的记忆错误起源于 *抽取*（写入）时，并会继续传播。你需要埋点三个独立指标：

1. **抽取精度**：当智能体把一个事实写入 L3 时，这个事实是否 वास्तव上被源观察所支持？每天抽样写入，用更强的裁判模型评估。
2. **更新正确性**：当冲突事实到来时，冲突解决逻辑是否产出了正确结果？使用双时态查询（bitemporal queries）来检测“在没有替代元数据的情况下被翻转的事实”。
3. **QA 准确率**：端到端召回正确性。

在此基础上，运行 **影子模式回放**：写入流在影子模式下经过一个验证器模型；实时写入与影子验证器写入之间的不一致，会标记出潜在幻觉以供审查。CI 中的 **金丝雀事实** 确保记忆系统不会静默退化。**周期性全库审计** 随机抽样记忆，并询问“这条记忆是否仍与源对话一致？”

### 问：TTT-E2E 通过测试时训练把上下文压缩进权重里。这在 L1-L4 层级中属于哪里？它引入了什么新的失败模式？

**强答：**

TTT-E2E 处在 *L1 和 L4 之间*。它让上下文派生的信息在剩余会话期间成为模型本身的一部分。它的吸引力在于延迟：无论上下文长度如何，成本都是恒定的（NVIDIA 基准测试显示，在 2.7x speedup at 128K，在 H100 上达到 2M tokens 时 35x）。

新的失败模式是治理问题。权重内记忆具有：

- **没有审计轨迹**：你无法检查“这个模型现在相信什么？”
- **没有淘汰接口**：一旦压缩进权重，就无法在不回滚模型状态的情况下删除某条记忆。
- **GDPR 被遗忘权（right-to-be-forgotten）挑战**：监管框架默认数据是静态存放的，而不是存进权重里。
- **更难检测投毒**：没有可检查的存储可以扫描金丝雀签名。

除了治理之外，还有一种能力上的失败模式：这种方法在注意力窗口之外的“在一堆干草里找针”（needle-in-a-haystack）检索会失败（大约 6%，而完整注意力在 99% 时可达 128K），所以它保留的是上下文的主旨，而不是逐字事实。这使它不适合作为检索关键型工作的唯一记忆层。

正确的理解方式是：TTT-E2E 把记忆治理从存储层迁移到了训练和部署流水线。代价并没有消失，只是被转移了。对于大多数在 2026 的生产团队来说，这还是值得跟踪的研究方向，而不是一个已经可部署的架构。更广义的测试时训练家族可见于 [研究雷达，主题 12](../RESEARCH-RADAR.md#_12-测试时训练-在推理中学习)。

---

## 参考资料

### 生产框架
- [Mem0：面向生产的 AI 智能体与可扩展长期记忆（ECAI 2025）](https://arxiv.org/abs/2504.19413)
- [Mem0 AI 记忆基准 2026](https://mem0.ai/blog/ai-memory-benchmarks-in-2026)
- [Letta（原 MemGPT）文档](https://docs.letta.com/concepts/memgpt/)
- [MemGPT：迈向把 LLM 作为操作系统（arXiv 2310.08560）](https://arxiv.org/abs/2310.08560)
- [Anthropic 记忆工具文档](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)
- [Anthropic Claude Sonnet 4.6 Skills 公告](https://www.anthropic.com/news/claude-sonnet-4-6)
- [Claude Dreaming：定时记忆巩固](https://www.mindstudio.ai/blog/what-is-claude-dreaming-anthropic-agent-memory)
- [Zep：时序知识图谱架构（arXiv 2501.13956）](https://arxiv.org/abs/2501.13956)
- [Graphiti GitHub](https://github.com/getzep/graphiti)
- [LangMem 文档](https://langchain-ai.github.io/langmem/)
- [OpenAI 记忆及 ChatGPT 的新控制项](https://openai.com/index/memory-and-new-controls-for-chatgpt/)
- [Cognition：用 Claude Sonnet 4.6 重建 Devin](https://cognition.ai/blog/devin-sonnet-4-5-lessons-and-challenges)

### 研究（2023-2026）
- [生成式智能体：人类行为的交互式拟像（Park 等，2023）](https://arxiv.org/abs/2304.03442)
- [Reflexion：带语言强化学习的智能体（Shinn 等，2023）](https://arxiv.org/abs/2303.11366)
- [HippoRAG：受神经生物学启发的长期记忆（Gutierrez 等，2024）](https://arxiv.org/abs/2405.14831)
- [A-MEM：面向 LLM 智能体的智能体记忆（Xu 等，NeurIPS 2025）](https://arxiv.org/abs/2502.12110)
- [多层记忆架构（arXiv 2603.29194，2026 月）](https://arxiv.org/abs/2603.29194)
- [Memp：探索智能体过程记忆（2025 月）](https://arxiv.org/html/2508.06433v2)
- [LEGOMem：用于多智能体 LLM 的模块化过程记忆（2025 月）](https://arxiv.org/pdf/2510.04851)
- [重新思考基础智能体的记忆机制（2026 月综述）](https://arxiv.org/abs/2602.06052)
- [观点：情景记忆是缺失的一环（arXiv 2502.06975）](https://arxiv.org/pdf/2502.06975)

### 安全、投毒与幻觉
- [HaluMem：操作级记忆幻觉基准（2025 月）](https://arxiv.org/abs/2511.03506)
- [MINJA 记忆注入攻击（NeurIPS 2025）](https://openreview.net/forum?id=QVX6hcJ2um)
- [MemoryGraft 持久记忆破坏（2025 月）](https://arxiv.org/html/2512.16962v1)
- [Palo Alto Unit 42：间接提示注入会污染 AI 长期记忆](https://unit42.paloaltonetworks.com/indirect-prompt-injection-poisons-ai-longterm-memory/)
- [多租户 AI 基础设施：5 隔离层](https://medium.com/@isuruig/multi-tenant-ai-infrastructure-the-5-isolation-layers-that-determine-whether-your-customers-data-stays-separate-340aaeef4922)
- [第 30 天问题：智能体记忆漂移](https://cipherbuilds.ai/blog/day-30-agent-memory-problem)

### 基础设施
- TTT-E2E：**“用于长上下文的端到端测试时训练”** arXiv:2512.23675，以及 [NVIDIA 解读：重塑 LLM 记忆](https://developer.nvidia.com/blog/reimagining-llm-memory-using-context-as-training-data-unlocks-models-that-learn-at-test-time/)
- [vLLM PagedAttention](https://docs.vllm.ai/en/latest/design/paged_attention/)
- [Anthropic 面向 AI 智能体的有效上下文工程](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

---

*下一篇：[规划与分解](06-planning-and-decomposition.md)*
