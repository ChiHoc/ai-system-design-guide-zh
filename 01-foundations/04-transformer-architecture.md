# Transformer Architecture（Transformer 架构）

本章对完整的 Transformer 架构提供全面视图，将前面章节中的各个组件整合为统一理解。

## 目录

- [架构概览](#架构概览)
- [输入处理](#输入处理)
- [Transformer 模块](#transformer-模块)
- [输出处理](#输出处理)
- [现代架构变体（Hybrid MoE, MLA）](#非绑定-vs-绑定-embedding-词嵌入)
- [非绑定 vs. 绑定 Embedding（词嵌入）](#非绑定-vs-绑定-embedding-词嵌入)
- [扩展特性](#扩展特性)
- [架构对比表](#架构对比表)
- [面试题](#面试题)
- [参考资料](#参考文献)

---

## 架构概览

仅解码器 Transformer（decoder-only transformer，GPT、Claude、Llama 使用的架构）由以下部分组成：

```
┌─────────────────────────────────────────────────────────────────┐
│                     Token Embeddings                            │
│              + Position Embeddings (or RoPE)                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│    ┌─────────────────────────────────────────────────────┐      │
│    │                  Transformer Block                   │      │
│    │  ┌─────────────────────────────────────────────┐    │      │
│    │  │              RMSNorm/LayerNorm              │    │      │
│    │  └───────────────────┬─────────────────────────┘    │      │
│    │                      ▼                              │      │
│    │  ┌─────────────────────────────────────────────┐    │      │
│    │  │         Masked Multi-Head Attention         │    │      │
│    │  │            (with KV Cache)                  │    │      │
│    │  └───────────────────┬─────────────────────────┘    │      │
│    │                      │                              │      │
│    │                  + Residual                         │      │
│    │                      │                              │      │
│    │  ┌─────────────────────────────────────────────┐    │      │
│    │  │              RMSNorm/LayerNorm              │    │      │
│    │  └───────────────────┬─────────────────────────┘    │      │
│    │                      ▼                              │      │
│    │  ┌─────────────────────────────────────────────┐    │      │
│    │  │             Feed-Forward Network            │    │      │
│    │  │               (SwiGLU/GELU)                 │    │      │
│    │  └───────────────────┬─────────────────────────┘    │      │
│    │                      │                              │      │
│    │                  + Residual                         │      │
│    └──────────────────────┴──────────────────────────────┘      │
│                           │                                     │
│                    Repeat × N layers                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Output RMSNorm                             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Language Model Head                           │
│              (Linear: hidden_dim → vocab_size)                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
                         Logits
```

---

## 输入处理

### Token Embedding（词元嵌入）

将 token ID 转换为稠密向量：

```python
class TokenEmbedding(nn.Module):
    def __init__(self, vocab_size, d_model):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, d_model)
    
    def forward(self, token_ids):
        return self.embedding(token_ids)
```

**维度：**
- 输入：[batch_size, seq_len] token ID
- 输出：[batch_size, seq_len, d_model] embedding

### 位置信息

位置信息通过以下方式之一融合：

**1. Rotary Position Embedding (RoPE，旋转位置编码)：**
在 attention（注意力机制）内部应用，而不是直接加到 embedding 上：
```python
def apply_rope(q, k, positions):
    # Rotate q and k vectors based on position
    freqs = compute_frequencies(positions)
    q_rotated = rotate_embeddings(q, freqs)
    k_rotated = rotate_embeddings(k, freqs)
    return q_rotated, k_rotated
```

**2. Learned Position Embeddings（可学习位置嵌入）：**
直接加到 token embedding 上：
```python
position_embeddings = nn.Embedding(max_seq_len, d_model)
x = token_embeddings + position_embeddings(positions)
```

**现代模型（Llama、Mistral、GPT-4）使用 RoPE**，以获得更好的长度泛化能力。

---

## Transformer 模块

### Pre-Norm 结构

现代 Transformer 使用 pre-normalization（预归一化）：

```python
class TransformerBlock(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.attn_norm = RMSNorm(config.d_model)
        self.attn = GroupedQueryAttention(
            d_model=config.d_model,
            n_heads=config.n_heads,
            n_kv_heads=config.n_kv_heads
        )
        self.ff_norm = RMSNorm(config.d_model)
        self.ff = SwiGLUFFN(
            d_model=config.d_model,
            d_ff=config.d_ff
        )
    
    def forward(self, x, mask=None, kv_cache=None):
        # Attention with residual
        h = x + self.attn(self.attn_norm(x), mask, kv_cache)
        
        # FFN with residual
        out = h + self.ff(self.ff_norm(h))
        
        return out
```

### Attention 组件

```python
class GroupedQueryAttention(nn.Module):
    def __init__(self, d_model, n_heads, n_kv_heads):
        super().__init__()
        self.n_heads = n_heads
        self.n_kv_heads = n_kv_heads
        self.head_dim = d_model // n_heads
        
        self.q_proj = nn.Linear(d_model, n_heads * self.head_dim)
        self.k_proj = nn.Linear(d_model, n_kv_heads * self.head_dim)
        self.v_proj = nn.Linear(d_model, n_kv_heads * self.head_dim)
        self.o_proj = nn.Linear(n_heads * self.head_dim, d_model)
    
    def forward(self, x, mask, kv_cache):
        B, T, D = x.shape
        
        # Project
        q = self.q_proj(x).view(B, T, self.n_heads, self.head_dim)
        k = self.k_proj(x).view(B, T, self.n_kv_heads, self.head_dim)
        v = self.v_proj(x).view(B, T, self.n_kv_heads, self.head_dim)
        
        # Apply RoPE
        q, k = apply_rope(q, k, positions)
        
        # Update KV cache
        if kv_cache is not None:
            k = torch.cat([kv_cache.k, k], dim=1)
            v = torch.cat([kv_cache.v, v], dim=1)
            kv_cache.update(k, v)
        
        # Repeat KV heads for GQA
        k = k.repeat_interleave(self.n_heads // self.n_kv_heads, dim=2)
        v = v.repeat_interleave(self.n_heads // self.n_kv_heads, dim=2)
        
        # Attention (using Flash Attention in practice)
        attn_out = flash_attention(q, k, v, mask)
        
        # Output projection
        out = self.o_proj(attn_out.view(B, T, -1))
        return out
```

### Feed-Forward Network（前馈网络，FFN）

```python
class SwiGLUFFN(nn.Module):
    def __init__(self, d_model, d_ff):
        super().__init__()
        # SwiGLU has 3 projections instead of 2
        self.gate_proj = nn.Linear(d_model, d_ff, bias=False)
        self.up_proj = nn.Linear(d_model, d_ff, bias=False)
        self.down_proj = nn.Linear(d_ff, d_model, bias=False)
    
    def forward(self, x):
        gate = F.silu(self.gate_proj(x))  # SiLU = Swish
        up = self.up_proj(x)
        return self.down_proj(gate * up)
```

**FFN 隐藏维度** 对于 SwiGLU 通常是模型维度的 2.7 倍（相比之下，使用 GELU 的标准 FFN 为 4 倍）。

### RMSNorm

```python
class RMSNorm(nn.Module):
    def __init__(self, d_model, eps=1e-6):
        super().__init__()
        self.weight = nn.Parameter(torch.ones(d_model))
        self.eps = eps
    
    def forward(self, x):
        rms = torch.sqrt(torch.mean(x ** 2, dim=-1, keepdim=True) + self.eps)
        return self.weight * (x / rms)
```

比 LayerNorm 更简单、更快，因为它省略了均值中心化。

---

## 输出处理

### 最终归一化

在最后一个 transformer block 后应用 RMSNorm：

```python
hidden_states = self.output_norm(hidden_states)
```

### Language Model Head（语言模型头）

投影到词表大小：

```python
class LMHead(nn.Module):
    def __init__(self, d_model, vocab_size):
        super().__init__()
        self.linear = nn.Linear(d_model, vocab_size, bias=False)
    
    def forward(self, x):
        return self.linear(x)  # Returns logits
```

## 非绑定 vs. 绑定 Embedding（词嵌入）

**标准模式（GPT-3、Llama 2）：** 权重共享（Weight Tying）
- 输出头与输入 embedding 共享权重。
- **优点**：节省内存（vocab_size * hidden_dim）。
- **缺点**：强制输入与输出的潜空间完全一致，这在某些情况下并非最优。

**2025 年前沿模式（Llama 3/4、GPT-5.2）：** 非绑定 Embedding（Untied Embeddings）
- 输出头拥有自己的权重。
- **为什么？**：更大的词表（128k+）使 embedding 表成为模型的重要组成部分。解绑定后，输出头可以专注于“预测逻辑”，而输入 embedding 专注于“语义理解”。
- **系统影响**：会增加参数量，但通常能提升多语言和代码任务的困惑度表现。

### 生成预测

```python
# During generation
logits = lm_head(hidden_states[:, -1, :])  # Last position only
next_token = sample(logits)

# During training
logits = lm_head(hidden_states)  # All positions
loss = cross_entropy(logits, targets)
```

---

## 现代架构变体

### Llama 2/3 架构

| 组件 | 实现 |
|-----------|----------------|
| Attention | Grouped Query Attention (GQA，分组查询注意力) |
| 位置 | Rotary Position Embedding (RoPE，旋转位置编码) |
| 归一化 | RMSNorm（pre-norm） |
| 激活函数 | SwiGLU |
| 偏置 | 线性层中无偏置 |

### Mistral 架构

与 Llama 相同，但增加：
- **Sliding Window Attention（滑动窗口注意力）**：每层只关注 4K token
- 通过层叠仍可实现有效 32K+ 上下文

### Mixture of Experts (MoE，专家混合) & Hybrid Architectures（混合架构）

最先进的模型通常使用 **Hybrid MoE/Dense** 模块：
- **Periodic Dense Layers（周期性 Dense 层）**：每隔几层 MoE，就插入一层 dense layer，以确保“全局”知识在所有 expert 之间共享。
- **Expert Parallelism（专家并行）**：将不同 expert 分布到不同 GPU 上。这使得 **节点间带宽**（NVLink/InfiniBand）成为主要架构瓶颈。

### Multi-head Latent Attention (MLA，多头潜在注意力) 集成
[DeepSeek-V3 / V4](03-attention-mechanisms.md#多头潜在注意力-mla) 以及等价的现代架构中的标准 attention block，用低秩 latent compression（潜在压缩）替代了标准的 Q/K/V 投影。
- **架构转变**：现在的 "KV Cache" 是压缩后的 latent 表示，改变了整个 transformer block 的内存/计算比。

### 方案对比

| 选择 | 旧方案 | 现代方案 | 收益 |
|--------|--------------|-----------------|---------|
| 归一化 | Post-LN | Pre-LN / RMSNorm | 训练稳定性、速度 |
| 位置 | 正弦/可学习 | RoPE | 更好的外推能力 |
| 激活函数 | GELU | SwiGLU | 质量提升（基准上 +1%） |
| Attention | MHA | GQA | KV cache 缩小 8 倍 |
| 偏置 | 有偏置 | 无偏置 | 更少参数，质量相近 |

---

## 扩展特性

### 参数量

| 组件 | 参数量 |
|-----------|------------|
| Token embedding | vocab_size * d_model |
| 每层 Q/K/V | 3 * d_model * d_model（MHA） |
| 每层 O 投影 | d_model * d_model |
| 每层 FFN | 3 * d_model * d_ff（SwiGLU） |
| LM head | d_model * vocab_size（通常是 tied） |

**仅解码器近似公式：**
```
Total ≈ 12 * n_layers * d_model^2 (for d_ff = 4 * d_model, MHA)
```

### 计算需求

**训练：** 每 token 的 FLOPs ≈ 6 * parameters（前向 + 反向）

**推理：** 每 token 的 FLOPs ≈ 2 * parameters（仅前向）

### Scaling Laws（扩展定律）

Chinchilla scaling law 建议的最优分配为：

```
D (data tokens) ≈ 20 * N (parameters)
```

对于一个 70B 模型，若要实现计算最优训练，应在约 1.4T token 上训练。

**但：** 许多现代模型相对 Chinchilla 会进行更多训练，以获得更好的推理效率。Llama 训练于 2T+ token。

---

## 架构对比表

| 模型 | 参数量 | 层数 | d_model | 头数 | KV 头数 | FFN | 上下文 |
|-------|--------|--------|---------|-------|----------|-----|---------|
| GPT-3 | 175B | 96 | 12288 | 96 | 96 | GELU | 2K |
| Llama 2 70B | 70B | 80 | 8192 | 64 | 8 | SwiGLU | 4K |
| Llama 3 405B| 405B | 126 | 16384 | 128 | 16 | SwiGLU | 128K |
| DeepSeek V3 | 671B | 128 | 7168 | 128 | MLA | MoE | 128K |
| Llama 4 (spec)| 1T+ | 140+ | 18432 | 192 | 24 | MoE/H | 1M+ |

*Mistral 使用滑动窗口注意力来实现有效长上下文。

---

## 面试题

### Q: 请讲一遍 Transformer 的前向传播流程。

**强答案：**
对于一个生成文本的仅解码器模型：

1. **Tokenization（分词）:** 将输入文本转换为 token ID

2. **Embedding（嵌入）:** 从 embedding 表中查找 token embedding

3. **对每一层 transformer：**
   - 对输入应用 RMSNorm
   - 计算 Q、K、V 投影
   - 对 Q 和 K 应用 RoPE 注入位置信息
   - 生成时：将新的 K、V 追加到 KV cache
   - 计算 attention（带 mask，因此每个位置只能看到前文）
   - 对 attention 输出做投影并加 residual
   - 再次应用 RMSNorm
   - 经过 SwiGLU feed-forward network
   - 加 residual

4. **输出归一化：** 应用最终 RMSNorm

5. **LM head（语言模型头）：** 投影到词表大小以得到 logits

6. **采样：** 使用 temperature/top-p 从 logits 中选择下一个 token

在生成过程中，对每个新 token 重复步骤 3-6，并复用前面位置的 KV cache。

### Q: pre-norm 和 post-norm 有什么区别？

**强答案：**
区别在于 layer normalization 相对于子层（attention、FFN）的位置：

**Post-norm（原始 transformer）：**
```
x = LayerNorm(x + Sublayer(x))
```
在 residual 相加后再归一化。

**Pre-norm（现代 transformer）：**
```
x = x + Sublayer(LayerNorm(x))
```
在子层之前归一化。

更推荐 pre-norm，因为：
1. 梯度能更直接地通过 residual connection 传播
2. 训练更稳定，尤其是深层模型
3. 对初始化和学习率不那么敏感
4. 不需要 learning rate warmup

代价是某些基准上的最终性能会略低一些，但对于大模型来说，这种训练稳定性是值得的。

### Q: 解释 GQA，以及它为什么对 serving 很重要。

**强答案：**
Grouped Query Attention (GQA，分组查询注意力) 将 Key 和 Value 头在多个 Query 头组之间共享。

标准 Multi-Head Attention：64 个 query head，64 个 KV head（1:1）
GQA：64 个 query head，8 个 KV head（8:1）

实现方式：每个 KV head 通过重复方式供 8 个 query head 使用。

**为什么重要：**
KV cache 在生成过程中存储所有位置的 K 和 V。对于 8K 上下文的 Llama 70B：
- MHA：2.6 MB/token * 8K = 每个请求 21 GB
- GQA（8:1）：约 2.6 GB/请求

8 倍缩减带来：
- 更大的 batch size（更多并发用户）
- 更长上下文
- 更低的 GPU 显存需求

质量影响：很小。研究表明，GQA 可达到 MHA 99%+ 的质量。

### Q: GPT-2 和 Llama 2 之间有什么变化？

**强答案：**
关键架构改进：

| 组件 | GPT-2 | Llama 2 |
|-----------|-------|---------|
| 归一化 | Post-LayerNorm | Pre-RMSNorm |
| 位置 | Learned absolute（可学习绝对位置） | RoPE（rotary，旋转位置编码） |
| 激活函数 | GELU | SwiGLU |
| Attention | MHA | GQA（70B） |
| 偏置 | 有 | 移除 |

影响：
- RMSNorm：更快且同样有效
- RoPE：更好的长度外推
- SwiGLU：质量提升约 1%
- GQA：用于 serving 时 KV cache 缩小 8 倍
- 无偏置：参数更少，质量几乎不受影响

这些改动使得训练更大的模型时更稳定，部署服务时也更高效。

---

## 参考文献

- Vaswani 等. “Attention Is All You Need（注意力就是你所需要的一切）” (2017)
- Touvron 等. “Llama：开放且高效的基础语言模型（Foundation Language Models）” (2023)
- Touvron 等. “Llama 2：开放基础模型与微调聊天模型（Fine-Tuned Chat Models）” (2023)
- Zhang 和 Sennrich. “Root Mean Square Layer Normalization（均方根层归一化，RMS Layer Normalization）” (2019)
- Shazeer. “GLU Variants Improve Transformer（GLU 变体改进 Transformer）” (2020)
- Su 等. “RoFormer：采用旋转位置编码（Rotary Position Embedding）的增强 Transformer” (2021)
- Jiang 等. “Mistral 7B” (2023)

---

*上一篇: [注意力机制](03-attention-mechanisms.md) | 下一篇: [嵌入与向量空间](05-embeddings-and-vector-spaces.md)*
