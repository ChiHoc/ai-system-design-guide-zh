# 语义缓存（Semantic Caching）

缓存已从精确字符串匹配演进为**语义匹配（Semantic Matching，语义匹配）**。语义缓存通过复用对“等价”查询的完成结果，可将成本降低**30-70%**，并将延迟从秒级降至毫秒级。

## 目录

- [精确缓存 vs. 语义缓存](#精确缓存-vs-语义缓存)
- [语义匹配流程](#语义匹配流程)
- [RedisVL 和 GPTCache](#redisvl-和-gptcache)
- [评估：命中率 vs. 幻觉漂移](#多模态语义缓存)
- [多模态语义缓存](#面试问题)
- [面试问题](#面试问题)
- [参考资料](#参考资料)

---

## 精确缓存 vs. 语义缓存

| 特性 | 精确缓存（Redis/Memcached） | 语义缓存（RedisVL/Qdrant） |
|---------|-------------------------------|---------------------------------|
| **键** | 哈希后的查询字符串 | 查询 embedding 向量 |
| **匹配** | 100% 字符串完全一致 | 余弦相似度 > 阈值 |
| **效率** | 低（轻微拼写错误会破坏缓存） | 高（理解意图） |
| **风险** | 无 | 语义漂移（返回错误答案） |

---

## 语义匹配流程

1. **Embed**：将输入查询转换为向量（例如使用 `text-embedding-3-small`）。
2. **Search**：在缓存中搜索最近邻。
3. **Threshold Check**：如果 `distance < 0.05`（非常相似），则返回缓存结果。
4. **LLM Verification**：对于高风险查询，使用轻量级“Verifier Model”（例如 GPT-5.5-mini、Claude Haiku 4.5）检查缓存响应是否 वास्तव真正回答了新查询。
5. **Update**：如果未命中，则调用 LLM 并将新结果存入向量缓存。

---

## RedisVL 和 GPTCache

标准技术栈：
- **RedisVL**：在 Redis 实例内直接提供低延迟向量搜索。
- **Hybrid Caching**：同时使用 Redis 存储元数据（键）和向量负载（vector payloads）。
- **TTL**：语义缓存应设置 TTL（Time-To-Live）。常见模式是**动态 TTL（Dynamic TTL）**：热门答案保留更久，而“stale”信息会定期被淘汰。

---

## 多模态语义缓存

随着原生多模态前沿模型（Gemini 3.1 Pro、GPT-5.5、Claude Opus 4.7）的出现，我们现在会缓存**图像和音频查询**。
- **视觉相似度**：如果先前处理过语义相似的图像，则缓存该图像的描述。
- **音频指纹**：为相似语音指令缓存转写文本（transcripts）。

---

## 面试问题

### Q: 缓存中的“语义漂移（Semantic Drift）”是什么，如何防止？

**强回答：**
当相似度阈值过宽时，就会发生语义漂移，例如 0.8 而不是 0.95。像 *"How do I fix my car?"* 这样的查询，可能会匹配到 *"How do I wash my car?"* 的缓存响应。为防止这种情况，我们使用**多阶段验证（Multi-Stage Validation）**：1）向量相似度检查，2）**实体匹配检查（Entity-Match check）**（确保两个查询都涉及“Car”且动词相同），3）**阈值收紧（Threshold Tightening）**：对于技术或医疗查询，我们要求相似度 $>0.98$ 才返回缓存结果。

### Q: 为什么在低流量下，语义缓存有时反而比原始 LLM 调用更贵？

**强回答：**
因为语义缓存需要自己的**Embedding API 调用**和**向量搜索查询（Vector Search query）**。如果 embedding 模型成本是 $0.02$，检索耗时 100ms，而主 LLM 调用只有 $0.05$ 且耗时 500ms，那么相对节省就很小。语义缓存只有在**高规模（High Scale）**下才会成为显著收益，也就是请求量达到百万级、缓存命中率足够高，足以抵消“Embedding Tax”（embedding 税）并大幅降低总体延迟时。

---

## 参考资料
- Redis. “RedisVL: Python Client for Redis Vector Library” (2025)
- Akiba et al. “GPTCache: A Library for Creating Semantic Cache” (2024/2025)
- Google Cloud. “Generative AI Caching Patterns” (2025)

---

*下一篇：[状态管理模式](06-state-management-patterns.md)*
