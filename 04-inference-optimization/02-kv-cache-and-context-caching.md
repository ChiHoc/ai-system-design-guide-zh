# KV 缓存和上下文缓存

KV Cache（键值缓存）是长上下文 AI 系统中最主要的内存消耗者。有效管理这个缓存，决定了系统是能扩展到 2M 个 token，还是在 1 万 token 时就崩溃。

## 目录

- [KV 缓存问题](#kv-缓存问题)
- [GQA：Grouped Query Attention（分组查询注意力）](#gqa-grouped-query-attention-分组查询注意力)
- [上下文缓存（自托管）](#上下文缓存-自托管)
- [API 级上下文缓存（Prompt Caching，提示缓存）](#api-级上下文缓存-prompt-caching-提示缓存)
- [RAD-O：Retrieval Augmented Decoding（检索增强解码）](#rad-o-retrieval-augmented-decoding-检索增强解码)
- [面试题](#面试题)
- [参考文献](#参考文献)

---

## KV 缓存问题

在生成过程中，模型需要所有前序 token 的 Key（K，键）和 Value（V，值）张量。把这些内容存储在内存中代价很高。

**VRAM 计算（Llama 4 70B）：**
- **Tokens（令牌）**：128,000
- **Precision（精度）**：BF16（2 字节/参数）
- **Memory（内存）**：`2 (KV) * layers (80) * context (128k) * heads (8) * head_dim (128) * 2 bytes`
- **Total（总计）**：在 128k 上下文下，**每个用户约 42 GB**。

---

## GQA：Grouped Query Attention（分组查询注意力）

GQA 是在不损失性能的前提下缩小 KV Cache 大小的现代标准。

| 方法 | 比例 | KV 缓存缩减 | 质量损失 |
|--------|-------|-------------------|--------------|
| **Multi-Head（MHA，多头注意力）** | 1:1 | 1x（基线） | 0% |
| **Grouped Query（GQA，分组查询）** | 8:1 | **8x** | < 0.2% |
| **Multi-Query（MQA，多查询）** | All:1 | 64x-128x | 2-3% |

**细微差别**：GQA 允许模型用多个“推理”头访问同一份 KV“记忆”，从而在 Decode（解码）阶段大幅降低所需的内存带宽。

---

## 上下文缓存（自托管）

生产系统会为具有共同前缀的提示词使用 **共享 KV 缓存**（例如，一个被 100 页知识库和 1,000 个用户共同使用的场景）。

### 磁盘 vs. VRAM 缓存
- **VRAM Cache（显存缓存）**：访问即时，但容量严格受限。
- **Disk/SSD Cache（磁盘/SSD 缓存）**：访问更慢，但几乎无限。像 **SGLang** 这样的框架使用分层系统：`Most Recent (VRAM) -> Frequent (HBM) -> Occasional (SSD)`。

---

## API 级上下文缓存（Prompt Caching，提示缓存）

主要提供商（OpenAI、Anthropic、Google、DeepSeek）现在都提供 **Prompt Caching（提示缓存）** 折扣。

| 提供商 | 功能名称 | 价格（缓存输入） | 最适合 |
|----------|--------------|------------------------|----------|
| **Anthropic** | Context Caching（上下文缓存） | 90% 折扣（Sonnet 4.6 缓存：$0.30/1M） | 长系统提示词、工具 schema |
| **OpenAI** | Prompt Caching（提示缓存） | 缓存输入约 50% 折扣（GPT-5.5 缓存：约 $2.50/1M） | 多轮对话 |
| **Google** | Context Caching（上下文缓存） | 缓存读取 $0.20/1M（Gemini 3.1 Pro 低于 200K）；另收按小时存储费 | 大型共享语料库 |
| **DeepSeek** | Context Caching（上下文缓存） | **$0.003625/M（V4 Pro）/ $0.0028/M（V4 Flash）** | 超大代码库 RAG；市面上最便宜的缓存层 |

**盈亏平衡细微差别**：如果你的缓存前缀被复用超过 **1.1x 到 1.5x**，使用缓存比直接使用原始 token 更便宜。Anthropic 对缓存写入收取 25% 溢价，因此对于较短前缀，盈亏平衡点更高（复用 3-5x 才更划算）。DeepSeek 在 4 月 26 日将缓存命中价格降到发布时的 1/10，2026。对于缓存密集型负载，V4 Flash 现在每个缓存 token 的成本大约是 GPT-5.5 的 30-50x 更低。

---

## RAD-O：Retrieval Augmented Decoding（检索增强解码）

RAD-O 是一种上下文缓存技术，模型会把长文档的 KV 缓存 **压缩** 成“潜在 token”。
- **方式**：不再为 1M 个 token 存储完整 KV 向量，而是存储一个体积小 10x 的压缩表示。
- **影响**：使原本只支持 200k 的硬件也能运行 2M+ token 的上下文。

---

## 面试题

### 问：PagedAttention 如何帮助管理 KV Cache？（简化版）

**有力回答：**
标准 KV 缓存需要连续内存分配（一大块 RAM）。这会导致 **外部碎片化**（内存存在，但分散在无法使用的空隙中）。PagedAttention（vLLM 使用）把 KV 缓存拆成小的、固定大小的“页面”（类似操作系统虚拟内存）。这样缓存就可以非连续分配，也就是说我们可以在真正需要时精确分配内存，并在具有相同前缀的不同请求之间共享页面。这通常会把内存效率从 60% 提升到 96%+。

### 问：对于一个 50k token 的文档，为什么 Context Caching 比 RAG 更好？

**有力回答：**
在便宜的上下文缓存（DeepSeek、Gemini、Anthropic）可用时，对于中等规模文档，RAG 往往是“杀鸡用牛刀”。
1. **召回**：上下文缓存提供 100% 召回（整篇文档都在窗口内），而 RAG 依赖检索准确率。
2. **连贯性**：模型可以看到整篇文档中的交叉引用。
3. **经济性**：在 50k token 规模下，缓存输入的成本往往低于维护向量数据库和检索流水线的复杂度。

---

## 参考文献
- Kwon et al.《Efficient Memory Management with PagedAttention》（2023）
- Anthropic.《Prompt Caching Documentation》（2024）
- DeepSeek.《Context Caching Technical Report》（2025）

---

*下一篇：[Speculative Decoding（投机解码）](03-speculative-decoding.md)*
