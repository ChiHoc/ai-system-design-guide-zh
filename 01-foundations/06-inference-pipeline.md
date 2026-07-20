# 推理流水线（Inference Pipeline）

本章介绍 LLM（Large Language Model，大型语言模型）在推理时如何生成文本、涉及哪些计算阶段，以及生产服务中的关键指标。

## 目录（Table of Contents）

- [生成基础（Generation Basics）](#生成基础-generation-basics)
- [Prefill 和 Decode 阶段](#prefill-和-decode-阶段-prefill-and-decode-phases)
- [采样策略（Sampling Strategies）](#采样策略-sampling-strategies)
- [停止条件（Stopping Conditions）](#停止条件-stopping-conditions)
- [潜在优化：Speculative Decoding（推测解码）](#潜在优化-speculative-decoding-推测解码)
- [延迟指标与 TTFT 对比 TPS](#延迟指标-latency-metrics)
- [内存与计算需求](#内存与计算需求-memory-and-compute-requirements)
- [连续批处理与前缀缓存（Continuous Batching & Prefix Caching）](#连续批处理与前缀缓存-continuous-batching-and-prefix-caching)
- [多 LoRA 服务（Multi-LoRA Serving）](#多-lora-服务-multi-lora-serving)
- [流式传输](#流式传输-streaming)
- [生产环境注意事项（Production Considerations）](#生产环境注意事项-production-considerations)
- [面试问题（Interview Questions）](#面试问题-interview-questions)
- [参考资料（References）](#参考资料)

---

## 生成基础（Generation Basics）

LLM 以自回归（autoregressive）方式生成文本：一次生成一个 token，并使用所有先前 token 作为上下文。

```
Input: "The quick brown"
Step 1: Generate "fox" -> "The quick brown fox"
Step 2: Generate "jumps" -> "The quick brown fox jumps"
Step 3: Generate "over" -> "The quick brown fox jumps over"
...
```

### 生成循环（The Generation Loop）

```python
def generate(prompt: str, max_tokens: int, model) -> str:
    tokens = tokenize(prompt)
    
    for _ in range(max_tokens):
        # Forward pass: get logits for next token
        logits = model.forward(tokens)
        
        # Sample next token from probability distribution
        next_token = sample(logits[-1])
        
        # Check for stop condition
        if next_token == EOS_TOKEN:
            break
        
        tokens.append(next_token)
    
    return detokenize(tokens)
```

---

## Prefill 和 Decode 阶段（Prefill and Decode Phases）

推理分为两个特征不同的阶段：

### Prefill 阶段

并行处理整个输入 prompt。

```
Input: "The quick brown fox" (4 tokens)

Prefill:
- Process all 4 tokens simultaneously
- Compute attention across all pairs
- Populate KV cache for all positions
- Output: logits for next token
```

**特征：**
- 计算受限（compute-bound，矩阵运算很多）
- 可在 token 维度并行
- 耗时随 prompt 长度增长
- 每次生成只执行一次

### Decode 阶段

一次生成一个 token。

```
Decode step 1:
- Input: new token position only
- Attend to all KV cache (prompt + previously generated)
- Generate one token

Decode step 2:
- Append new K, V to cache
- Input: newest token position
- Generate next token

...repeat until done
```

**特征：**
- 内存受限（memory-bound，需要从 HBM 读取 KV cache）
- 串行执行（必须完成当前步骤才能开始下一步）
- 每 token 耗时大致恒定
- 重复执行直到满足停止条件

### 为什么这很重要

| 阶段 | 瓶颈 | 优化方式 |
|------|------|----------|
| Prefill | 计算（GPU 核心） | Flash Attention，更强的 GPU |
| Decode | 内存带宽 | GQA、批处理、量化 |

**对服务的影响：**
- 长 prompt 会增加 prefill 时间（影响 TTFT）
- 长生成会增加 decode 时间（影响总延迟）
- 批处理对 decode 效率的提升大于对 prefill 的提升

---

## 采样策略（Sampling Strategies）

在计算出 logits 后，需要选择下一个 token。不同策略会产生不同的输出。

### 贪婪解码（Greedy Decoding）

始终选择概率最高的 token：

```python
def greedy_sample(logits):
    return torch.argmax(logits)
```

**特性：**
- 确定性
- 长文本生成时常出现重复
- 适合事实型/结构化输出

### 温度采样（Temperature Sampling）

在 softmax 之前缩放 logits 以控制随机性：

```python
def temperature_sample(logits, temperature=1.0):
    scaled_logits = logits / temperature
    probs = torch.softmax(scaled_logits, dim=-1)
    return torch.multinomial(probs, num_samples=1)
```

**温度影响：**

| Temperature | 行为 | 使用场景 |
|-------------|------|----------|
| 0 | 贪婪（确定性） | 事实问答、代码 |
| 0.3-0.7 | 低随机性 | 通用任务 |
| 1.0 | 基线 | 创意写作 |
| 1.5+ | 高随机性 | 头脑风暴 |

### Top-K 采样（Top-K Sampling）

只考虑概率最高的 K 个 token：

```python
def top_k_sample(logits, k=50):
    values, indices = torch.topk(logits, k)
    probs = torch.softmax(values, dim=-1)
    sampled_idx = torch.multinomial(probs, num_samples=1)
    return indices[sampled_idx]
```

**作用：** 过滤掉低概率、可能没有意义的 token。

### Top-P（Nucleus）采样（Top-P / Nucleus Sampling）

包含 token，直到累计概率超过 P：

```python
def top_p_sample(logits, p=0.9):
    sorted_probs, sorted_indices = torch.sort(
        torch.softmax(logits, dim=-1), descending=True
    )
    cumulative_probs = torch.cumsum(sorted_probs, dim=-1)
    
    # Find cutoff
    cutoff_idx = torch.searchsorted(cumulative_probs, p)
    
    # Sample from truncated distribution
    selected_probs = sorted_probs[:cutoff_idx + 1]
    selected_probs = selected_probs / selected_probs.sum()
    sampled_idx = torch.multinomial(selected_probs, num_samples=1)
    
    return sorted_indices[sampled_idx]
```

**相比 Top-K 的优势：** 会根据概率分布动态调整。高置信预测包含更少 token；低置信预测包含更多 token。

### 常见配置

| 使用场景 | Temperature | Top-P | Top-K |
|----------|-------------|-------|-------|
| 代码生成 | 0-0.2 | 0.95 | - |
| 事实问答 | 0.1-0.3 | 1.0 | - |
| 通用聊天 | 0.7 | 0.9 | - |
| 创意写作 | 1.0 | 0.95 | - |
| 头脑风暴 | 1.2 | 1.0 | - |

### 重复惩罚（Repetition Penalties）

降低最近生成 token 的概率：

```python
def apply_repetition_penalty(logits, generated_tokens, penalty=1.2):
    for token_id in set(generated_tokens):
        logits[token_id] /= penalty
    return logits
```

**变体：**
- 存在惩罚（Presence penalty）：惩罚所有出现过的 token
- 频率惩罚（Frequency penalty）：按出现次数比例惩罚

---

## 停止条件（Stopping Conditions）

生成会持续到满足停止条件为止：

### EOS Token

模型生成序列结束 token：

```python
if next_token == tokenizer.eos_token_id:
    break
```

### 最大 Token 数

生成长度的硬限制：

```python
for i in range(max_tokens):
    # generate...
```

### 停止序列（Stop Sequences）

用于终止生成的自定义字符串：

```python
stop_sequences = ["###", "\n\n", "Human:"]

for seq in stop_sequences:
    if output.endswith(seq):
        output = output[:-len(seq)]
        break
```

## 潜在优化：Speculative Decoding（推测解码）

**当前高带宽服务的标准做法。**

推测解码使用一个更小的“草稿模型（draft model）”在单步中预测多个未来 token，然后由更大的“目标模型（target model）”并行验证。

```
Draft Model (Small): Predicts 5 tokens -> "The", "quick", "brown", "fox", "jumps"
Target Model (Large): Verifies all 5 tokens in ONE forward pass.
Result: If target agrees on 4 tokens, we've generated 4 tokens for the cost of 1 large forward pass.
```

| 方法 | 方法说明 | 加速比 | 示例 |
|------|----------|-------|------|
| Draft Model | 小模型（例如 1B）+ 大模型（70B） | 2x-3x | vLLM, TGI |
| **Medusa Heads** | 同一模型上的多个 LM heads | 1.5x-2x | Medusa, Eagle |
| Prompt Lookup | 使用 prompt 中的子串进行推测 | 1.2x | RAG / 代码补全 |

---

## 延迟指标（Latency Metrics）

### 首 token 时间（Time to First Token，TTFT）

从请求发出到第一个生成 token 的时间。

```
TTFT = network_latency + queue_time + prefill_time
```

**影响 TTFT 的因素：**
- Prompt 长度（prefill 为 O(n)）
- 模型大小
- GPU 速度
- 队列深度

**目标：**
- 交互式聊天：< 500ms
- 实时场景：< 200ms
- 批处理：没那么关键

### 每秒 token 数（Tokens Per Second，TPS）

首 token 之后的生成速率。

```
TPS = (total_tokens - 1) / (total_time - TTFT)
```

**影响 TPS 的因素：**
- 模型大小
- 批大小
- GPU 内存带宽
- KV cache 大小

**典型数值：**
- H100 上的 Llama 70B：每请求 30-50 tokens/sec
- 通过 API 使用的 GPT-4：20-80 tokens/sec（会变化）
- 小模型（7B）：100+ tokens/sec

### 总延迟（Total Latency）

```
Total = TTFT + (output_tokens / TPS)
```

**示例：**
- TTFT：200ms
- TPS：50 tokens/sec
- 输出：100 tokens
- 总计：200ms + 2000ms = 2.2s

### 吞吐量（Throughput）

单位时间内完成的请求数：

```
Throughput = concurrent_requests * TPS / average_output_tokens
```

更大的批大小会提高吞吐量，但也可能增加单请求延迟。

---

## 内存与计算需求（Memory and Compute Requirements）

### 模型权重（Model Weights）

```
Memory = parameters * bytes_per_parameter

70B model in FP16:
= 70B * 2 bytes
= 140 GB

70B model in INT4:
= 70B * 0.5 bytes
= 35 GB
```

### KV Cache

```
Per token: 2 * layers * heads * head_dim * bytes
Per request: per_token * sequence_length

Llama 70B (80 layers, 64 heads, 128 dim, FP16):
= 2 * 80 * 64 * 128 * 2 bytes
= 2.6 MB per token

At 4K context: 10.5 GB per request
At 8K context: 21 GB per request
```

### 总 GPU 内存（Total GPU Memory）

```
Total = model_weights + kv_cache * batch_size + activations

Example: Llama 70B serving
- Weights (INT4): 35 GB
- KV cache (8K, batch 4): 84 GB
- Activations: ~5 GB
- Total: ~124 GB (fits on 2x H100 80GB)
```

### 每 Token FLOPs（FLOPs per Token）

```
Forward pass FLOPs ≈ 2 * parameters

70B model:
≈ 140 TFLOPs per token

At 40 tokens/sec:
≈ 5.6 PFLOPs sustained
```

---

## 流式传输（Streaming）

对于交互式应用，应在生成过程中逐 token 发送：

### 服务器发送事件（Server-Side Events，SSE）

```python
# Server
async def generate_stream(prompt: str):
    for token in model.generate_iter(prompt):
        yield f"data: {json.dumps({'token': token})}\n\n"
    yield "data: [DONE]\n\n"

# Client
async for event in sse_client.stream("/generate"):
    token = json.loads(event.data)["token"]
    display(token)
```

### 好处

| 方面 | 流式 | 非流式 |
|------|------|--------|
| 感知延迟 | 仅 TTFT | 整个生成时间 |
| 用户体验 | 逐步呈现 | 先等待，再完整返回 |
| 提前终止 | 用户可停止 | 必须等待完成 |
| 内存 | 更低 | 更高（缓冲响应） |

### 实现细节

- 每个 token 后刷新一次
- 优雅处理连接断开
- 对于生成非常快的情况，考虑做缓冲
- 某些框架默认会缓冲；流式传输时要关闭

---

## 生产环境注意事项（Production Considerations）

### 为吞吐量进行批处理（Batching for Throughput）

将多个请求合并以最大化 GPU 利用率：

```python
# Without batching: GPU underutilized
for request in requests:
    response = model.generate(request)

# With batching: parallel processing
batch = collect_requests(timeout=10ms, max_batch=32)
responses = model.generate_batch(batch)
```

### 连续批处理与前缀缓存（Continuous Batching and Prefix Caching）

**连续批处理（Continuous Batching，迭代级调度，Iteration-level Scheduling）：**
与静态批处理不同，连续批处理会在批次中的任一请求命中 EOS token 后立即注入新请求。这可使吞吐量最高提升 20x。

**前缀缓存（Prefix Caching / RAD-O）：**
缓存公共前缀的 KV 张量（例如 system prompts、few-shot 示例）。
- **TTFT 降低**：90%
- **机制**：对前缀做哈希，在 GPU 内存的 LRU 缓存中查找 KV 张量。

### 多 LoRA 服务（Multi-LoRA Serving）

**场景：** 在一个基础模型上服务 1000 个不同的微调模型（adapter）。
**挑战：** 加载 1000 个独立模型会占用 TB 级 VRAM。

**解决方案（LoRAX / S-LoRA）：**
1. 在 VRAM 中加载一个基础模型。
2. 将 LoRA adapter（MB 级）存放在主机 RAM 或 SSD 中。
3. 根据请求 ID 在前向传播（forward pass）过程中动态切换 adapter。
4. **实现方式**：使用专用 kernel（S-LoRA），在同一批次中对多个不同 adapter 执行矩阵-向量乘法。

### 请求优先级（Request Prioritization）

```python
class RequestQueue:
    def __init__(self):
        self.high_priority = asyncio.Queue()
        self.low_priority = asyncio.Queue()
    
    async def get_next(self):
        if not self.high_priority.empty():
            return await self.high_priority.get()
        return await self.low_priority.get()
```

**优先级标准：**
- 客户等级
- 请求类型
- 等待时长
- 预估计算成本

### 超时处理（Timeout Handling）

```python
async def generate_with_timeout(prompt: str, timeout: float):
    try:
        result = await asyncio.wait_for(
            model.generate(prompt),
            timeout=timeout
        )
        return result
    except asyncio.TimeoutError:
        return {"error": "timeout", "partial": partial_output}
```

### 优雅降级（Graceful Degradation）

```python
async def generate_with_fallback(prompt: str):
    try:
        return await primary_model.generate(prompt)
    except RateLimitError:
        return await fallback_model.generate(prompt)
    except TimeoutError:
        return await small_fast_model.generate(prompt)
```

### 成本追踪（Cost Tracking）

```python
@dataclass
class RequestMetrics:
    input_tokens: int
    output_tokens: int
    model: str
    latency_ms: float
    cost_usd: float

def calculate_cost(metrics: RequestMetrics) -> float:
    pricing = {
        "gpt-4o": {"input": 2.50, "output": 10.00},
        "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    }
    rates = pricing[metrics.model]
    return (
        (metrics.input_tokens / 1_000_000) * rates["input"] +
        (metrics.output_tokens / 1_000_000) * rates["output"]
    )
```

---

## 面试问题（Interview Questions）

### 问：解释 prefill 和 decode 阶段的区别。

**标准答案：**
LLM 推理有两个截然不同的阶段：

**Prefill：**
- 一次性处理完整输入 prompt
- 所有 token 并行彼此 attention
- 为所有 prompt 位置填充 KV cache
- 计算受限（compute-bound）：更高效利用 GPU 核心
- 耗时随 prompt 长度增长

**Decode：**
- 一次生成一个 token
- 新 token 对所有 KV cache 条目进行 attention
- 向缓存追加新的 K、V
- 内存受限（memory-bound）：受 KV cache 读取限制
- 每 token 耗时大致恒定

这对系统设计很重要，因为：
- 长 prompt 会增加 TTFT（prefill 密集）
- 批处理对 decode 的帮助大于对 prefill
- 两个阶段需要不同的优化策略

### 问：temperature 和 top-p 如何影响生成？

**标准答案：**
二者都控制 token 选择中的随机性：

**Temperature：**
- 在 softmax 前缩放 logits
- 低值（0-0.3）：更确定，优先选择高概率 token
- 高值（1.0+）：更随机，拉平概率分布
- 0：贪婪解码

**Top-p（nucleus sampling，核采样）：**
- 过滤到累计概率大于 p 的最小 token 集合
- 根据分布动态调整截断阈值
- 高置信：考虑更少 token
- 低置信：考虑更多 token

典型生产配置：
- 事实问答：temperature 0.1，top-p 0.95
- 通用聊天：temperature 0.7，top-p 0.9
- 创意场景：temperature 1.0+，top-p 0.95

关键洞察是二者协同工作。temperature 改变分布形状，top-p 截断分布。

### 问：TTFT 和 TPS 由什么决定？

**标准答案：**
**TTFT（Time to First Token）：**
- 到达服务器的网络延迟
- 队列等待时间
- Prefill 计算时间
- 主要受：prompt 长度、GPU 计算速度影响

**TPS（Tokens Per Second）：**
- Decode 阶段效率
- 读取 KV cache 的内存带宽
- 主要受：内存带宽、批大小、模型大小影响

优化策略不同：
- TTFT：尽量缩短 prompt，使用更快的网络，减少排队
- TPS：增大批大小，使用 GQA/MQA 模型，优化内存访问

权衡在于：批处理会提升 TPS（吞吐量），但如果请求需要等待 batch 形成，也可能增加 TTFT（延迟）。

### 问：你会如何估算服务某个模型所需的 GPU？

**标准答案：**
主要有三类内存消耗：

1. **模型权重（Model weights）：**
   - FP16：参数数 × 2 字节
   - INT8：参数数 × 1 字节
   - INT4：参数数 × 0.5 字节

2. **KV cache：**
   - 每 token：2 × 层数（layers）× kv_heads × head_dim × 2 字节（FP16）
   - 每请求：per_token × sequence_length
   - 总计：per_request × batch_size

3. **激活值（Activations）：** 通常额外占 5%-10%

Llama 70B 服务示例：
- 权重（INT4）：35 GB
- KV cache（8K 上下文，batch 8）：168 GB
- 需求：约 200 GB 总内存

硬件选项：
- 3x A100 80GB，配合张量并行（tensor parallelism）
- 2x H100 80GB，配合张量并行（tensor parallelism）
- 8x A100 40GB，配合更多并行度

然后通过基准测试（benchmarking）验证吞吐量是否满足要求。

---

## 参考资料

- Holtzman 等. “神经文本退化的奇特案例（The Curious Case of Neural Text Degeneration）”（nucleus sampling（核采样），2020）
- Kwon 等. “针对采用 PagedAttention 的大语言模型服务的高效内存管理（Efficient Memory Management for Large Language Model Serving with PagedAttention）”（vLLM，2023）
- [vLLM 文档](https://docs.vllm.ai/)
- [TensorRT-LLM](https://github.com/NVIDIA/TensorRT-LLM)
- [OpenAI API 文档](https://platform.openai.com/docs/api-reference)

---

*上一页: [嵌入与向量空间](05-embeddings-and-vector-spaces.md) | 下一页: [模型谱系](../02-model-landscape/01-model-taxonomy.md)*
