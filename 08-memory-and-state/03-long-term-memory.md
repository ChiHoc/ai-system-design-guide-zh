# 长期记忆

长期记忆（L2 与 L3）提供跨会话持久性。生产栈已经从简单的 **History RAG** 发展到结合 Vector、Graph 和 Relational 数据的 **Multi-Representation Stores（多表示存储）**。专用记忆服务（Zep、Mem0、Letta、Cognee）现在将这些存储封装起来，开箱即用地提供对话总结、实体抽取和时间感知。

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
- **实现说明**：我们将 *Summary* 存储用于检索，并将 *Raw Logs* 存放在冷存储（S3/GCS）中用于取证分析。

---

## 语义记忆：事实存储

语义记忆存储关于实体的 **Discovered Facts（已发现事实）**。
- **实体识别**：使用“Fact Extraction Agent（事实抽取智能体）”解析每一轮用户发言。
- **示例三元组**：
  - `(User_1, HAS_PREFERENCE, Dark_Mode)`
  - `(Company_X, USES_SDK, Stripe)`
- **技术**：Knowledge Graphs（知识图谱，Neo4j、AWS Neptune）与关系型标注结合使用。

---

## 混合向量-图存储

资深工程师使用 **GraphRAG-style Memory（GraphRAG 风格记忆）**。
- **Vector Search（向量搜索）** 找到“相关”的节点。
- **Graph Traversal（图遍历）** 找到“连接”的节点。
- **优势**：如果我搜索“Project Alpha”，向量搜索会找到这个名称，但图遍历会找到 10 名开发者、截止日期以及关联的代码仓库。

---

## 记忆修剪与衰减

如果记忆无限增长，它就会成为负担。
- **Temporal Decay（时间衰减）**：较旧的记忆会失去它们的“相关性分数”，除非被频繁访问。
- **Consolidation（整合）**：把关于“billing”的 10 个独立交互合并为一个高质量摘要节点。
- **Explicit Forgetting（显式遗忘）**：通过删除与某个用户 ID 关联的所有情景和语义簇，来遵守 GDPR 的“被遗忘权”。

---

## 隐私与多租户

> [!CAUTION]
> **Cross-Session Leakage（跨会话泄漏）** 是全局记忆中的第 1 大安全风险。 
> 确保 `user_id` 在向量数据库元数据中是硬分区键。绝不要依赖 LLM 按用户过滤结果。

---

## 面试题

### Q: 在长期记忆场景中，你如何在 Vector DB 和 Knowledge Graph 之间做选择？

**强回答：**
我会把 **Vector DBs（向量数据库）** 用于 **Episodic Context（情景上下文）**（非结构化日志、历史对话），因为我需要对语义进行“模糊”匹配。我会把 **Knowledge Graphs（知识图谱）** 用于 **Structural Semantic Knowledge（结构化语义知识）**（关系、属性、层级），因为我需要“确定性”遍历。生产系统会采用 **Hybrid（混合）** 方法：向量索引指向图 ID，使系统能够找到正确的“Starting Node（起始节点）”，然后再遍历以获取高精度上下文。

### Q: 在学习型 agentic memory 的语境中，什么是 "Catastrophic Forgetting（灾难性遗忘）"？

**强回答：**
在微调后的智能体中，catastrophic forgetting 发生于新训练数据覆盖掉旧知识时。在 **Agentic Memory（基于 RAG）** 中，它指的是 **Index Overload（索引过载）**。如果一个智能体向其记忆中添加 1,000 条低质量的新“事实”，检索精度就会下降，实际上会让它“忘记”那些更早、质量更高的事实，因为它们被噪声淹没了。我们通过 **Quality-Weighted Retrieval（质量加权检索）** 来缓解这一问题：由监督者给出高“Verification Scores（验证分数）”的记忆会比原始日志获得更高权重。

---

## 参考资料
- Neo4j. “用于生成式 AI 的知识图谱” (2025)
- Pinecone. “托管记忆层” (2025)
- GraphRAG. “在关系之上进行推理” (2024/2025)

---

*下一篇：[使用 Mem0 的 Agentic Memory](04-agentic-memory-mem0.md)*
