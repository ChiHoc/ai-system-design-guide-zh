# 短期上下文管理

短期记忆（L1 记忆）是发生推理的高速接口。把它管理好，已经不再只是关于“消息列表”，还涉及 **KV Cache Optimization（KV 缓存优化）**、**Dynamic Context Allocation（动态上下文分配）**，以及让对话保持供应商可以缓存、模型可以持续推理的形态。

## 目录

- [上下文生命周期](#上下文生命周期)
- [KV Cache 分块与 PagedAttention](#kv-cache-分块)
- [前缀缓存（System Prompt Preservation，系统提示词保留）](#前缀缓存)
- [滑动窗口与总结](#滑动窗口与总结)
- [上下文压缩（选择性丢弃）](#上下文压缩)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 上下文生命周期

上下文会经历三个阶段：
1. **接收**：用户查询 + 最近历史 + 系统指令。
2. **处理**：GPU 为新 token 计算 KV 缓存。
3. **驱逐**：在达到上限后移除旧 token，为新 token 腾出空间。

使用托管 API 时，你无法直接控制缓存驱逐，只能控制发送的内容。最新 Claude 模型还有一个限制：不能编辑先前的对话轮次，否则后续 thinking 块会失效。这里应通过供应商的压缩或上下文编辑来驱逐内容，而不是改写消息列表（参见[上下文工程](../05-prompting-and-context/05-context-engineering.md#仅追加上下文-思考内容绑定对话)）。

---

## KV Cache 分块

现代推理引擎（vLLM、SGLang、TensorRT-LLM）使用 **PagedAttention** 或等效的分块分配器。
- **思路**：不再为上下文分配一整块连续的 GPU 内存，而是将内存拆分为 **Blocks（块）**（pages，页）。
- **效率**：vLLM 论文测得，早期服务系统因碎片化和过度预留浪费了 60-80% 的 KV 缓存内存；分页将浪费降至 4% 以下，使相同硬件可以支持显著更大的批大小和更长的上下文窗口。
- **分层存储**：KV 缓存如今会从 GPU HBM 溢出到主机 DRAM，再到本地磁盘、对象存储或对等节点（vLLM 在 v0.28.0 增加磁盘层；SGLang 的 HiCache 跨越 GPU、CPU 和存储），因此长会话的前缀即使从 GPU 驱逐也能保留。参见 [PagedAttention](../04-inference-optimization/05-paged-attention.md) 和 [KV 缓存与上下文缓存](../04-inference-optimization/02-kv-cache-and-context-caching.md)。

---

## 前缀缓存

这对任何生产级 LLM 技术栈来说，都是 **低延迟的圣杯**。
- **问题**：每次智能体调用 LLM 时，都会发送相同的 2,000-token 系统提示词 + 50 个工具模式。这会浪费计算资源。
- **解决方案**：**持久化前缀缓存**。服务器把提示词中“静态”部分（前缀）的 KV 缓存保留在内存中。
- **结果**：你只需为消息中*新的*部分支付全价并等待计算。托管服务的缓存读取价格如今约为普通输入价格的 0.02 至 0.25 倍，视模型而定（多数为 0.1 倍）。
- **多租户注意事项（自托管）**：共享前缀缓存会形成计时侧信道，因为缓存命中明显更快。vLLM 的控制措施是为每次请求设置 `cache_salt`，使缓存项只在同一租户内共享；只要提示词含私有数据就应设置。盐值必须覆盖所有代码路径：vLLM v0.30.0 修复了 GHSA-935w-9g4m-p28p，其中一条 Responses API 路径上的工具续接轮次丢失 `cache_salt`，重新打开跨租户探测通道，因此应使用 v0.30.0 或更新版本。

---

## 滑动窗口与总结

| 方法 | 机制 | 优点 | 缺点 |
|--------|-----------|-----|-----|
| **滑动窗口** | 精确保留最后 N 个 token。 | 对最近内容保真度高。 | “多利”效应（忘记开头）。 |
| **总结** | 将旧轮次压缩为文本。 | 保留“关键信息”。 | 会丢失细微差别/格式。 |
| **混合** | 保留最后 10 轮 + 1 总结。 | 兼得两者之长。 | 复杂度略高。 |
| **供应商压缩** | API 总结旧轮次并返回一个压缩块，供你回传（Claude API，beta；按需模式于 2026 年 9 月 14 日增加）。 | 保持前缀缓存和 thinking 块规则有效。 | 对保留内容控制较少；摘要是信任边界，需保留原始转录。 |

---

## 上下文压缩

当前前沿技术栈支持多种**选择性丢弃**形式：
- **清除过时的工具结果**：供应商的上下文编辑（例如 Anthropic 的 `clear_tool_uses` 策略）在服务端删除旧工具输出和 thinking 块，而不要求你从消息列表中删除它们。
- **转存大型输出**：把 20K-token 搜索结果存成文件，只在上下文中保留单行引用。
- **Token Pruning（token 剪枝）**：在长检索文档或用户消息到达 “Reasoning” 模型前，使用较小模型（类似 LLMLingua-2）压缩它。只应对易变、未缓存的内容使用。

---

## 面试题

### Q: “Model Context Window（模型上下文窗口）” 和 “Application Context Window（应用上下文窗口）” 有什么区别？

**强回答：**
**模型上下文窗口** 是由架构定义的硬性上限（例如 GPT-4o 的 128K、GPT-6.1 Sol 的 1.05M）。**应用上下文窗口** 是工程师为了管理 **Latency and Cost（延迟与成本）** 而设置的配置上限（例如 64K 限制）。在生产中，我们很少在每一轮都用满整个模型窗口，因为随着上下文变长，注意力开销也会增加、生成变慢，而且质量会远在达到上限之前就下降（上下文腐化）。我们会使用一个 **Buffer Zone（缓冲区）**，为模型回复预留空间；对推理模型，这还必须包括 thinking token，因为它们计入 `max_tokens`。

### Q: “Prefix Caching（前缀缓存）” 会如何改变你设计 System Prompts（系统提示词）的方式？

**强回答：**
它会迫使我把 **静态内容放前面**，把 **动态内容放后面**。早期的 LLM 模式经常把用户姓名或日期放在最顶部，这会破坏前缀缓存。我会把 “Immutable Rules（不可变规则）” 和 “Tool Schemas（工具模式）” 放在开头，把每轮都会变化的 “User Context（用户上下文）” 放在末尾。这样可以确保前 5,000 个 token 在所有用户之间都是相同的，从而最大化推理服务器上的缓存命中率。若会话中途必须改变工具或指令，我会追加变更（对话中途的系统消息，或 Claude 的行内工具新增），而不是编辑前缀；既然 OpenAI 和 Anthropic 都提供缓存诊断，我还会把缓存命中率作为 SLO 追踪。

---

## 参考资料
- Kwon 等人。“Efficient Memory Management for Large Language Model Serving with PagedAttention”（SOSP 2023）
- Zheng 等人。“SGLang: Efficient Execution of Structured Language Model Programs”（RadixAttention，2024）
- NVIDIA. “Optimizing Inference with TensorRT-LLM” (2025)
- Anthropic. “Prompt Caching: Scale while reducing costs” (2024/2025)
- [Claude API 发布说明（压缩、上下文编辑）](https://platform.claude.com/docs/en/release-notes/overview)

---

*下一篇：[长期记忆](03-long-term-memory.md)*
