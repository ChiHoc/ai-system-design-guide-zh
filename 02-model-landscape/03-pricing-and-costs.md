# 定价与成本

理解大型语言模型（LLM）系统的成本结构对生产规划至关重要。本章涵盖定价模型、成本优化策略和总体拥有成本（TCO）分析。

## 目录

- [定价模型](#定价模型)
- [当前 API 定价](#当前-api-定价)
- [成本计算](#成本计算)
- [成本优化策略](#成本优化策略)
- [上下文缓存经济性](#上下文缓存经济学)
- [自托管与 GPU 云套利](#自托管与-gpu-云套利)
- [总体拥有成本](#总拥有成本)
- [面试问题](#面试题)
- [参考资料](#参考资料)

---

## 定价模型

### 基于标记（Token）的定价

大多数 LLM API 按标记（token）计费：

```
Cost = (input_tokens × input_rate) + (output_tokens × output_rate)
```

**关键观察：**
- 输出标记的成本是输入标记的 2-5 倍
- 定价因模型层级而差异显著
- 一些供应商提供批量折扣

### 分层定价

一些供应商提供按量折扣：

| 层级 | 月支出 | 折扣 |
|------|--------|------|
| Standard | $0 - $5K | 0% |
| Growth | $5K - $50K | 10-20% |
| Enterprise | $50K+ | 定制协商 |

### 承诺式定价

以折扣价预购标记（token）：

```
Standard: $2.50 / 1M input tokens
Committed (1-year): $2.00 / 1M input tokens (20% savings)
```

---

## 当前 API 定价

### 2026 年 5 月定价

> **最后核验：2026 年 6 月 10 日。** 价格会频繁变动。请始终重新核对：[OpenAI](https://developers.openai.com/api/docs/pricing)、[Anthropic](https://platform.claude.com/docs/en/about-claude/pricing)、[Google](https://ai.google.dev/gemini-api/docs/pricing)、[xAI](https://docs.x.ai/developers/models)、[DeepSeek](https://api-docs.deepseek.com/quick_start/pricing)
>
> **2026 年生效的弃用：** OpenAI 于 2026 年 2 月 13 日将 ChatGPT 中的 GPT-4o、GPT-4.1、GPT-4.1-mini、o4-mini 退役；gpt-5.2-chat-latest 和 gpt-5.3-chat-latest 于 2026 年 5 月 8 日弃用；Realtime API Beta 于 2026 年 5 月 12 日移除；Sora 应用于 2026 年 4 月 26 日关闭（API EOL 为 2026 年 9 月 24 日）。Anthropic 将 Claude Sonnet 4 和 Claude Opus 4 于 2026 年 6 月 15 日退役，并将 Claude Opus 4.1 于 2026 年 8 月 5 日退役。Google Vertex 于 2026 年 3 月 26 日退役 `gemini-3-pro-preview`；Project Mariner 于 2026 年 5 月 4 日关闭。Gemini 2.5 Pro/Flash 于 2026 年 6 月 17 日弃用。
>
> **价格变动：** Anthropic 于 2026 年 6 月 9 日发布 **Claude Fable 5**，价格为每 100 万输入标记 $10 / 输出标记 $50：这是其能力最强的广泛发布模型（具备 Mythos 级能力并带安全护栏），价格是 Opus 4.8 的 2 倍，但不到 Claude Mythos Preview 的一半。**Claude Mythos 5**（同一底层模型，移除了部分安全护栏，仅限 Glasswing）沿用 $10 / $50 的价格。Anthropic 于 2026 年 5 月 28 日发布 **Claude Opus 4.8**，其输入/输出价格与 Opus 4.7 相同，均为每 100 万 $5 / $25，同时提供可选快速模式，价格为每 100 万 $10 / $50（比 Opus 4.7 的快速模式快约 2.5 倍，便宜 3 倍；后者为每 100 万 $30 / $150）。DeepSeek 于 2026 年 5 月 22 日将其 75% 的 V4 Pro 折扣**永久化**：自 2026 年 6 月 1 日起，新标价为原价的 25%（输入 $0.435 / 输出 $0.87 每 100 万），并且自 2026 年 4 月 26 日起，所有 DeepSeek 模型的缓存命中输入价降至发布价的 1/10。DeepSeek V4 Flash（$0.14 / $0.28 每 100 万，1M context）是目前价格最低的 frontier-class API，优势明显。

#### OpenAI（GPT-5.x 代）
| 模型 | 输入 / 100万 | 输出 / 100万 | 备注 |
|-------|------------|-------------|------|
| **GPT-5.5** ⭐ NEW | $5.00 | $30.00 | 2026 年 4 月 23 日发布。1M context。新一类多模态旗舰模型。 |
| **GPT-5.5 Instant** ⭐ NEW | 查看最新 | 查看最新 | 自 2026 年 5 月 5 日起作为 ChatGPT 和 `chat-latest` 的默认模型。高风险提示上的幻觉减少 52.5%。 |
| **GPT-Realtime-2** ⭐ NEW | $32.00（音频） | $64.00（音频） | 2026 年 5 月 7 日发布。GPT-5 级实时语音。 |
| **GPT-Realtime-Translate** ⭐ NEW | （音频定价） | （音频定价） | 70+ 输入语言 → 13 种输出语言。 |
| **GPT-5.4 Pro** | $30.00 | $180.00 | 最强推理；长上下文价格翻倍至 $60/$270 |
| **GPT-5.4** | $2.50 | $15.00 | 旗舰模型；原生 computer use；缓存输入 $1.25 |
| **GPT-5.4-mini** | $0.75 | $4.50 | GPT-5 级别中性价比最佳 |
| **GPT-5.4-nano** | 查看最新 | 查看最新 | 最小的 GPT-5.4 变体；2026 年 3 月发布 |
| **GPT-4o** | $2.50 | $10.00 | 2026 年 2 月 13 日从 ChatGPT 退役；API 访问情况因渠道而异 |
| **GPT-4o-mini** | $0.15 | $0.60 | 旧版；请查看 API 可用性 |

#### Anthropic（Claude Fable + 4.x 代）
| 模型 | 输入 / 100万 | 输出 / 100万 | 上下文 | 备注 |
|-------|------------|-------------|---------|------|
| **Claude Fable 5** ⭐ NEW | $10.00 | $50.00 | 1M | 2026 年 6 月 9 日发布（`claude-fable-5`），可在 Claude API、Claude Platform on AWS、Bedrock、Vertex AI、Microsoft Foundry 上使用。Anthropic 广泛发布中能力最强的模型（具备 Mythos 级能力并带安全护栏；敏感查询会在 5% 以内的会话中回退到 Opus 4.8）。始终启用 adaptive thinking（自适应思考）；最大输出 128K；适用 30 天数据保留。 |
| **Claude Mythos 5** ⭐ NEW | $10.00 | $50.00 | 1M | 与 Fable 5 共享同一底层模型，但在部分领域取消了安全护栏。可用范围有限：Project Glasswing 合作方和部分生物学研究人员。以不到一半的价格取代 Mythos Preview。 |
| **Claude Opus 4.8** | $5.00 | $25.00 | 1M | 2026 年 5 月 28 日发布，可在 API、Bedrock、Vertex AI 上使用。带并行 subagents 的 Dynamic Workflows 研究预览版。可选快速模式为每 100 万 $10 / $50（比 Opus 4.7 的快速模式快约 2.5 倍、便宜 3 倍）。SWE-bench Verified 88.6%；SWE-Bench Pro 69.2%；OSWorld-Verified 82.3%。 |
| **Claude Opus 4.7** | $5.00 | $25.00 | 1M | 2026 年 4 月 16 日发布，可在 API、Bedrock、Vertex、Microsoft Foundry 上使用。更高分辨率视觉，更强的 SWE。快速模式：每 100 万 $30 / $150。 |
| **Claude Opus 4.6** | $5.00 | $25.00 | 1M | 最大输出 128K；以标准费率提供 adaptive thinking。 |
| **Claude Sonnet 4.6** | $3.00 | $15.00 | 1M | 以更低成本覆盖大多数 Opus 级任务。**截至 2026 年 6 月 10 日，仍没有 Sonnet 4.8。** |
| **Claude Haiku 4.5** | $1.00 | $5.00 | 200K | Anthropic 最快的模型；缓存命中输入 $0.10 / 1M。 |
| **Claude Mythos Preview** | 不适用 | 不适用 | - | 限制性的研究预览版（约 11 个 Glasswing 合作方）；已于 2026 年 6 月 9 日被 Claude Mythos 5 取代。 |

> [!NOTE]
> **标准定价下的 Claude 1M 上下文**：Fable 5、Opus 4.8、Opus 4.7、Opus 4.6 和 Sonnet 4.6 都以标准费率提供完整的 1M token 上下文窗口，长上下文没有额外溢价层级。Batch API 提供 50% 折扣。缓存命中价格为标准输入价的 10%。Opus 4.8（每 100 万 $10 / $50）以及 Opus 4.7 / 4.6（每 100 万 $30 / $150）的快速模式定价可与缓存倍率叠加，但在 Batch API 或 Claude Platform on AWS 上不可用。发布时没有 Fable 级快速模式。

#### Google（Gemini 3.x 代）
| 模型 | 输入 / 100万 | 输出 / 100万 | 上下文 | 备注 |
|-------|------------|-------------|---------|------|
| **Gemini 3.1 Pro** | $2.00 | $12.00 | 1M | 200K+ 上下文：$4.00/$18.00 |
| **Gemini 3.1 Flash** | $0.10 | $3.00 | 1M | 性价比最佳；适合高吞吐 |
| **Gemini 2.5 Flash-Lite** | $0.10 | $0.40 | 1M | 2026 年 6 月弃用 |

> [!WARNING]
> **Gemini 2.5 弃用**：Gemini 2.5 Pro 和 2.5 Flash 计划于 2026 年 6 月 17 日弃用。请迁移到 Gemini 3.x 模型。

#### xAI（Grok）
| 模型 | 输入 / 100万 | 输出 / 100万 | 上下文 | 备注 |
|-------|------------|-------------|---------|------|
| **Grok 4** | $3.00 | $15.00 | 256K | 原生工具调用；实时搜索 |
| **Grok 4.1 Fast** | $0.20 | $0.50 | 2M | 高吞吐、低成本 |
| **Grok 3 mini** | 查看最新 | 查看最新 | - | 更快，但准确性更低 |

#### 通过 API 提供的开源权重模型（2026 年 5 月）
| 模型 | 输入 / 100万 | 输出 / 100万 | 上下文 | 提供方示例 |
|-------|------------|-------------|---------|-------------------|
| **DeepSeek-V3.2** | $0.28 | $0.42 | 128K | DeepSeek API。缓存命中折扣 98%。通过路由后的有效费率可下降 10-30 倍。 |
| **DeepSeek V4 Pro** ⭐ NEW | $0.435 | $0.87 | 1M | DeepSeek API。75% 的促销折扣已**永久化**：自 2026 年 6 月 1 日起，新标价为原价的 25%（$1.74 / $3.48）。缓存命中输入：$0.003625/M。1M tokens 时，约为 V3.2 的 27% 计算量 / 10% 内存占用。 |
| **DeepSeek V4 Flash** ⭐ NEW | $0.14 | $0.28 | 1M | DeepSeek API。缓存命中输入：$0.0028/M（98% 折扣）。13B-active MoE。当前是最便宜的 frontier-class 1M-context API。 |
| **Mistral Medium 3.5** ⭐ NEW | $1.50 | 查看最新 | 256K | Mistral API。统一聊天 / 推理 / 编码 / 视觉；SWE-Bench Verified 77.6%。 |
| **Kimi K2.6** ⭐ NEW | 查看最新 | 查看最新 | - | Moonshot API。1T MoE / 32B active；agent swarm 可扩展到 300 个 sub-agents。 |
| **Qwen 3.6-35B-A3B** ⭐ NEW | 查看最新 | 查看最新 | - | Apache 2.0 权重；可自托管或通过 API 提供方使用。 |
| **Llama 4 Scout** | $0.11 | $0.34 | 10M | Together AI、Groq、Fireworks。注意：超过 32K 后有效上下文会快速衰减。 |
| **Llama 4 Maverick** | $0.27 | $0.85 | 1M | Together AI、Groq、Fireworks。需要支持 MoE 感知的服务方式。 |
| **DeepSeek-V3** | $0.25 | $1.10 | 128K | DeepSeek API、Together AI |
| **DeepSeek-R1** | $0.55 | $2.19 | 128K | DeepSeek API |
| **Mistral Large 3** | $0.50 | $1.50 | 256K | Mistral API、AWS Bedrock |
| **Llama 3.3 70B** | ~$0.10–0.20 | ~$0.30–0.60 | 128K | Groq、Together AI |
| **Qwen2.5-Coder-32B** | ~$0.50 | ~$1.00 | 32K | Together AI |
| **Gemma 4（31B / 26B-A4B MoE / E4B / E2B）** ⭐ NEW | 自托管 | 自托管 | 256K | Apache 2.0。140+ 种语言；原生视觉/音频；函数调用。 |

#### 嵌入模型（Embedding Models，2026 年 5 月）
| 模型 | 每 100 万 token 成本 | 维度 |
|-------|------------------|-----------|
| **Cohere Embed 4** ⭐ NEW | $0.10 | 256 / 512 / 1024 / 1536（Matryoshka） |
| **text-embedding-3-large** | $0.13 | 3072 |
| **text-embedding-3-small** | $0.02 | 1536 |
| **Voyage-3** | $0.06 | 1024 |
| **Cohere embed-v3** | $0.10 | 1024 |

> [!IMPORTANT]
> **推理时计算成本（Inference-time Compute Costs）：** 对于具有“扩展思考（Extended Thinking）”或推理模式的模型（如 GPT-5.4 Pro、Claude Opus 4.6），即使这些内部思考内容没有展示给用户，也会对**内部思考标记（internal thinking tokens）**计费。这会使复杂逻辑任务的总请求成本增加 2 到 10 倍。生产环境中务必设置 `budget_tokens` 上限。

---

## 成本计算

### 基础成本公式

```python
def calculate_request_cost(
    input_tokens: int,
    output_tokens: int,
    model: str
) -> float:
    pricing = {
        "gpt-5.4": {"input": 2.50, "output": 15.00},
        "gpt-5.4-mini": {"input": 0.75, "output": 4.50},
        "claude-sonnet-4.6": {"input": 3.00, "output": 15.00},
        "claude-opus-4.6": {"input": 5.00, "output": 25.00},
        "gemini-3.1-flash": {"input": 0.10, "output": 3.00},
    }
    
    rates = pricing[model]
    cost = (
        (input_tokens / 1_000_000) * rates["input"] +
        (output_tokens / 1_000_000) * rates["output"]
    )
    return cost
```

### 示例成本计算

**场景 1：RAG 聊天机器人**
```
Per request:
- System prompt: 500 tokens
- Retrieved context: 2,000 tokens
- User message: 100 tokens
- Response: 300 tokens

Input: 2,600 tokens, Output: 300 tokens

GPT-5.4 cost: (2600 × $2.50 + 300 × $15) / 1M = $0.0110 per request

At 10,000 requests/day:
Daily: $95
Monthly: $2,850
```

**场景 2：文档摘要**
```
Per document:
- Document: 8,000 tokens
- Summary: 500 tokens

GPT-5.4 cost: (8000 × $2.50 + 500 × $15) / 1M = $0.0275

1,000 documents: $27.50
10,000 documents: $275
```

### 月度成本预测

```python
def project_monthly_cost(
    requests_per_day: int,
    avg_input_tokens: int,
    avg_output_tokens: int,
    model: str
) -> dict:
    per_request = calculate_request_cost(
        avg_input_tokens, avg_output_tokens, model
    )
    
    daily = per_request * requests_per_day
    monthly = daily * 30
    yearly = monthly * 12
    
    return {
        "per_request": per_request,
        "daily": daily,
        "monthly": monthly,
        "yearly": yearly
    }

# Example
costs = project_monthly_cost(
    requests_per_day=50000,
    avg_input_tokens=2000,
    avg_output_tokens=400,
    model="gpt-5.4"
)
# Output: ~$18,750/month
```

---

## 成本优化策略

### 策略 1：模型路由（Model Routing）

将请求路由到合适的模型层级：

```python
class ModelRouter:
    def __init__(self):
        self.classifier = load_complexity_classifier()
    
    def route(self, query: str, context: str) -> str:
        complexity = self.classifier.predict(query)
        
        if complexity < 0.3:
            return "gpt-5.4-mini"  # Simple queries
        elif complexity < 0.7:
            return "gpt-5.4-mini"  # Medium, try cheap first
        else:
            return "gpt-5.4"  # Complex queries

    def route_with_fallback(self, query: str, context: str) -> str:
        # Try cheap model first
        response = self.try_model("gpt-5.4-mini", query, context)

        if self.is_quality_sufficient(response):
            return response

        # Fallback to expensive model
        return self.try_model("gpt-5.4", query, context)
```

**潜在节省：** 在对质量影响最小的情况下可节省 50-70%

### 策略 2：提示词优化（Prompt Optimization）

在不损失质量的前提下降低标记（token）数量：

```python
# Before: 2,500 tokens
system_prompt = """
You are a helpful customer support assistant for Acme Corp. 
You have access to our product documentation and should answer 
questions accurately and helpfully. Always be polite and professional.
If you don't know something, say so rather than making things up.
Format your responses clearly with bullet points when listing items.
[... more verbose instructions ...]
"""

# After: 800 tokens
system_prompt = """
You are Acme Corp's support assistant.
Rules:
- Answer from provided context only
- Admit uncertainty
- Use bullet points for lists
- Be concise
"""

# Savings: 1,700 tokens × $2.50/1M = $0.00425 per request
# At 10K requests/day: $42.50/day = $1,275/month
```

### 策略 3：缓存（Caching）

为重复或相似查询缓存响应：

```python
class ResponseCache:
    def __init__(self, ttl_seconds: int = 3600):
        self.exact_cache = TTLCache(maxsize=10000, ttl=ttl_seconds)
        self.semantic_cache = SemanticCache(threshold=0.95)
    
    def get_or_generate(self, query: str, context: str) -> tuple[str, bool]:
        # Check exact cache
        cache_key = self.make_key(query, context)
        if cache_key in self.exact_cache:
            return self.exact_cache[cache_key], True  # Cache hit
        
        # Check semantic cache
        similar = self.semantic_cache.find_similar(query)
        if similar:
            return similar.response, True  # Semantic hit
        
        # Generate new response
        response = self.generate(query, context)
        self.exact_cache[cache_key] = response
        self.semantic_cache.add(query, response)
        
        return response, False  # Cache miss

# With 30% cache hit rate:
# Baseline: $3,000/month
# With caching: $2,100/month
# Savings: $900/month
```

### 策略 4：批处理（Batch Processing）

将多个请求打包处理以提高效率：

```python
# Real-time: pay full price
for query in queries:
    response = model.generate(query)

# Batch API (OpenAI offers 50% discount):
batch_responses = model.batch_generate(queries)
# Cost: 50% of real-time pricing
```

### 策略 5：输出长度控制

适当限制响应长度：

```python
# Reduce unnecessary output
response = model.generate(
    prompt=prompt,
    max_tokens=300,  # Limit output
    stop=["\n\n"]    # Stop at natural break
)

# Cost impact:
# Before: avg 500 output tokens = $0.0075 per request (GPT-5.4)
# After: avg 250 output tokens = $0.00375 per request
# Savings: 50% on output costs
```

### 成本优化总结

| 策略 | 工作量 | 潜在节省 |
|------|--------|----------|
| 模型路由 | 中等 | 50-70% |
| **上下文缓存** | 低 | **60-90%（输入）** |
| 提示词优化 | 低 | 20-40% |
| 响应缓存 | 中等 | 20-40% |
| 批处理 | 低 | 50%（OpenAI/Anthropic） |

---

## 上下文缓存经济学

**RAG（检索增强生成）的“黄金法则”（在 2026 年仍然成立）。**  
如果你有一个固定的 system prompt（系统提示）或共享知识库（prefix，前缀）长度超过 10,000 tokens，那么**Context Caching（上下文缓存）**就是必需的。

**盈亏平衡分析（Break-even Analysis，Claude Sonnet 4.6）：**
- **Standard Input（标准输入）**：$3.00 / 1M tokens
- **Cached Input（缓存输入）**：$0.30 / 1M tokens（9 折优惠）
- **Cache Write Fee（缓存写入费用）**：$3.75 / 1M tokens（5 分钟 TTL，1.25x）；$6.00（1 小时 TTL，2x）

`Break-even = (Write Fee) / (Standard Rate - Cached Rate) ≈ 1.4 requests (5-min) or 2.2 requests (1-hour)`

如果你的长前缀被**超过 2 个用户**使用，那么缓存它在成本上就严格低于每次都原样发送。OpenAI 和 Anthropic 现在都提供 batch API（批处理 API）折扣（5 折），并且可以与缓存叠加。

---

## 自托管与 GPU 云套利

**预留实例与无服务器方案的权衡：**

| 模型大小 | 无服务器方案（RunPod/Together） | 预留方案（Lambda/AWS） |
|------------|-----------------------------|-----------------------|
| **突发容量** | 无限（冷启动） | 固定 |
| **利用率** | 仅按计算时间付费 | 24/7 固定成本 |
| **TCO 盈亏平衡**| **利用率 < 40% 时更具成本效益** | **利用率 > 40% 时更具成本效益** |

**高阶细节：**  
“GPU Cloud Arbitrage（GPU 云套利）”是指基于**spot instance（抢占式实例）可用性**在不同提供商之间迁移生产工作负载。像 **Skypilot** 这样的工具可以自动化这一过程，通过跟随全球“低需求”区域，最多可节省 60% 的自托管成本。MoE（Mixture of Experts，混合专家）模型的兴起（如 Llama 4 Scout 可运行在单张 H100 上，Maverick 约需 2 张 H100，DeepSeek V4 Flash 约需 4 张 H100）与密集模型相比，进一步降低了自托管所需的 GPU 资源。

### 何时适合自托管

```
Break-even analysis:

API cost at scale:
- 1M requests/month
- 2,500 tokens average
- GPT-5.4: ~$37,500/month
- Claude Sonnet 4.6: ~$30,000/month

Self-hosted equivalent (Llama 4 Maverick via MoE):
- 2x H100 80GB: ~$6/hour × 730 = $4,380/month
- Engineering time: $5,000/month (0.5 FTE)
- Ops overhead: $2,000/month
- Total: ~$11,380/month

Savings vs GPT-5.4: $26,120/month = 70%
Savings vs Claude Sonnet 4.6: $18,620/month = 62%
```

### 自托管成本组成

| 组成项 | 月度成本 | 说明 |
|-----------|--------------|-------|
| GPU 计算 | $5K-20K | 取决于模型大小 |
| 存储 | $200-500 | 模型权重、日志 |
| 网络 | $100-500 | 出口流量、负载均衡 |
| 工程 | $5K-15K | 运维相关的部分 FTE |
| 监控 | $100-500 | 可观测性工具 |

### 按模型大小划分的 GPU 要求

| 模型大小 | GPU 配置 | 预估月成本 |
|------------|------------|---------------------|
| 7B (INT4) | 1x A10G | $500-800 |
| 7B (FP16) | 1x A100 40GB | $1,500-2,500 |
| 70B (INT4) | 2x A100 80GB | $5,000-8,000 |
| 70B (FP16) | 4x A100 80GB | $10,000-15,000 |
| 405B (INT4) | 8x H100 | $20,000-30,000 |

### 决策框架

```
Choose API when:
- Volume < 100K requests/month
- No ML ops expertise
- Need highest quality (frontier models)
- Fast iteration needed

Choose self-hosting when:
- Volume > 500K requests/month
- Have ML infrastructure team
- Data privacy requirements
- Predictable, stable workload
- Custom fine-tuning needed
```

---

## 总拥有成本

### TCO 组成

```python
def calculate_tco(scenario: dict) -> dict:
    # Direct costs
    api_or_compute = scenario["monthly_api_cost"]
    
    # Engineering costs
    development = scenario["dev_hours"] * scenario["engineer_rate"]
    maintenance = scenario["maintenance_hours"] * scenario["engineer_rate"]
    
    # Infrastructure
    vector_db = scenario["vector_db_cost"]
    monitoring = scenario["monitoring_cost"]
    
    # Indirect costs
    downtime_risk = scenario["expected_downtime_hours"] * scenario["revenue_per_hour"]
    
    monthly_tco = (
        api_or_compute +
        development / 12 +  # Amortized over year
        maintenance +
        vector_db +
        monitoring +
        downtime_risk
    )
    
    return {
        "monthly_tco": monthly_tco,
        "yearly_tco": monthly_tco * 12,
        "breakdown": {
            "llm": api_or_compute,
            "engineering": development / 12 + maintenance,
            "infrastructure": vector_db + monitoring,
            "risk": downtime_risk
        }
    }
```

### TCO 对比示例

**场景：客服机器人（每月 50K 请求）**

| 成本组成 | 基于 API | 自托管 |
|----------------|-----------|-------------|
| LLM 成本 | $5,000 | $3,000 |
| 向量数据库 | $70 | $200 |
| 工程（每月） | $500 | $3,000 |
| 监控 | $100 | $200 |
| **月度合计** | **$5,670** | **$6,400** |

*在这个规模下，由于工程开销，API 更便宜。*

**场景：大规模 RAG（每月 2M 请求）**

| 成本组成 | 基于 API | 自托管 |
|----------------|-----------|-------------|
| LLM 成本 | $50,000 | $15,000 |
| 向量数据库 | $500 | $1,000 |
| 工程（每月） | $1,000 | $8,000 |
| 监控 | $200 | $500 |
| **月度合计** | **$51,700** | **$24,500** |

*在这个规模下，自托管明显更便宜。*

---

## 面试题

### 问：你会如何为高流量 RAG 应用优化成本？

**优秀答案：**  
我会分层进行成本优化：

**1. 架构优化：**
- 模型路由：简单查询使用低成本模型
- 缓存：30%-40% 的查询可能可缓存
- 提示词压缩：尽量减少 system prompt 的 token 数

**2. 模型选择：**
```
Simple queries (60%): GPT-5.4-mini at $0.003/request
Complex queries (40%): GPT-5.4 at $0.011/request
Weighted avg: $0.0062/request (vs $0.011 all GPT-5.4)
Savings: 44%
```

**3. 基础设施：**
- 批量 embedding 更新（便宜 50%）
- 向量数据库按需配型
- 尽可能使用 spot instance（抢占式实例）

**4. 监控：**
- 跟踪各类查询的单次成本
- 对异常情况发出告警
- 定期进行成本复盘

### 问：你会在什么情况下推荐自托管而不是使用 API？

**优秀答案：**  
决策取决于多个因素：

**流量阈值：**
- 低于 100K/月：几乎总是用 API
- 100K-500K：视具体情况评估
- 高于 500K：通常自托管更占优

**团队能力：**
- 没有 ML ops：无论规模都用 API
- 基础设施团队强：可更早考虑自托管

**质量要求：**
- 需要绝对最佳效果：API（前沿模型）
- 足够好即可：自托管开源模型

**其他因素：**
- 数据隐私：可能强制要求自托管
- 延迟控制：自托管可提供更多控制
- 微调需求：自托管支持更多定制

**我的推荐流程：**
1. 先从 API 开始，以便最快迭代
2. 构建模型切换抽象层
3. 当支出超过 $10K/月时评估自托管
4. 在最终定案前先做影子部署试点

---

## 参考资料

- OpenAI Pricing: https://developers.openai.com/api/docs/pricing
- Anthropic Pricing: https://platform.claude.com/docs/en/about-claude/pricing
- Google AI Pricing: https://ai.google.dev/gemini-api/docs/pricing
- xAI Pricing: https://docs.x.ai/developers/models
- Mistral Pricing: https://docs.mistral.ai/getting-started/changelog
- Lambda Labs GPU Pricing: https://lambdalabs.com/service/gpu-cloud
- RunPod Pricing: https://www.runpod.io/pricing
- LLM Pricing Comparison: https://pricepertoken.com/

---

*上一篇：[能力评估](02-capability-assessment.md) | 下一篇：[模型选择指南](04-model-selection-guide.md)*
