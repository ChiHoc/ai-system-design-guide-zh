# 注意力机制

Attention（注意力机制）是使 Transformer 成为可能的核心创新。本章涵盖系统设计和面试中必备的数学基础、变体和优化。

## 目录

- [注意力基础](#注意力基础)
- [缩放点积注意力](#缩放点积注意力)
- [多头注意力](#多头注意力)
- [注意力模式](#注意力模式)
- [高效注意力变体](#高效注意力变体)
- [Flash Attention（v2 和 v3）](#flash-attention)
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
- 对于维度为 d 的随机单位向量 q 和 k
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

**取舍：** 更快，但质量会下降，尤其是在需要精确注意力的任务上。

### 复杂度对比

| 方法 | 时间 | 空间 | 质量 | 说明 |
|--------|------|-------|---------|-------|
| 标准 | O(n^2) | O(n^2) | 最佳 | 基线 |
| 稀疏（Longformer） | O(n) | O(n) | 接近最佳 | 长文档场景 |
| 线性（Performer） | O(n) | O(n) | 下降 | 更适合超长序列 |
| Flash Attention | O(n^2) | O(n) | 最佳 | 两者兼顾 |

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

### 性能影响

### FlashAttention-2（工作分区）
通过改进跨头和序列长度的并行性，为 A100/H100 做了优化。

### FlashAttention-3（FP8 与 H100 优化）
**H100/B200 集群的当前标准：**
- **异步执行**：在 H100 上使用 TMA（Tensor Memory Accelerator，张量内存加速器）重叠 GEMM（矩阵乘法）和 softmax 操作。
- **FP8 支持**：原生支持 FP8 精度，通过随机舍入（stochastic rounding）在保持注意力精度的同时，将吞吐量提升到 FP16 的两倍。
- **加速**：在长上下文 prefill（预填充）场景下，比 FlashAttention-2 快约 1.5x-2.0x。

---

## 多头潜在注意力（MLA）

由 DeepSeek（V2/V3）提出，**MLA 是面向极端 KV cache 压力的现代替代方案**，可替代 GQA。

MLA 不只是简单地对头分组，而是在把 Key 和 Value 向量存入缓存之前，先将其压缩到**低维潜在空间**。

```
Query (Up-projected) ────────┐
                             ▼
Key, Value (Down-projected) ─▶ [Low-dim Latent Cache] ─▶ [Output]
                             ▲
                             └─ Projection Matrices
```

| 指标 | MHA | GQA | MLA（2025 年 12 月） |
|--------|-----|-----|----------------|
| KV Cache 大小 | 100% | 12.5% | **约 5%** |
| 质量 | 基线 | 接近基线 | **优于 GQA** |
| 延迟 | 基线 | 更快 | **最快（减少 I/O）** |

**MLA 为什么更优**：它使用“Decoupled Rotary Positional Embeddings（解耦旋转位置嵌入）”，使压缩后的潜在 KV 可以在无需解码的情况下复用，从而在长上下文生成时节省大量内存带宽。

---

## KV Cache 优化与上下文缓存

### 上下文缓存（系统级）
API 提供方（OpenAI、Gemini、Anthropic）现在都提供 **Context Caching（上下文缓存）**。  
- **工作方式**：对长“前缀”（例如一本 10 万 token 的法律书）预先计算并存储 KV 张量。
- **收益**：对于重复前缀，TTFT（Time to First Token，首 token 时间）降低 90%，成本降低 50%-90%。

### 滑动窗口注意力（SWA）
Mistral/Gemma 模型使用它将注意力深度限制在固定窗口（例如 4096 token），防止 KV cache 无限制增长。

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
- Llama 2 70B：64 个 query heads 对应 8 个 KV heads
- Mistral 7B：32 个 query heads 对应 8 个 KV heads
- Gemma：多种配置

### 对比

| 注意力 | KV Cache | 质量 | 模型 |
|-----------|----------|---------|--------|
| MHA | 完整 | 最佳 | GPT-3 |
| GQA | 典型为 1/8 | 接近最佳 | Llama 2, Mistral |
| MQA | 1/n_heads | 降低 | PaLM, Falcon |

---

## 实际影响

### 对系统设计的影响

1. **批大小与上下文的权衡：**
   - 总 GPU 内存 = 模型 + KV cache * batch_size
   - 上下文越长，可用批次越小
   - GQA 模型可以服务更多并发请求

2. **延迟预算分配：**
   - 注意力在 Flash 下是 O(n) 内存、O(n^2) 计算
   - Prefill（提示词处理）随提示词长度增长
   - Decode（解码）随生成长度和提示长度增长

3. **内存带宽瓶颈：**
   - 生成过程通常受内存带宽限制
   - 每个 token 读取 KV cache 的成本占主导
   - 更大的批次可以摊薄这部分成本

### Prefill 与 Decode

| 阶段 | 计算模式 | 瓶颈 |
|-------|-----------------|------------|
| Prefill | 处理全部输入 token | 计算（GPU 核心） |
| Decode | 一次生成一个 token | 内存（带宽） |

这就是为什么 TTFT（time to first token，首 token 时间）和 TPS（tokens per second，每秒 token 数）会分别衡量。

### 上下文长度扩展

| 上下文 | 注意力计算 | KV Cache（Llama 70B） |
|---------|-------------------|---------------------|
| 4K | 基线 | 10.7 GB |
| 8K | 4x | 21.5 GB |
| 32K | 64x | 86 GB |
| 128K | 1024x | 344 GB |

长上下文需要：
- Flash Attention（内存高效）
- GQA 或 MQA（更小的 KV cache）
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

### Q: 什么是 KV Cache，为什么它对服务化至关重要？

**标准作答：**
在自回归生成中，我们一次生成一个 token。如果不缓存，每生成一个新 token，都需要为所有历史位置重新计算 K 和 V。

KV cache 存储历史位置的 K 和 V 张量。对于每个新 token：
1. 只为新位置计算 Q、K、V
2. 将新的 K、V 追加到缓存
3. 基于完整缓存中的 K、V 做 attention

这将每 token 的投影计算复杂度从 O(n) 降到 O(1)。

代价是内存：KV cache 会随序列长度线性增长。以 Llama 70B 在 8K 上下文为例，每个请求大约需要 21 GB。这直接限制了批大小和吞吐量。

GQA 和 MQA 通过在查询头之间共享 K、V 来减少这一开销。

### Q: 比较 MHA、GQA 和 MQA。

**标准作答：**
| 变体 | K,V heads | KV Cache | 质量 | 使用场景 |
|---------|-----------|----------|---------|----------|
| MHA | 与 Q heads 相同 | 完整 | 最佳 | 训练、质量敏感场景 |
| GQA | 少于 Q heads | 减少 | 接近 MHA | 生产服务 |
| MQA | 1 | 最小 | 降低 | 内存受限场景 |

MHA：每个查询头都有自己的 K 和 V。质量最好，但 KV cache 最大。

GQA：各组查询头共享 K 和 V。Llama 2 使用 8 个 KV heads 对应 64 个 query heads（8:1 比例）。缓存减少 8 倍，质量损失很小。

MQA：所有查询头共享一个 K 和一个 V。能获得最大的内存节省，但会有可测量的质量下降。PaLM 采用了这种方案。

对于服务化场景，GQA 是最佳折中。它允许更大的 batch size（更高吞吐），同时质量几乎与 MHA 相同。

### Q: Flash Attention 如何实现 O(n) 内存？

**标准作答：**
标准注意力会在 GPU 内存中物化完整的 n x n 注意力矩阵。Flash Attention 通过以下方式避免这一点：

1. **分块（Tiling）**：处理适合片上 SRAM 的 Q 和 K 块
2. **在线 softmax（Online softmax）**：增量计算 softmax，不存储全部分数
3. **重计算（Recomputation）**：反向传播时重算注意力，而不是读取已保存的值

关键洞察是，GPU SRAM（每个 SM 约 20 MB）比 HBM（80 GB）快 10 倍。通过在 SRAM 中做更多计算、减少 HBM 读写，Flash Attention 同时更快也更省内存。

结果是精确注意力，而不是近似注意力，并且具有 O(n) 内存和 2-4x 加速。

## 参考文献

- Vaswani 等人. “Attention Is All You Need（注意力即一切）”(2017)
- Dao 等人. “FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness（FlashAttention：具备 IO 感知的快速且内存高效的精确注意力）”(2022)
- Dao. “FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning（FlashAttention-2：通过更好的并行性和工作划分实现更快的注意力）”(2023)
- Beltagy 等人. “Longformer: The Long-Document Transformer（Longformer：长文档 Transformer）”(2020)
- Ainslie 等人. “GQA: Training Generalized Multi-Query Transformer Models（GQA：训练广义多查询 Transformer 模型）”(2023)
- Shazeer. “Fast Transformer Decoding: One Write-Head is All You Need（快速 Transformer 解码：一个写头就够了）”(MQA, 2019)
- [Flash Attention 仓库](https://github.com/Dao-AILab/flash-attention)

---

*上一章: [Tokenization Deep Dive](02-tokenization-deep-dive.md) | 下一章: [Transformer Architecture](04-transformer-architecture.md)*
