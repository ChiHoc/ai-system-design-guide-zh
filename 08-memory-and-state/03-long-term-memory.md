# 长期记忆

长期记忆（L2 与 L3）提供跨会话持久性。生产栈已经从简单的 **History RAG** 发展到结合 Vector、Graph、Relational 和文件数据的 **Multi-Representation Stores（多表示存储）**。专用记忆服务如今分为三种形态：建立在自有向量数据库之上的事实存储（Mem0）、时序知识图谱（Zep/Graphiti、Cognee），以及由 git 支撑的记忆文件（Letta MemFS、Claude memory tool）。

## 目录

- [情景记忆（叙事）](#情景记忆-个人日志)
- [语义记忆（知识）](#语义记忆-事实存储)
- [混合向量-图存储](#混合向量-图存储)
- [记忆修剪与衰减](#记忆修剪与衰减)
- [隐私与多租户](#隐私与多租户)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 情景记忆：个人日志

情景记忆存储 **Trajectories（轨迹）**：事件及其结果的序列。
- **数据结构**：`(Timestamp, Interaction_ID, Trajectory_Summary, Embedding)`。
- **原理**：如果一个智能体上个月使用某个特定工具序列成功构建了一个 React 组件，那么当今天被要求再构建一个时，它应该“回忆”起那次成功。
- **实现说明**：我们将 *Summary* 存储用于检索，并将 *Raw Logs* 存放在冷存储（S3/GCS）中用于取证分析。保留原始日志还能支持读取时整理：Just-in-Time Memory（arXiv 2609.27334）在读取时为当前任务整理原始轨迹，在 ALFWorld、WebShop 和 tau2-bench 上优于最强的写入时记忆基线。

---

## 语义记忆：事实存储

语义记忆存储关于实体的 **Discovered Facts（已发现事实）**。
- **实体识别**：使用“Fact Extraction Agent（事实抽取智能体）”解析每一轮用户发言。
- **示例三元组**：
  - `(User_1, HAS_PREFERENCE, Dark_Mode)`
  - `(Company_X, USES_SDK, Stripe)`
- **技术**：Knowledge Graphs（知识图谱，Neo4j、AWS Neptune）与关系型标注结合使用；也可以是在向量数据库中配有实体索引的事实存储（Mem0 v2）。

---

## 混合向量-图存储

当关系本身带来价值时，资深工程师会使用 **GraphRAG-style Memory（GraphRAG 风格记忆）**。
- **Vector Search（向量搜索）** 找到“相关”的节点。
- **Graph Traversal（图遍历）** 找到“连接”的节点。
- **优势**：如果我搜索“Project Alpha”，向量搜索会找到这个名称，但图遍历会找到 10 名开发者、截止日期以及关联的代码仓库。

**2026 年的反方理由变得更有力。** Mem0 v2.0.0（2026 年 4 月）移除了 Neo4j、Memgraph、Kuzu 和 Apache AGE 驱动（约 4,000 行），改为在现有向量存储的并行集合中保存实体关联，将语义相似度、BM25 和实体加权融合为一个检索分数。它的判断是：对于用户偏好记忆，感知实体的检索可以获得图谱的大部分收益，却无需运行第二个数据库。需要多跳遍历或**时序有效性**（“3 月 12 日什么是真的？”）时才使用真正的图谱；这是 Zep/Graphiti 的长处：每条边带有 `valid_at` / `invalid_at`（事实在现实世界中何时成立），以及 `created_at` / `expired_at`（系统何时获知、何时废止）。

---

## 记忆修剪与衰减

如果记忆无限增长，它就会成为负担。
- **Temporal Decay（时间衰减）**：较旧的记忆会失去它们的“相关性分数”，除非被频繁访问。
- **Consolidation（整合）**：把关于“billing”的 10 个独立交互合并为一个高质量摘要节点。这项工作越来越多地在**请求路径之外**完成：Anthropic 的 Dreams 研究预览会读取记忆存储与旧转录，并写回重新组织的存储；Mem0 的 Dream 在付费方案中执行合并与事实取代。
- **Explicit Forgetting（显式遗忘）**：通过删除与某个用户 ID 关联的所有情景和语义簇，包括派生摘要、备份以及基于文件的记忆所涉及的 git 历史，来遵守 GDPR 的“被遗忘权”。
- **门控注入**：检索相关性不等于有用性。在专门触发记忆陷阱的 MemTrapBench（arXiv 2608.20202）任务中，即使正确且语义相关的记忆也会导致推理固着和信念扭曲；其测试的所有记忆策略都不如不使用记忆。应按请求决定是否将记忆注入上下文。

---

## 隐私与多租户

> [!CAUTION]
> **Cross-Session Leakage（跨会话泄漏）** 是全局记忆中的第 1 大安全风险。 
> 确保 `user_id` 在向量数据库元数据中是硬分区键。绝不要依赖 LLM 按用户过滤结果。

另有两项控制措施：
- **对共享记忆设置写入门槛。** 多个用户都能写入的记忆是投毒目标。Asana（2026 年 9 月）允许任何人对任务中的 agent 反馈，但只有管理员和编辑者能把反馈提交到永久共享记忆或从中删除；其他人的反馈只在当前任务生效。
- **需要时让运营者也无法读取。** 如果连服务提供方都不能读取记忆，参考设计是由客户端持有密钥、在飞地中处理，并公开证明服务器软件。Google 于 2026 年 9 月 23 日将此描述为 Private AI Compute 的计划，未给出产品日期。

记忆投毒和租户隔离的面试题可参见[智能体记忆与状态](../07-agentic-systems/05-agent-memory-and-state.md)。

---

## 面试题

### Q: 在长期记忆场景中，你如何在 Vector DB 和 Knowledge Graph 之间做选择？

**强回答：**
我会把 **Vector DBs（向量数据库）** 用于 **Episodic Context（情景上下文）**（非结构化日志、历史对话），因为我需要对语义进行“模糊”匹配。我会把 **Knowledge Graphs（知识图谱）** 用于 **Structural Semantic Knowledge（结构化语义知识）**（关系、属性、层级），因为我需要“确定性”遍历。生产系统会采用 **Hybrid（混合）** 方法：向量索引指向图 ID，使系统能够找到正确的“Starting Node（起始节点）”，然后再遍历以获取高精度上下文。不过在加入图谱前，我会先检查向量存储内的实体感知检索是否足够；Mem0 在 v2 中移除图数据库正是基于这种判断。当查询涉及多跳或特定时间范围时，图谱的运维成本才值得付出。

### Q: 在学习型 agentic memory 的语境中，什么是 "Catastrophic Forgetting（灾难性遗忘）"？

**强回答：**
在微调后的智能体中，catastrophic forgetting 发生于新训练数据覆盖掉旧知识时。在 **Agentic Memory（基于 RAG）** 中，它指的是 **Index Overload（索引过载）**。如果一个智能体向其记忆中添加 1,000 条低质量的新“事实”，检索精度就会下降，实际上会让它“忘记”那些更早、质量更高的事实，因为它们被噪声淹没了。仅追加的写入路径（Mem0 v2 没有更新或删除阶段）会使这种情况更容易发生，除非后续有巩固过程。我们通过 **Quality-Weighted Retrieval（质量加权检索）**（由监督者给出高“Verification Scores（验证分数）”的记忆比原始日志获得更高权重）和定时巩固任务缓解：合并重复项并取代过时事实。

---

## 参考资料
- [Zep：面向智能体记忆的时序知识图谱架构（arXiv 2501.13956）](https://arxiv.org/abs/2501.13956)
- [Mem0：以可扩展长期记忆构建生产级 AI Agent（arXiv 2504.19413）](https://arxiv.org/abs/2504.19413)
- [Mem0 v2.0.0 发布说明](https://github.com/mem0ai/mem0/releases/tag/v2.0.0)
- Edge 等人。“From Local to Global: A Graph RAG Approach to Query-Focused Summarization”（2024）
- [MemTrapBench（arXiv 2608.20202）](https://arxiv.org/abs/2608.20202)
- [Just-in-Time Memory（arXiv 2609.27334）](https://arxiv.org/abs/2609.27334)
- [Anthropic。“Agents you can coach: how Asana builds human-agent teams with Claude”（2026 年 9 月）](https://claude.com/blog/agents-you-can-coach-how-asana-builds-human-agent-teams-with-claude)

---

*下一篇：[使用 Mem0 的 Agentic Memory](04-agentic-memory-mem0.md)*
