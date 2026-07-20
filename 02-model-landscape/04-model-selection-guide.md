# 模型选型指南

一套实用框架，用于根据能力、成本、延迟和运营因素为你的用例选择合适的 LLM。

## 目录

- [选择框架](#选择框架)
- [能力对比](#能力对比)
- [用例映射](#用例映射)
- [成本分析](#成本分析)
- [运营考量](#运营考量)
- [多模型策略](#多模型策略)
- [面试问题](#面试问题)
- [参考资料](#参考资料)

---

## 选择框架

### 决策树（2026 年 6 月）

```
Start Here
    │
    ├── Need the absolute capability ceiling?
    │   └── Yes ─────────────────────────────────────────┐
    │   └── No ──┐                                       │
    │            │                                       ▼
    │            │                              ┌─────────────────┐
    │            │                              │ Claude Fable 5  │
    │            │                              │ ($10/$50, 1M)   │
    │            │                              └─────────────────┘
    │            │
    ├── Need autonomous agents / long-horizon planning?
    │   └── Yes ─────────────────────────────────────────┐
    │   └── No ──┐                                       │
    │            │                                       ▼
    │            │                              ┌─────────────────┐
    │            │                              │ Claude Opus 4.8 │
    │            │                              │ GPT-5.5 reason. │
    │            │                              └─────────────────┘
    │            │
    ├── Need best software engineering / coding?
    │   └── Yes ─────────────────────────────────────────┐
    │   └── No ──┐                                       │
    │            │                                       ▼
    │            │                              ┌─────────────────┐
    │            │                              │ Fable 5 ceiling /│
    │            │                              │ GPT-5.5 88.7%   │
    │            │                              │ Opus 4.8 88.6%  │
    │            │                              │ Sonnet 4.6 cheap│
    │            │                              └─────────────────┘
    │            │
    ├── Need to process massive context (>1M)?
    │   └── Yes ─────────────────────────────────────────┐
    │   └── No ──┐                                       │
    │            │                                       ▼
    │            │                              ┌─────────────────┐
    │            │                              │ Gemini 3.0 Pro  │
    │            │                              │ (2.5M context)  │
    │            │                              └─────────────────┘
    │            │
    ├── Cost-sensitive high volume?
    │   └── Yes ─────────────────────────────────────────┐
    │   └── No ──┐                                       │
    │            │                                       ▼
    │            │                              ┌─────────────────┐
    │            │                              │ Gemini 3 Flash /│
    │            │                              │ o4-mini         │
    │            │                              └─────────────────┘
    │            │
    └── Default: Production Choice
                 ▼
        ┌─────────────────┐
        │ Claude Sonnet 4.6│
        │ GPT-5.5-mini    │
        └─────────────────┘
```

### 关键选型因素

| 因素 | 权重 | 考量 |
|--------|--------|----------------|
| **Agentic Reliability（代理式可靠性）** | 高 | 工具调用准确率、多步规划 |
| **Context Recall（上下文召回）** | 高 | 1M+ 场景下的 needle-in-a-haystack（大海捞针）表现 |
| **Rate Limit Ceiling（速率上限）** | 高 | **（关键细节）**：提供方能否在不触发 429 错误的情况下承载你的 P99 吞吐量？ |
| **Ecosystem Maturity（生态成熟度）** | 高 | 生产落地记录、SDK 支持以及 Enterprise SLA（企业级服务等级协议） |
| **Cost / Output Token（每输出 token 成本）** | 中 | Agentic loop（代理式循环）通常消耗 5x-10x 更多 token |

---

## 能力对比

### Frontier Model Comparison（前沿模型对比，2026 年 6 月）

| 模型 | 优势 | 不足 | 上下文 | 最适用场景 |
|-------|-----------|------|---------|----------|
| **Claude Fable 5** | 面向大众发布且能力最强的模型；具备 Mythos-class（Mythos 级）能力并带有安全护栏；始终开启自适应思考；SOTA（state-of-the-art，最先进）视觉能力；支持最长的自主运行时长 | 价格是 Opus 4.8 的 2 倍（$10/$50）；在敏感话题上，少于 5% 的会话会回退到 Opus 4.8；数据保留 30 天 | 1M | 能力上限型任务：最难推理、视觉、最长时域代理 |
| **Claude Opus 4.8** | 长时运行的 agentic coding（代理式编码）（SWE-bench 88.6%）；支持并行子代理的 Dynamic Workflows（动态工作流）；$10/$50 快速模式 | GPT-5.5 在单次 SWE-bench 上略占优势；Fable 5 现在在能力上已高于它 | 1M | 代码库级迁移、自主编码循环、前沿区间内最佳性价比 |
| **GPT-5.5** | SWE-bench Verified（SWE-bench 验证版）领先（88.7%），Terminal-Bench（终端基准）领先（78.2%），原生全模态 | 成本高（$5/$30） | 1M | 多代理系统、单次编码 |
| **Claude Opus 4.7** | 前代旗舰（SWE-bench 87.6%，SWE-Bench Pro 64.3%） | 已被 4.8 以相同价格取代 | 1M | 现有 4.7 部署且无迁移压力 |
| **Claude Sonnet 4.6** | 成本与质量平衡出色，标准价格下支持完整 1M 上下文 | 尚无 Sonnet 4.8 发布 | 1M | 通用生产工作马 |
| **Gemini 3.1 Pro** | GPQA Diamond 领先（94.3%），1M 全模态，Deep Think（深度思考）模式 | Deep Think 存在延迟抖动 | 1M | 科学推理、多模态 |
| **DeepSeek-R1** | 开源推理，数学能力有竞争力 | 仅限推理；不适合非前沿通用场景 | 128K | 数学、复杂调试、开源权重推理 |

### Budget Model Comparison（预算模型对比）

| 模型 | 成本（每 1M 输入/输出） | 质量 | 上下文 | 最适用场景 |
|-------|----------------------------|---------|---------|----------|
| **Gemini 3 Flash** | $0.05 / $0.20 | 前沿级 | 1M | 高吞吐 RAG（检索增强生成） |
| **o4-mini** | $0.10 / $0.40 | 优秀 | 128K | 快速推理任务 |
| **Llama 4 8B** | 自托管（H100/L40） | 强 | 128K | 端侧、本地、私有场景 |

### Open Source Models（开源模型）

| 模型 | 参数量 | 质量 | 最适用场景 |
|-------|------------|---------|----------|
| **Llama 4 70B** | 70B | 前沿级竞争力 | 通用开源首选 |
| **Nemotron 3 Ultra** | 500B MoE | 代理式能力强 | 可扩展的开源代理 |
| **DeepSeek V3.2** | 671B MoE | 极致性能 | 用最低 TCO（总拥有成本）换取前沿质量 |

---

## 用例映射

### 按应用类型（2026 年 6 月）

| 用例 | 推荐模型 | 理由 |
|----------|-------------------|-----------|
| **能力上限研究 / 最难问题** | Claude Fable 5 | Mythos-class（Mythos 级）能力，且可广泛使用；仅将上限型任务以 $10/$50 路由给它 |
| **自主开发** | Claude Opus 4.8 搭配 Dynamic Workflows、Claude Sonnet 4.6 | Claude Code 中的并行子代理运行；SWE-Bench Pro 达到 69.2% |
| **企业级 RAG** | Gemini 3.1 Pro、Gemini 3.1 Flash、DeepSeek V4 Flash | 1M 上下文和激进的缓存折扣降低检索复杂度 |
| **客户支持** | Gemini 3.1 Flash、GPT-5.5-mini、Claude Haiku 4.5 | 近乎零延迟，同时具备较强推理能力 |
| **推理 / 调试** | GPT-5.5 reasoning、Claude Opus 4.8（thinking）、DeepSeek-R1 | 在代码与逻辑任务上，hidden-CoT（隐式链式思考）表现最佳 |
| **视频 / 多模态** | Gemini 3.1 Pro、GPT-5.5、Claude Opus 4.8 | 原生交错式多模态处理 |
| **私有代理** | Llama 4 Maverick、DeepSeek V4 Pro（开源权重） | 最强的开源权重代理式规划能力 |

### 按约束

| 约束 | 方案 |
|------------|----------|
| **最大延迟 < 100ms** | Gemini 3.1 Flash、GPT-5.5-mini、Claude Haiku 4.5，或自托管 Nano 模型 |
| **上下文 > 1M tokens** | Claude Fable 5 / Opus 4.8 / Opus 4.7 / Sonnet 4.6、Gemini 3.1 Pro、GPT-5.5、Llama 4 Scout（10M） |
| **零数据泄露** | Llama 4 70B、内部 VPC 中的 DeepSeek V4 Pro |
| **复杂工具使用** | Claude Opus 4.8 或 GPT-5.5（最佳规划准确率） |

---

## 成本分析

### 成本建模（2026 年 6 月）

| 模型 | 输入 / 1M | 输出 / 1M | 说明 |
|-------|------------|-------------|-------|
| **Claude Fable 5** | $10.00 | $50.00 | 能力上限；是 Opus 4.8 的 2 倍；仅保留给上限型任务 |
| **Claude Opus 4.8** | $5.00 | $25.00 | 前沿编码与 agentic；可选快速模式 $10 / $50 |
| **Claude Opus 4.7** | $5.00 | $25.00 | 标准价相同；快速模式更贵，为 $30 / $150 |
| **GPT-5.5** | $5.00 | $30.00 | 单次 SWE-bench 领先者 |
| **Claude Sonnet 4.6** | $3.00 | $15.00 | 平衡之选；尚未发布 Sonnet 4.8 |
| **Gemini 3.1 Pro** | $2.00 | $12.00 | 性价比最高的前沿模型；多模态 |
| **DeepSeek V4 Pro** | $0.435 | $0.87 | 75% 折扣于 5 月 22 日永久生效 |
| **Gemini 3.1 Flash** | $0.10 | $3.00 | 大规模 RAG；缓存折扣 |
| **DeepSeek V4 Flash** | $0.14 | $0.28 | 最便宜的前沿级 1M 上下文 |

### 成本对比例子

假设每月 1M 次查询，每次查询 1K 输入 token + 500 输出 token：

| 量级 | GPT-5.5 | Claude Sonnet | Gemini 3 Pro | Gemini 3 Flash |
|--------|---------|---------------|--------------|----------------|
| 10K 次查询/月 | $150 | $105 | $37.50 | $1.50 |
| 1M 次查询/月 | $15,000 | $10,500 | $3,750 | $150 |

*洞察：DeepSeek V4 Flash（$0.14 / $0.28）和 Gemini 3.1 Flash（$0.10 / $3.00）已经让 RAG 成为准商品化能力，在规模化场景下，长上下文处理比传统向量检索基础设施更便宜。*

---

## 运营考量

### 速率限制与配额

| 提供方 | 层级 | RPM | TPM |
|----------|------|-----|-----|
| OpenAI（Tier 1） | 基础版 | 500 | 30K |
| OpenAI（Tier 5） | 企业版 | 10K | 10M |
| Anthropic（Tier 1） | 基础版 | 50 | 40K |
| Anthropic（Tier 4） | 企业版 | 4K | 400K |

### 可靠性模式

```python
class ReliableModelClient:
    def __init__(self):
        self.providers = {
            "primary": OpenAIClient(),
            "fallback1": AnthropicClient(),
            "fallback2": GoogleClient()
        }
    
    async def generate(self, prompt: str) -> str:
        for name, client in self.providers.items():
            try:
                return await client.generate(prompt)
            except RateLimitError:
                continue
            except ServiceError:
                continue
        
        raise AllProvidersUnavailable()
```

### 抽象层

```python
class LLMClient:
    """Unified interface for multiple providers."""
    
    def __init__(self, config: dict):
        self.default_model = config["default_model"]
        self.clients = self._init_clients(config)
    
    async def generate(
        self,
        messages: list[dict],
        model: str = None,
        **kwargs
    ) -> str:
        model = model or self.default_model
        client = self._get_client(model)
        
        # Normalize request format
        normalized = self._normalize_request(messages, kwargs)
        
        # Call provider
        response = await client.generate(**normalized)
        
        # Normalize response
        return self._normalize_response(response)
    
    def _normalize_request(self, messages: list[dict], kwargs: dict) -> dict:
        # Handle differences between providers
        # OpenAI uses 'messages', Anthropic uses 'messages' with different format
        pass
```

---

## 多模型策略

### 模型路由

```python
class ModelRouter:
    def __init__(self):
        self.classifier = QueryClassifier()
        self.models = {
            "simple": "gpt-4o-mini",
            "complex": "claude-3.5-sonnet",
            "code": "claude-3.5-sonnet",
            "long_context": "gemini-1.5-pro",
            "reasoning": "o1-mini"
        }
    
    async def route(self, query: str, context_length: int) -> str:
        # Classify query complexity
        query_type = await self.classifier.classify(query)
        
        # Override for long context
        if context_length > 100_000:
            return self.models["long_context"]
        
        return self.models[query_type]
```

### 级联模式（2025 年优化版）

**逻辑**：不要用 70B 模型去做 1B 模型就能完成的任务。使用一个“Router（路由器）”来为置信度打分。

```python
class ModelCascade:
    """The 'Efficiency First' Pattern."""
    
    async def generate_optimized(self, query: str):
        # 1. Draft check (SLM / Classifier)
        if is_simple_intent(query):
            return await gpt4o_mini.generate(query)
            
        # 2. Main Generation (Efficient model)
        response = await claude_sonnet.generate(query)
        
        # 3. Validation / Escalate
        if needs_verification(response):
            return await o3.generate(f"Verify this: {response}")
            
        return response
```

**高阶建议**：实现“Semantic Fallback（语义回退）”，即出错时不要只是重试同一个模型，而是立即切换到更大的模型或不同提供方（OpenAI -> Anthropic），以避免相关性故障。

---

## 面试问题

### 问：在生产应用中，你如何在 GPT-4o、Claude 和 Gemini 之间做选择？

**优秀回答：**

“我的选择取决于具体需求：

**对于大多数生产负载**，我通常默认使用 Claude 3.5 Sonnet 或 GPT-4o。两者都是优秀的通用模型。Sonnet 在编码上略有优势，GPT-4o 的生态集成更好。

**对于长上下文应用**，Gemini 1.5 Pro 显然是更优选择，因为它支持 100 万到 200 万 token 的上下文。如果我需要处理整个代码库或超长文档，Gemini 就是我的首选。

**对于对成本敏感且高吞吐**的场景，选择 GPT-4o-mini 或 Claude Haiku。它们便宜 10 到 20 倍，而且能很好地处理简单直接的任务。

**我的实践方法：**
1. 先用 Sonnet 或 GPT-4o 做原型，验证用例
2. 在我的具体任务上评估，而不是只看基准测试
3. 构建抽象层，方便后续切换
4. 通过将简单请求路由到更便宜的模型来优化成本

我从不只依赖基准分数。一个在 MMLU 上排名较低的模型，可能在我的领域里反而更出色。”

### 问：什么时候该自托管，什么时候该使用 API 提供方？

**优秀回答：**

“这是控制权与运营负担之间的权衡。

**适合使用 API 的情况：**
- 月查询量低于 1M（尚未达到成本拐点）
- 需要立即使用最新模型
- 团队缺少 GPU 基础设施经验
- 工作负载波动大，难以做容量规划
- 上市时间（time-to-market）至关重要

**适合自托管的情况：**
- 数据不能离开基础设施（合规要求）
- 月查询量超过 10M（成本节省明显）
- 需要低于 100ms 的 P99 延迟
- 需要自定义模型权重或微调（fine-tuning）
- 需要对模型行为进行完全控制

**混合模式通常效果最好：**
- 对高吞吐、可预测的工作负载自托管
- 峰值流量和特定模型使用 API
- 自托管故障时以 API 作为兜底

自托管的隐性成本包括 GPU 采购、工程投入、模型更新和监控。基础设施方面通常要预留 1 到 2 名专职工程师。”

---

## 参考资料

- OpenAI API: https://platform.openai.com/
- Anthropic API: https://docs.anthropic.com/
- Google AI: https://ai.google.dev/
- LMSys Leaderboard: https://chat.lmsys.org/

---

*下一篇：[Fine-Tuning Guide（微调指南）](../03-training-and-adaptation/02-fine-tuning-strategies.md)*
