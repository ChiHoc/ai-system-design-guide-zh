# 注意力机制

Attention（注意力机制）是使 Transformer 成为可能的核心创新。本章涵盖系统设计和面试中必备的数学基础、变体和优化。

## 目录

- [注意力基础](#注意力基础)
- [缩放点积注意力](#缩放点积注意力)
- [多头注意力](#多头注意力)
- [注意力模式](#注意力模式)
- [高效注意力变体](#高效注意力变体)
- [Flash Attention（v2 至 v4）](#flash-attention)
- [多头潜在注意力（MLA）](#多头潜在注意力-mla)
- [KV Cache 优化与上下文缓存](#kv-cache-优化与上下文缓存)
- [实际影响](#实际影响)
- [面试题](#面试题)
- [参考文献](#参考文献)

---

## 注意力基础

### 核心思想

注意力允许序列中的每个位置从所有其他位置汇聚信息。与递归（按步骤逐步传递信息）不同，注意力会创建直接连接。

**面向分布式系统工程师的思维模型：**
- RNN：沿链路进行消息传递
- Attention（注意力）：发布/订阅（pub/sub），每个节点都可以查询其他任意节点

### Query、Key、Value 框架

注意力使用输入的三个投影：

| 组件 | 作用 | 类比 |
|-----------|------|---------|
| Query（Q） | 我在寻找什么？ | 搜索查询 |
| Key（K） | 我包含了什么？ | 文档索引 |
| Value（V） | 我贡献什么？ | 文档内容 |

```python
# Input: x of shape [batch, seq_len, d_model]

Q = x @ W_q  # [batch, seq_len, d_k]
K = x @ W_k  # [batch, seq_len, d_k]
V = x @ W_v  # [batch, seq_len, d_v]
```

---

## 缩放点积注意力

基本的注意力运算：

```python
def scaled_dot_product_attention(Q, K, V, mask=None):
    d_k = Q.shape[-1]
    
    # Compute attention scores
    scores = Q @ K.transpose(-2, -1)  # [batch, seq_len, seq_len]
    scores = scores / math.sqrt(d_k)  # Scale
    
    # Apply mask (for causal attention)
    if mask is not None:
        scores = scores.masked_fill(mask == 0, float('-inf'))
    
    # Convert to probabilities
    attention_weights = F.softmax(scores, dim=-1)
    
    # Weighted sum of values
    output = attention_weights @ V
    
    return output, attention_weights
```

### 为什么要除以 d_k 的平方根？

**面试高频题**：这个问题考察的是数值直觉。

不进行缩放时，点积会随着维度增长：
- 对于维度为 d、各分量相互独立、均值为零且方差为一的 q 和 k
- E[q . k] = 0，但 Var[q . k] = d
- 标准差 = sqrt(d)

当 d 很大（512 或更大）时，点积可能非常大或非常小。对大数值做 softmax 会趋近于 one-hot，导致梯度消失。

```python
# Demonstration
import numpy as np

d = 512
q = np.random.randn(d)
k = np.random.randn(d)

unscaled = np.dot(q, k)      # Magnitude ~ sqrt(512) ~ 22
scaled = unscaled / np.sqrt(d)  # Magnitude ~ 1
```

### 因果掩码

在自回归生成中，每个位置只能关注前面的 token：

```python
def create_causal_mask(seq_len):
    # Lower triangular matrix
    mask = torch.tril(torch.ones(seq_len, seq_len))
    return mask

# Example for seq_len=4:
# [[1, 0, 0, 0],
#  [1, 1, 0, 0],
#  [1, 1, 1, 0],
#  [1, 1, 1, 1]]
```

mask=0 的位置得分会变为负无穷，经过 softmax 后变成 0。

---

## 多头注意力

与其只使用一个注意力函数，不如使用多个“头”来关注不同方面：

```python
class MultiHeadAttention(nn.Module):
    def __init__(self, d_model, num_heads):
        super().__init__()
        self.num_heads = num_heads
        self.d_k = d_model // num_heads
        
        self.W_q = nn.Linear(d_model, d_model)
        self.W_k = nn.Linear(d_model, d_model)
        self.W_v = nn.Linear(d_model, d_model)
        self.W_o = nn.Linear(d_model, d_model)
    
    def forward(self, x, mask=None):
        batch_size, seq_len, d_model = x.shape
        
        # Project to Q, K, V
        Q = self.W_q(x)  # [batch, seq_len, d_model]
        K = self.W_k(x)
        V = self.W_v(x)
        
        # Reshape to multiple heads
        Q = Q.view(batch_size, seq_len, self.num_heads, self.d_k).transpose(1, 2)
        K = K.view(batch_size, seq_len, self.num_heads, self.d_k).transpose(1, 2)
        V = V.view(batch_size, seq_len, self.num_heads, self.d_k).transpose(1, 2)
        # Now: [batch, num_heads, seq_len, d_k]
        
        # Attention per head
        attn_output, _ = scaled_dot_product_attention(Q, K, V, mask)
        
        # Concatenate heads
        attn_output = attn_output.transpose(1, 2).contiguous()
        attn_output = attn_output.view(batch_size, seq_len, d_model)
        
        # Final projection
        output = self.W_o(attn_output)
        return output
```

**为什么要多个头？**
1. 不同的头会学习不同模式（语法、语义、指代）
2. 提供表示多样性（ensemble effect，集成效应）
3. 允许在各个头之间并行计算

### 头数模式

| 模型 | d_model | 头数 | 每头 d_k |
|-------|---------|-------|--------------|
| BERT-base | 768 | 12 | 64 |
| GPT-2 | 768 | 12 | 64 |
| GPT-3 175B | 12288 | 96 | 128 |
| Llama 2 70B | 8192 | 64 | 128 |

64 或 128 的 d_k 在不同模型规模之间都非常一致。

---

## 注意力模式

### 注意力学到了什么

不同的头会专注于不同的模式：

| 模式类型 | 捕获内容 | 示例 |
|--------------|------------------|---------|
| 位置型（Positional） | 相邻 token | 前一个/后一个词 |
| 句法型（Syntactic） | 语法关系 | 主谓 |
| 语义型（Semantic） | 含义关系 | 指代 |
| 分隔符型（Delimiter） | 标点、结构 | 章节边界 |
| 稀有型（Rare） | 不常见模式 | 稀有词复制 |

### 可视化注意力

注意力权重可以可视化为热力图，展示哪些位置关注哪些位置：

```
Query positions (rows) vs Key positions (columns)

"The cat sat on the mat"

         The  cat  sat  on   the  mat
The     [□    ○    ○    ○    ○    ○ ]
cat     [●    □    ○    ○    ○    ○ ]
sat     [○    ●    □    ○    ○    ○ ]
on      [○    ○    ●    □    ○    ○ ]
the     [○    ○    ○    ○    □    ○ ]
mat     [○    ●    ○    ●    ●    □ ]

● = high attention, ○ = low attention
```

“mat” 对 “cat” 关注很强（语义），对 “on” 关注很强（句法），对 “the” 也有关注（限定词）。

---

## 高效注意力变体

标准注意力在序列长度上的复杂度是 O(n^2)。许多变体可以降低这一点：

### 稀疏注意力

只关注部分位置，而不是全部位置：

| 变体 | 模式 | 复杂度 | 示例 |
|---------|---------|------------|---------|
| Local（局部） | 每个位置周围的窗口 | O(n * w) | Longformer |
| Strided（跨步） | 每隔 k 个位置取一次 | O(n^2 / k) | Sparse Transformer |
| Global（全局） | 特殊 token 可关注所有位置 | O(n * g) | Longformer, BigBird |
| Block（分块） | 块对角注意力 | O(n * b) | BigBird |

**Longformer 模式：**
```
Local window + Global tokens

[G] [L] [L] [L] [L] [G] [L] [L] [L] [L]

G: Global tokens (attend to/from all)
L: Local tokens (attend within window)
```

### 线性注意力

用可线性化的替代方法替换 softmax：

```python
# Standard attention (quadratic)
attention = softmax(Q @ K.T) @ V

# Linear attention approximation
attention = (Q @ (K.T @ V))  # Associativity trick
```

**变体：**
- Performer：随机特征近似
- Linear Transformer：elu(Q) @ (elu(K).T @ V)
- 门控线性注意力（Gated DeltaNet、Kimi Delta Attention）：加入可学习门控和 delta-rule 状态更新，也是 2026 年混合架构的实际采用方案

**取舍：** 更快，但质量会下降，尤其是在需要精确注意力的任务上（例如准确召回很早之前的某个 token）。因此，生产模型会将线性层与完整或稀疏注意力层交错使用，而非完全采用线性注意力。

### 复杂度对比

| 方法 | 时间 | 空间 | 质量 | 说明 |
|--------|------|-------|---------|-------|
| 标准 | O(n^2) | O(n^2) | 最佳 | 基线 |
| 稀疏（Longformer） | O(n) | O(n) | 接近最佳 | 长文档场景 |
| 线性（Performer） | O(n) | O(n) | 下降 | 更适合超长序列 |
| Flash Attention | O(n^2) | O(n) | 最佳 | 精确注意力、具备 IO 感知的内核 |
| 混合（线性或 SWA + 部分完整/稀疏层） | 大多为 O(n) | 大多为 O(n) | 接近最佳 | 2026 年开放旗舰模型中的常见方案 |

### 2026 年开放模型中的混合与稀疏注意力

上述变体已经不再只是研究。下列五个旗舰开放模型均于 2026 年 8 月下旬至 9 月发布，并根据其模型卡采用了非标准注意力或 KV 方案。并非所有发布都如此：IBM Granite 4.2（8 月 25 日）仍是采用普通 GQA 的稠密 Transformer。

| 模型（发布时间） | 注意力方案 | KV 影响 |
|-----------------|------------------|----------------|
| Qwen3.8-Flash-Next（8 月 26 日） | 每 4 层中的 3 层采用 Gated DeltaNet 线性注意力，第 4 层采用 Qwen 稀疏注意力 | 每 4 层中仅 1 层保留随上下文增长的 KV cache；线性层保存固定大小的状态 |
| GLM-5.3-Flash（8 月 26 日） | 每 4 层中的 3 层采用 Kimi Delta Attention（线性），第 4 层在 MLA 潜变量上采用 DeepSeek 风格稀疏注意力 | 每 4 层中约 1 层保留随上下文增长的（压缩）KV cache；Z.ai 称该混合架构显著降低了长上下文服务成本 |
| Tencent Hy4 预览版（8 月 28 日） | 在 MLA 潜变量缓存之上使用带 IndexCache 的门控 DeepSeek 稀疏注意力 | 缓存为每层每 token 保存 512 维潜变量和 64 维 RoPE key；每个 query 仅读取选出的 top 2,048 个 key |
| DeepSeek V4.1-Flash（9 月 10 日） | 因果编码器-解码器（解码器全局 KV 由编码器状态投影）、Compressed Sparse Attention 2、FP4 主 KV | 每 token 的全局 KV 为 890 字节；DeepSeek 称其比 V4-Flash 少约 4 倍、比 DeepSeek-V1 少约 437 倍 |
| MiMo-V2.6-Pro（9 月 21 日） | 60 个滑动窗口层（128-token 窗口）加 10 个全局层 | 70 层中仅 10 层的缓存会随上下文增长 |

这五个模型均支持 100 万 token 上下文（Qwen3.8-Flash-Next 通过 YaRN 从原生 262K 扩展）。

**这对系统设计的影响：**
- **KV 容量需按架构计算。** `2 x layers x kv_heads x head_dim x bytes` 对 Llama 风格 GQA（70B 模型每 token 320 KiB）适用，却无法描述这些模型：DeepSeek V4.1-Flash 报告每 token 890 字节全局 KV，约为上述 Llama 数值的 1/370。890 字节仅涵盖全局缓存：模型卡还描述了滑动窗口 KV，其大小受窗口长度限制而不会随上下文增长。因此，该比例描述的是长上下文增长量，而不是短请求的总缓存内存。应从配置和模型卡比较每 token KV 字节数，而非参数量，并确认发布数值涵盖缓存的哪些部分。
- **稀疏注意力减少读取，并不自动减少存储。** 基于索引器的方案会为每个 query 选择 top-k key，从而降低长上下文下的注意力计算和带宽；但只有与压缩结合时缓存才会缩小（如 Hy4 的 MLA 潜变量、V4.1-Flash 的压缩 FP4 KV）。
- **前缀缓存需要支持混合架构的引擎。** 滑动窗口和线性层携带的状态并非普通的逐 token KV 列表。SGLang v0.5.20 的 SWA 感知 Radix Tree 在共享系统提示词的 DeepSeek-V4-Flash 上，将 token 命中率从 43.8% 提升至 60.8%，平均 TTFT 从 1.57 秒降至 1.07 秒（SGLang 报告）。在假定前缀缓存收益前，应确认所用引擎版本支持该架构的缓存布局。

---

## Flash Attention

Flash Attention 是最先进的实现，在计算精确注意力的同时实现了 O(n) 内存占用。

### 它解决的问题

标准注意力需要将 n x n 的注意力矩阵物化：
- 对于 8K 上下文：6400 万个浮点数 = 每层每头 256 MB
- 对于 100K 上下文：100 亿个浮点数 = 每层每头 40 GB

这种内存需求会限制 batch size（批大小）和上下文长度。

### 它是如何工作的

Flash Attention 使用分块和重计算来避免存储完整注意力矩阵：

```
Standard: Q, K -> Attention Matrix (n x n) -> Output
Flash:    Q, K -> Tiles (block_size x block_size) -> Incremental Output
```

**关键思想：**
1. 按能放入 SRAM 的块来处理注意力
2. 不在 HBM 中物化完整注意力矩阵
3. 在反向传播时重算注意力（比从 HBM 读取更快）

### FlashAttention-2（工作分区）
通过改进跨头和序列长度的并行性，为 A100/H100 做了优化。

### FlashAttention-3（FP8 与 H100 优化）
**Hopper（H100/H200）上的标准内核：**
- **异步执行**：使用 warp specialization 和 TMA（Tensor Memory Accelerator，张量内存加速器）重叠 GEMM（矩阵乘法）和 softmax 操作。
- **FP8 支持**：在 H100 上，FP8 接近 1.2 PFLOPS，而 FP16 最高为 740 TFLOPS；通过块量化和非相干处理（将异常值分散开的 Hadamard 旋转）保持较低的 FP8 误差。
- **加速**：FP16 下比 FlashAttention-2 快约 1.5x-2.0x（所有数值均来自论文报告）。

### FlashAttention-4（Hopper 与 Blackwell）
FlashAttention-3 仅面向 Hopper。**FlashAttention-4** 使用 CuTe DSL 编写，同时面向 Hopper 和 Blackwell（H100、B200），并作为独立包（`flash-attn-4`）发布，截至 2026 年 9 月仍处于 4.0.0 beta 版本。Blackwell 级别硬件上的服务引擎也会使用其他注意力后端（FlashInfer 和厂商内核），因此在引用注意力吞吐量前，应确认引擎实际选择的后端。

---

## 多头潜在注意力（MLA）

DeepSeek-V2 提出并在 V3 中延续的 **MLA 是面向极端 KV cache 压力的现代替代方案**，可替代 GQA。

MLA 不只是简单地对头分组，而是在把 Key 和 Value 向量存入缓存之前，先将其压缩到**低维潜在空间**。

```
Query (Up-projected) ────────┐
                             ▼
Key, Value (Down-projected) ─▶ [Low-dim Latent Cache] ─▶ [Output]
                             ▲
                             └─ Projection Matrices
```

| 指标 | MHA | GQA | MLA |
|--------|-----|-----|-----|
| KV Cache 大小 | 100% | 12.5% | **几个百分点**（DeepSeek-V2 每层每 token 缓存 576 个值，在其 128 个头的配置下约为 MHA 的 1.8%；DeepSeek 报告其缓存比稠密 DeepSeek 67B 小 93.3%） |
| 质量 | 基线 | 接近基线 | **在 DeepSeek 消融实验中与 MHA 持平或更优** |
| 延迟 | 基线 | 更快 | **长上下文下最快（减少 I/O）** |

**MLA 为什么更优**：缓存为每个 token 保存一个压缩潜变量和一个小型位置 key。解码时，上投影矩阵会被吸收进 query 和输出投影中，因此潜变量不会重新扩展为完整 K 和 V。RoPE 会阻碍这种吸收，这正是 MLA 使用**解耦 RoPE**的原因：一组独立的小型旋转维度负责携带位置信息。其结果是在长上下文中，每步解码所需的内存带宽大幅降低。

MLA 已扩展至 DeepSeek 之外（Kimi K2 采用 MLA，Tencent Hy4 和 GLM-5.3-Flash 的稀疏注意力层则建立在 512 维 KV 潜变量之上）；与此同时，DeepSeek 自身的 V4 系列已转向 Compressed Sparse Attention 与 Heavily Compressed Attention 的混合方案，参见[2026 年开放模型中的混合与稀疏注意力](#_2026-年开放模型中的混合与稀疏注意力)。

---

## KV Cache 优化与上下文缓存

### 上下文缓存（系统级）
API 提供方（OpenAI、Gemini、Anthropic、DeepSeek）均提供 **Context Caching（上下文缓存）**，也称 prompt caching。
- **工作方式**：对长“前缀”（例如一本 10 万 token 的法律书）预先计算并存储 KV 张量；当后续请求以相同字节开头时复用它们。
- **延迟收益**：跳过已缓存前缀的 prefill，因此 TTFT 节省量取决于共享提示词的比例。
- **成本收益**：当前大多数 OpenAI、Anthropic 和 Google 模型的缓存读取按输入价格的 0.1 倍计费；Claude Opus 5.5 和 GPT-6.1 Sol 为 0.05 倍，Claude Fable 5.1 为 0.025 倍。其他供应商不同（xAI Grok 4.7 为 0.25 倍；DeepSeek V4.1-Flash 缓存命中为 0.02 倍）。写入会产生额外成本：OpenAI GPT-5.6 及之后版本（固定 30 分钟 TTL）和 Anthropic 5 分钟缓存为 1.25 倍，Anthropic 1 小时缓存为 2 倍；Google 则按小时对显式缓存存储收费。当前费率参见[定价与成本](../02-model-landscape/03-pricing-and-costs.md)，设计模式参见[KV Cache 与上下文缓存](../04-inference-optimization/02-kv-cache-and-context-caching.md)。

### 滑动窗口注意力（SWA）
它将一层的注意力限制在固定窗口内（Mistral 7B：4,096 token），使该层的 KV cache 不再随上下文增长。现代模型会将 SWA 层与少量全局层交错使用，以保留长距离召回能力：Gemma 3 每 1 个全局层配有 5 个局部层，MiMo-V2.6-Pro 则有 60 个滑动窗口层（128-token 窗口）和 10 个全局层。

### 多查询注意力（MQA）

在所有查询头之间共享单个 K 和 V：

```python
# Standard MHA
Q: [batch, num_heads, seq, d_k]  # 32 heads
K: [batch, num_heads, seq, d_k]  # 32 separate K
V: [batch, num_heads, seq, d_k]  # 32 separate V

# MQA
Q: [batch, num_heads, seq, d_k]  # 32 heads
K: [batch, 1, seq, d_k]          # 1 shared K
V: [batch, 1, seq, d_k]          # 1 shared V
```

**效果：** KV cache 大小减少 32 倍，但会有一些质量损失。

### 分组查询注意力（GQA）

在查询头组之间共享 K 和 V：

```python
# GQA with 8 KV heads for 64 query heads (8:1 ratio)
Q: [batch, 64, seq, d_k]  # 64 query heads
K: [batch, 8, seq, d_k]   # 8 KV heads
V: [batch, 8, seq, d_k]   # 8 KV heads

# Each KV head serves 8 query heads
```

**效果：** KV cache 减少 8 倍，质量损失很小。

**使用 GQA 的模型：**
- Llama 2 70B 和 Llama 3.x 70B：64 个 query heads 对应 8 个 KV heads
- Llama 3.1 405B：128 个 query heads 对应 8 个 KV heads
- Llama 4 Maverick：40 个 query heads 对应 8 个 KV heads
- Mistral 7B：32 个 query heads 对应 8 个 KV heads
- Gemma：多种配置

### 对比

| 注意力 | KV Cache | 质量 | 模型 |
|-----------|----------|---------|--------|
| MHA | 完整 | 最佳 | GPT-3 |
| GQA | 典型为 1/8 | 接近最佳 | Llama 2 70B、Llama 3、Mistral |
| MQA | 1/n_heads | 降低 | PaLM, Falcon |
| MLA | 压缩潜变量，约为 MHA 的几个百分点 | 在 DeepSeek 消融实验中与 MHA 持平 | DeepSeek-V2 和 V3 系列、Kimi K2、Tencent Hy4 |

---

## 实际影响

### 对系统设计的影响

1. **批大小与上下文的权衡：**
   - 总 GPU 内存 = 模型 + KV cache * batch_size
   - 上下文越长，可用批次越小
   - GQA 模型可以服务更多并发请求

2. **延迟预算分配：**
   - 注意力计算为 O(n^2)；Flash Attention 将其内存降为 O(n)，而非计算量
   - Prefill（提示词处理）随提示词长度增长
   - Decode（解码）随生成长度和提示长度增长

3. **内存带宽瓶颈：**
   - 生成过程通常受内存带宽限制
   - 每一步解码都会重新读取权重（小批次时占主导）和 KV cache（长上下文及大批次时占主导）
   - 更大的批次可摊薄权重读取；KV 读取会随每个新增请求而增长

### Prefill 与 Decode

| 阶段 | 计算模式 | 瓶颈 |
|-------|-----------------|------------|
| Prefill | 处理全部输入 token | 计算（GPU 核心） |
| Decode | 一次生成一个 token | 内存（带宽） |

这就是为什么 TTFT（time to first token，首 token 时间）和 TPS（tokens per second，每秒 token 数）会分别衡量。

### 上下文长度扩展

| 上下文 | 注意力计算 | KV Cache，Llama 3.x 70B（GQA、BF16） | 相同形状的完整 MHA |
|---------|-------------------|-------------------------------------|--------------------------|
| 4K | 基线 | 1.3 GB | 10.7 GB |
| 8K | 4x | 2.7 GB | 21.5 GB |
| 32K | 64x | 10.7 GB | 86 GB |
| 128K | 1024x | 43 GB | 344 GB |

长上下文需要：
- Flash Attention（内存高效）
- GQA、MQA 或 MLA（更小的 KV cache），或采用混合注意力架构
- FP8 KV cache（将上述 BF16 数值减半）以及卸载至主机 DRAM
- 可能还需要模型并行（model parallelism）

---

## 面试题

### Q: 解释注意力机制以及它为什么是二次复杂度。

**标准作答：**
注意力会计算所有位置之间的成对交互。对于 n 个位置：

1. Q @ K^T 生成一个 n x n 的得分矩阵
2. 每个注意力得分都是一个 query 和一个 key 的点积
3. 总共需要 n^2 次点积

这使得复杂度随序列长度呈二次增长。对于 8K token，每层每头有 6400 万个成对得分；对于 128K token，则有 160 亿个。

这种二次扩展限制了上下文长度。解决方案包括：
- Flash Attention：O(n^2) 计算但 O(n) 内存
- 稀疏注意力（Sparse attention）：通过只关注子集达到 O(n)
- 线性注意力（Linear attention）：O(n) 近似
- 混合架构：在大部分深度采用线性或滑动窗口层，再加入少量完整或稀疏注意力层以实现精确召回（大多数 2026 年开放旗舰模型采用的模式）

### Q: 什么是 KV Cache，为什么它对服务化至关重要？

**标准作答：**
在自回归生成中，我们一次生成一个 token。如果不缓存，每生成一个新 token，都需要为所有历史位置重新计算 K 和 V。

KV cache 存储历史位置的 K 和 V 张量。对于每个新 token：
1. 只为新位置计算 Q、K、V
2. 将新的 K、V 追加到缓存
3. 基于完整缓存中的 K、V 做 attention

这将每 token 的投影计算复杂度从 O(n) 降到 O(1)。

代价是内存：KV cache 会随序列长度线性增长。Llama 70B 在 8K 上下文下，采用 GQA（8 个 KV heads）时每个请求约需 2.7 GB；若采用完整 MHA，则约为 21 GB。即使采用 GQA，在 128K 上下文下也约需 43 GB。这直接限制了批大小和吞吐量。

GQA 和 MQA 通过在查询头之间共享 K、V 来减少这一开销；MLA 则将 K、V 压缩为潜变量；FP8 KV 会将字节数减半。

### Q: 比较 MHA、GQA 和 MQA。

**标准作答：**
| 变体 | K,V heads | KV Cache | 质量 | 使用场景 |
|---------|-----------|----------|---------|----------|
| MHA | 与 Q heads 相同 | 完整 | 最佳 | 训练、质量敏感场景 |
| GQA | 少于 Q heads | 减少 | 接近 MHA | 生产服务 |
| MQA | 1 | 最小 | 降低 | 内存受限场景 |

MHA：每个查询头都有自己的 K 和 V。质量最好，但 KV cache 最大。

GQA：各组查询头共享 K 和 V。Llama 2 70B 使用 8 个 KV heads 对应 64 个 query heads（8:1 比例）。缓存减少 8 倍，质量损失很小。

MQA：所有查询头共享一个 K 和一个 V。能获得最大的内存节省，但会有可测量的质量下降。PaLM 采用了这种方案。

对于服务化场景，GQA 是最佳折中。它允许更大的 batch size（更高吞吐），同时质量几乎与 MHA 相同。

### Q: Flash Attention 如何实现 O(n) 内存？

**标准作答：**
标准注意力会在 GPU 内存中物化完整的 n x n 注意力矩阵。Flash Attention 通过以下方式避免这一点：

1. **分块（Tiling）**：处理适合片上 SRAM 的 Q 和 K 块
2. **在线 softmax（Online softmax）**：增量计算 softmax，不存储全部分数
3. **重计算（Recomputation）**：反向传播时重算注意力，而不是读取已保存的值

关键洞察是，片上 SRAM 比 HBM 快一个数量级，但容量很小。FlashAttention 论文给出的 A100 数据为：每个 SM 有 192 KB SRAM（108 个 SM 合计约 20 MB），带宽约 19 TB/s；而 HBM 容量为 40-80 GB、带宽为 1.5-2.0 TB/s。通过在 SRAM 中做更多计算、减少 HBM 读写，Flash Attention 同时更快也更省内存。

结果是精确注意力，而不是近似注意力；在原始论文中，相比标准注意力具有 O(n) 内存和 2-4x 加速。FlashAttention-3 面向 Hopper，FlashAttention-4 则加入了对 Blackwell 的支持。

### Q: 如何为一个新的 2026 年开放权重模型估算 KV cache？

**标准作答：**
不能只使用教材公式。`2 x layers x kv_heads x head_dim x bytes` 假定每一层都为每个 token 存储完整 K 和 V，这对 Llama 风格 GQA（70B 模型在 BF16 下每 token 320 KiB）成立，但不适用于当前开放旗舰模型：

- **混合层：**MiMo-V2.6-Pro 有 60 个窗口为 128-token 的滑动窗口层和 10 个全局层，因此只有全局层会随上下文增长。Qwen3.8-Flash-Next 在每 4 层中的 3 层保留固定大小的线性注意力状态。
- **压缩或共享 KV：**DeepSeek V4.1-Flash 从编码器状态投影解码器全局 KV，并存储 FP4 主 KV；其每 token 全局 KV 为 890 字节（DeepSeek 报告），比 Llama 70B 数值小 300 倍以上。该数值不包含其滑动窗口 KV；后者是受窗口限制的固定单请求量，因此在长上下文下差距最大。
- **精度：**FP8 KV 会将 BF16 减半；FP4 再减半，但都需要进行质量检查。

我的流程是：读取 `config.json`（层类型、窗口大小、KV heads 或潜变量维度、KV dtype）；若厂商公布，则采用其每 token KV 数值；随后在目标引擎中按真实上下文分布测量实际缓存用量，因为混合缓存布局的引擎支持会随版本而异。容量可根据（HBM 减去权重）除以 P95 上下文长度下的单请求 KV，再加上引擎支持的主机内存卸载层级来计算。

## 参考文献

- Vaswani 等人. “Attention Is All You Need（注意力即一切）”(2017)
- Dao 等人. “FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness（FlashAttention：具备 IO 感知的快速且内存高效的精确注意力）”(2022)
- Dao. “FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning（FlashAttention-2：通过更好的并行性和工作划分实现更快的注意力）”(2023)
- Shah 等人. “FlashAttention-3: Fast and Accurate Attention with Asynchrony and Low-precision（FlashAttention-3：通过异步与低精度实现快速且精确的注意力）”(2024)
- DeepSeek-AI. “DeepSeek-V2: A Strong, Economical, and Efficient Mixture-of-Experts Language Model（DeepSeek-V2：强大、经济且高效的混合专家语言模型）”(MLA, 2024)
- Beltagy 等人. “Longformer: The Long-Document Transformer（Longformer：长文档 Transformer）”(2020)
- Ainslie 等人. “GQA: Training Generalized Multi-Query Transformer Models（GQA：训练广义多查询 Transformer 模型）”(2023)
- Shazeer. “Fast Transformer Decoding: One Write-Head is All You Need（快速 Transformer 解码：一个写头就够了）”(MQA, 2019)
- [Flash Attention 仓库](https://github.com/Dao-AILab/flash-attention)

---

*上一章: [Tokenization Deep Dive](02-tokenization-deep-dive.md) | 下一章: [Transformer Architecture](04-transformer-architecture.md)*
