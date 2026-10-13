# KV 缓存和上下文缓存

KV Cache（键值缓存）是长上下文 AI 系统中最主要的内存消耗者。有效管理这个缓存，决定了系统是能扩展到 1M+ 个 token，还是在 1 万 token 时就崩溃。

## 目录

- [KV 缓存问题](#kv-缓存问题)
- [GQA：Grouped Query Attention（分组查询注意力）](#gqa-grouped-query-attention-分组查询注意力)
- [上下文缓存（自托管）](#上下文缓存-自托管)
- [API 级上下文缓存（Prompt Caching，提示缓存）](#api-级上下文缓存-prompt-caching-提示缓存)
- [KV 压缩与紧凑型架构](#kv-压缩与紧凑型架构)
- [面试题](#面试题)
- [参考文献](#参考文献)

---

## KV 缓存问题

在生成过程中，模型需要所有前序 token 的 Key（K，键）和 Value（V，值）张量。把这些内容存储在内存中代价很高。

**VRAM 计算（Llama 3.3 70B，标准 GQA）：**
- **Tokens（令牌）**：128,000
- **Precision（精度）**：BF16（每个值 2 字节）
- **Memory（内存）**：`2 (KV) * layers (80) * context (128k) * kv_heads (8) * head_dim (128) * 2 bytes`
- **每 token**：320 KiB
- **Total（总计）**：在 128k 上下文下，**每个用户约 42 GB**。

这个公式只适用于标准多头或分组查询注意力。许多 2026 年的开放旗舰模型采用潜在、稀疏、滑动窗口或线性注意力，每 token 的 KV 用量可相差两个数量级甚至更多（见 [KV 压缩与紧凑型架构](#kv-压缩与紧凑型架构)）。应按各模型自身的架构估算容量。

---

## GQA：Grouped Query Attention（分组查询注意力）

在常规 transformer 中，GQA 是降低 KV Cache 大小而不损失性能的标准方法。

| 方法 | 比例 | KV 缓存缩减 | 质量损失 |
|--------|-------|-------------------|--------------|
| **Multi-Head（MHA，多头注意力）** | 1:1 | 1x（基线） | 0% |
| **Grouped Query（GQA，分组查询）** | 8:1 | **8x** | < 0.2% |
| **Multi-Query（MQA，多查询）** | All:1 | 64x-128x | 2-3% |
| **Multi-head Latent（MLA，多头潜在注意力）** | 每 token 存储压缩潜变量 | DeepSeek-V2 报告其 KV 比自家的 67B MHA 前代模型少 93.3% | 较小（据 DeepSeek 报告） |

**细微差别**：GQA 允许模型用多个“推理”头访问同一份 KV“记忆”，从而在 Decode（解码）阶段大幅降低所需的内存带宽。

---

## 上下文缓存（自托管）

生产系统会为具有共同前缀的提示词使用 **共享 KV 缓存**（例如，一个被 100 页知识库和 1,000 个用户共同使用的场景）。

### 分层 KV 存储
- **GPU HBM**：访问即时，但容量严格受限。
- **主机 DRAM**：容量更大，但需要经 PCIe 或 NVLink-C2C 访问。
- **磁盘、共享存储或对等节点**：速度较慢，但容量几乎不受限。

两大开放服务引擎如今都实现了这一层级。**SGLang HiCache** 采用三级结构（GPU、CPU 主机内存，以及通过 Mooncake、3FS 或 NIXL 后端访问的存储）。**vLLM 的分层 KV 卸载**以主机为中心：所有 KV 经过锁页主机 DRAM，复制完成后立即释放 GPU 内存，次级层（文件系统、对象存储、远程对等节点）的数据也由主机提供；v0.28.0 加入了磁盘层。统一的主机端布局让张量并行规模不同的节点也能共享缓存块。NVIDIA Dynamo 已弃用独立 KV 块管理器（KVBM，目标在 v1.6.0 移除），转而采用引擎原生卸载。

由此带来两个设计后果：
- **混合注意力需要更聪明的前缀缓存。** SGLang v0.5.20 在前缀分叉点缓存滑动窗口状态；在使用共享系统提示的 DeepSeek-V4-Flash 上，token 命中率从 43.8% 提升至 60.8%，平均 TTFT 从 1.57 秒降至 1.07 秒。
- **主机 DRAM 并非免费容量。** 据 The Register 报道，Micron 预计到 2028 年需求仍将超过供应；部分模型还会将参数放在主机内存。Qwen3.8-Flash-Next 增加了 51B 参数的 N-gram embedding，设计为卸载到主机内存并异步预取，会与 KV 层争用同一批 DRAM。

**多租户注意事项：前缀缓存是一条侧信道。** 如果租户共享缓存，一个租户可以通过缓存命中时间推断另一租户是否提交过某个前缀。引擎用按租户设置的 `cache_salt` 缓解风险，但每条代码路径都必须保持该值：vLLM 修复过一处缺陷（GHSA-935w-9g4m-p28p，已于 v0.30.0 修复），某个 API 路径的工具续接轮次会丢失盐值，重新暴露跨租户探测入口。应按租户加盐、逐端点测试，并使用已修补的引擎。

---

## API 级上下文缓存（Prompt Caching，提示缓存）

主要提供商（OpenAI、Anthropic、Google、DeepSeek）都提供 **Prompt Caching（提示缓存）** 折扣，如今折扣倍数不仅因厂商而异，还因模型而异。

| 提供商 | 功能名称 | 价格（每 1M token） | 说明 |
|----------|--------------|------------------------|----------|
| **Anthropic** | 提示缓存（显式断点） | 大多数模型读取为 0.1x（Sonnet 5.5：$0.20）；Opus 5.5 为 0.05x（$0.20）；Fable 5.1 为 0.025x（$0.25）。写入为 1.25x（5 分钟 TTL）或 2x（1 小时） | Opus 5.5 从 512 token 起可缓存提示；一项测试版功能允许在对话中途添加工具而不使缓存失效 |
| **OpenAI** | 提示缓存（自动） | GPT-5.6 及更新模型：写入 1.25x，读取 0.1x（GPT-6 Sol 为 $0.20）；GPT-6.1 Sol 为 0.05x（$0.10）。旧模型无写入费 | 至少 1,024 token；GPT-5.6+ 的 TTL 固定为 30 分钟 |
| **Google** | 上下文缓存（隐式和显式） | Gemini 3.8 Flash 读取为 $0.075（0.1x，优惠价截至 2026 年 12 月 31 日；自 2027 年 1 月 1 日起为 $0.15），另加每 1M token 每小时 $0.50 的存储费（自 2027 年 1 月 1 日起为 $1.00）；Gemini 3.1 Pro Preview 在低于 200K 时读取为 $0.20 | 存储按小时计费，因此长期存在的显式缓存需要足够流量才能覆盖成本 |
| **DeepSeek** | 上下文缓存（自动） | V4.1-Flash 缓存命中：高峰 $0.006 / 非高峰 $0.003；V4-Pro 为 $0.044 / $0.022 | 工作日 UTC 01:00-04:00 和 06:00-10:00 为高峰，不含中国法定节假日 |

**盈亏平衡细节**：写入为 1.25x、读取为 0.1x 时（Anthropic，以及 OpenAI 的 GPT-5.6+），缓存**首次命中**就能回本，即 TTL 内的第二次请求：1.25 + 0.1 < 2。Anthropic 的 1 小时缓存写入价为 2x，则需要第二次命中（2 + 0.1 > 2，但 2 + 0.2 < 3）。真正容易出问题的不是回本计算，而是**命中率**：智能体两轮之间 TTL 到期、前缀变化（时间戳、重新排列的工具、靠前的用户 ID），以及提示不足最低可缓存长度。OpenAI（Responses API，2026 年 9 月 8 日）和 Anthropic（9 月 23 日）如今都提供缓存诊断，应将命中率作为 SLO 并设置告警。

**价格差距**：DeepSeek V4.1-Flash 的高峰缓存命中价格（$0.006）比 GPT-6 Sol 的缓存输入价格（$0.20）低约 33 倍，但比 GPT-6 Luna（$0.01）低不到 2 倍。DeepSeek 在 2026 年多次调整价格，最近一次为 8 月 16 日开始的峰谷计费，以及 9 月 10 日的 V4.1-Flash，因此基于这些数字的成本模型应注明日期。

---

## KV 压缩与紧凑型架构

除数据类型（FP8 或 4 位 KV，见[量化深度解析](../03-training-and-adaptation/07-quantization-deep-dive.md#kv-缓存量化-vram-节省器)）之外，缩小 KV 还有两类方法。

**1. 架构方法（训练时内置，相对该模型无损）。** 2026 年的开放旗舰模型都采用非标准注意力或 KV 方案：

| 模型 | 方案 | 对 KV 的影响 |
|------|------|--------------|
| Llama 3.3 70B | GQA、BF16 | 每 token 320 KiB（基线） |
| DeepSeek V4.1-Flash | 因果编码器-解码器；解码器全局 KV 由编码器状态投影而来；Compressed Sparse Attention 2；FP4 主 KV | 每 token 约 890 字节的全局 KV，比 V4-Flash 约低 4 倍（据 DeepSeek 报告） |
| MiMo-V2.6-Pro | 60 个滑动窗口层（128-token 窗口）和 10 个全局层 | 只有 10 个全局层的 KV 随上下文增长 |
| Qwen3.8-Flash-Next | 每 4 层中 3 层使用 Gated DeltaNet 线性注意力，第 4 层使用 Qwen Sparse Attention | 线性层保持固定大小的状态；只有每第 4 层保留随上下文增长的 KV 缓存 |
| GLM-5.3-Flash | 线性注意力（KDA）与 DeepSeek 风格稀疏注意力混合 | 线性层保持固定状态；稀疏层减少的注意力计算多于 KV 容量 |
| Tencent Hy4 preview | 带索引缓存、采用门控的 DeepSeek 风格稀疏注意力 | 稀疏路径需要引擎内核支持，否则仍要付出稠密计算成本 |

**2. 运行时压缩（服务时应用，有损）。** 保留少量“注意力汇聚”token 和最近窗口（StreamingLLM），或驱逐累计注意力较低的 token（H2O、SnapKV）。这些方法有助于长时间聊天，却可能悄悄丢掉检索密集型提示所需的唯一事实；启用前应运行针式测试和任务评估。

实际后果是，“一个节点可容纳多少个并发的 1M-token 会话”，如今更取决于架构和引擎对其支持情况（感知滑动窗口的前缀缓存、稀疏注意力内核、vLLM HiSparse 等主机驻留稀疏 KV 层），而不只是 GPU 数量。

---

## 面试题

### 问：PagedAttention 如何帮助管理 KV Cache？（简化版）

**有力回答：**
标准 KV 缓存需要连续内存分配（一大块 RAM）。这会导致 **外部碎片化**（内存存在，但分散在无法使用的空隙中）。PagedAttention（vLLM 使用）把 KV 缓存拆成小的、固定大小的“页面”（类似操作系统虚拟内存）。这样缓存就可以非连续分配，也就是说我们可以在真正需要时精确分配内存，并在具有相同前缀的不同请求之间共享页面。vLLM 论文测得，较早系统因碎片化及过量预留浪费了 60-80% 的 KV 内存，而分页后的浪费不到 4%；其吞吐量由此提高 2-4 倍。

### 问：对于一个 50k token 的文档，为什么 Context Caching 比 RAG 更好？

**有力回答：**
在便宜的上下文缓存（DeepSeek、Gemini、Anthropic）可用时，对于中等规模文档，RAG 往往是“杀鸡用牛刀”。
1. **召回**：上下文缓存提供 100% 的检索召回（整篇文档都在窗口内），而 RAG 依赖检索准确率。但模型仍可能漏掉长窗口中的细节，因此应在实际文档长度上运行针式评估。
2. **连贯性**：模型可以看到整篇文档中的交叉引用。
3. **经济性**：在 50k token 规模下，缓存输入的成本往往低于维护向量数据库和检索流水线的复杂度。

### 问：容量规划对所有模型都使用每 token `2 × layers × kv_heads × head_dim × bytes` 的公式，会出什么问题？

**有力回答：**
这个公式只适用于标准 MHA 或 GQA。2026 年的开放旗舰模型大多并非如此：DeepSeek 使用潜在或压缩稀疏注意力，并采用 FP4 主 KV（V4.1-Flash 的全局 KV 每 token 约 890 字节，而 BF16 Llama-3.3-70B 为 320 KiB）；MiMo 的大多数层采用滑动窗口；Qwen 的新设计每 4 层中有 3 层使用线性注意力，维持固定大小的状态。因此，不同模型的每 token KV 用量可相差 300 倍以上；这一公式对部分模型会高估数个数量级，同时忽略另一些模型的固定状态和滑动窗口成本。我会从各模型配置计算 KV 用量，确认引擎真正实现了紧凑方案（否则仍会承担完整 KV 成本），纳入前缀缓存行为（滑动窗口模型需要感知分叉点的缓存才能取得良好命中率），并在目标上下文长度下做负载测试。如今预填充与解码甚至可能使用不同的活跃参数量，因此也要分别规划两个资源池。

---

## 参考文献
- Kwon et al.《Efficient Memory Management with PagedAttention》（2023）
- DeepSeek-AI.《DeepSeek-V2》（MLA）arXiv:2405.04434（2024）
- Xiao 等人.《Efficient Streaming Language Models with Attention Sinks》（StreamingLLM，2023）
- Anthropic.《Prompt Caching Documentation》
- OpenAI. [Prompt caching guide](https://developers.openai.com/api/docs/guides/prompt-caching)
- vLLM Blog. [《Tiered KV offloading》](https://vllm.ai/blog/2026-09-10-tiered-kv-offloading)（2026）
- SGLang. [HiCache design](https://docs.sglang.io/advanced_features/hicache_design.html)

---

*下一篇：[Speculative Decoding（投机解码）](03-speculative-decoding.md)*
