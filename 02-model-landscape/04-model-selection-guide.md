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

### 决策树（2026 年 10 月）

```mermaid
flowchart TD
    A["新工作负载"] --> B{"你的评估是否表明 Opus 5.5<br/>在 high 强度下仍不足？"}
    B -- 是 --> C["能力上限：<br/>Claude Fable 5.1 或 GPT-6 Astra<br/>$10 / $50"]
    B -- 否 --> D{"必须使用开放权重<br/>或在自有 VPC 内运行？"}
    D -- 是 --> E["GLM-5.3-Flash、MiMo-V2.6、Hy4 preview<br/>（检查许可门槛）"]
    D -- 否 --> F{"智能体式编码或<br/>长时程智能体？"}
    F -- 是 --> G["Claude Opus 5.5 为 $4 / $20；<br/>集群用 Sonnet 5.5 或 GPT-6.1 Sol，$2 / $10"]
    F -- 否 --> H{"提示词经常<br/>超过 272K token？"}
    H -- 是 --> I["Claude 4.6+（1M 内统一费率），<br/>或压缩 / RAG"]
    H -- 否 --> J{"高吞吐，<br/>成本优先？"}
    J -- 是 --> K["GPT-6 Luna $0.10 / $0.50；<br/>Gemini 3.8 Flash（按 $1.50 / $7.50 预算）"]
    J -- 否 --> L["默认：Claude Sonnet 5.5<br/>或 GPT-6 Sol / GPT-6.1 Sol"]
```

2026 年 9 月有两件事改变了这棵树。Anthropic 现在建议客户从 **Opus 5.5** 开始，其价格为 Fable 5.1 的 40%，且在 Anthropic 自己发布表中的智能体与编码基准上胜过后者（供应商报告），因此最高能力层是升级路径，而非起点。$2 / $10 中间层（Sonnet 5.5、GPT-6 Sol、GPT-6.1 Sol）在供应商报告的智能体评估中已足够接近旗舰，多数智能体流量可能无需 Opus 级定价；迁移集群前应先在自己的任务上确认。

### 关键选型因素

| 因素 | 权重 | 考量 |
|--------|--------|----------------|
| **Agentic Reliability（代理式可靠性）** | 高 | 工具调用准确率、多步规划、二元任务完成率 |
| **每任务成本** | 高 | 每任务 token × 价格，而非每 token 价格。智能体循环消耗 5x-10x 更多 token，不同模型每任务 token 相差数倍 |
| **上下文召回与定价** | 高 | 1M 时的召回，以及供应商是否有长上下文价格跃升（OpenAI 超过 272K，xAI 达到 200K） |
| **Rate Limit Ceiling（速率上限）** | 高 | **（关键细节）**：提供方能否在不触发 429 错误的情况下承载你的 P99 吞吐量，月支出上限是否会硬停流量？ |
| **数据处理** | 高 | ZDR 可用性（Opus 5.5 和 Sonnet 5.5 支持；Fable 5.1 仅明确授权时支持；OpenAI Agents API 不支持），以及约 10% 的驻留溢价 |
| **Ecosystem Maturity（生态成熟度）** | 高 | 生产落地记录、SDK 支持以及 Enterprise SLA（企业级服务等级协议） |
| **生命周期余量** | 中 | 按平台的最早退役日期与通知期（Opus 5.5、Sonnet 5.5、Fable 5.1：不早于 2027 年 9 月） |

---

## 能力对比

### 前沿模型对比（2026 年 10 月）

以下分数标明了来源。“AA”指 Artificial Analysis Intelligence Index v4.3.2（Claude 条目为“带回退”）；旧版指数不可比较。

| 模型 | 优势 | 不足 | 上下文 | 最适用场景 |
|-------|-----------|------|---------|----------|
| **Claude Opus 5.5**（$4 / $20） | Anthropic 推荐默认。AA 58，最高分。在 Anthropic 发布表的每一项胜过 Fable 5.1，多数项目胜过 GPT-6 Astra（Terminal-Bench 4.0 在 xhigh 下为 66.4%，对方 57.9%），但 Astra 在 AutomationBench（41.4% 对 40.0%）和 Terminal-Bench-Science（64.6% 对 58.7%）领先；均为供应商报告。Sonnet 5.5 后来报告更高 Terminal-Bench 分数。缓存读取 0.05 倍；支持 ZDR | 默认推理强度降至 `medium`；无法关闭思考；强制 `tool_choice` 返回 400；宣传分数包含护栏回退到 Opus 4.8 或 Opus 5 | 1M / 128K 输出 | 智能体式编码、计算机使用、困难生产任务 |
| **Claude Sonnet 5.5**（$2 / $10） | Anthropic 智能体评估中与 Opus 5.5 相差几分（供应商报告 Terminal-Bench 4.0 70.6%、OSWorld 2.1 部分得分 80.1%）。AA 56。支持 ZDR | 供应商数字尚未独立复现；`thinking: disabled` 返回 400；思考块绑定生成账户 | 1M / 128K | 智能体集群、规模化编码、默认聊天 |
| **Claude Fable 5.1**（$10 / $50） | Anthropic 能力上限。1M 内统一 $10 / $50，缓存读取 0.025 倍。Terminal-Bench 4.0 榜单 57.88%（max） | Opus 5.5 在 Anthropic 自己的表中以 40% 的价格胜出；AA 53；保留数据 30 天，ZDR 仅限获授权 | 1M / 128K | Opus 5.5 提高推理强度后仍无法通过自身评估的任务 |
| **GPT-6 Astra**（$10 / $50） | OpenAI 能力上限。Terminal-Bench 4.0 榜单第一（58.18%，max）。每编码任务约消耗 GPT-5.6 Sol 三分之一的 token（AA）。AA 53 | 超过 272K 整个请求为 $20 / $75；无 temperature、top_p、logprobs 或 `none` 强度；首个网络安全评级为 Critical 的 OpenAI 模型，因此 Daybreak 外漏洞利用工作受限 | 1.05M / 128K | OpenAI 栈的最高能力任务；token 效率可抵消价格的长编码任务 |
| **GPT-6.1 Sol**（$2 / $10） | AA 52。缓存读取 0.05 倍。Codex CLI 默认 | 9 月 29 日发布，仅比 GPT-6 Sol 晚一周，独立评估较少；272K 价格跃升；默认强度 `medium` | 1.05M / 128K | OpenAI 侧编码与专业工作默认 |
| **GPT-6 Sol / GPT-6 Luna**（$2 / $10；$0.10 / $0.50） | GPT-5.6 的半价；Luna 重设 OpenAI 价格下限 | 图像理解曾退化，9 月 25 日在相同 ID 下修复；无 Terra 层 | 1.05M / 128K | Sol：通用生产。Luna：路由、分类、抽取 |
| **Gemini 3.8 Flash**（首发 $0.75 / $3.75；2027 年 1 月 1 日起 $1.50 / $7.50） | DeepSWE v1.1 以 74% 与 GPT-6 Astra、Opus 5 并列，每任务成本最低（$2.36）。Google 推荐用于 Gemini 计算机使用（预览）的模型 | 1 月 1 日价格翻倍；每任务推理 token 更多；AA 41；输出上限 65,536-token | 1M / 65K | 编码智能体每任务成本领先；高吞吐 RAG |
| **Grok 4.7**（$2 / $6） | $2 输入模型中输出最便宜；更大更新的底座 | 整个请求在 200K 翻倍；AA 46，仅比 4.6 高 2 分；快速变体仅在 Cursor 和 Grok Build | 500K | 低于 200K 的输出密集工作 |
| **Muse Spark 1.3**（$1.25 / $4.25） | AA 48，$1.25 / $4.25 远低于 $2 / $10 层 | 比 1.2 更冗长，每任务成本上升；contributor 层用数据换低价 | 1M | 检查每任务成本后的价格敏感通用工作 |

**已被接替但仍提供服务：** Claude Opus 5、Sonnet 5、Fable 5 和 Opus 4.8；GPT-5.6 Sol、Terra 和 Luna；GPT-5.5。Claude Sonnet 4.5 于 2026 年 11 月 30 日退役。

**已公布，未发布（截至 2026 年 10 月 1 日）：** Google **Gemini 4 Argon**（9 月 30 日公布）先向 Fairwind Program 网络防御人员推出，之后面向付费 API 和 AI Ultra，日期未定。首发价 $2 / $10（之后 $4 / $20），Google 称输出增至 1M token，AA 对发布前 high 强度运行评分 53。发布前，Gemini 3.1 Pro Preview 是 Google 唯一 Pro 层 API 模型。**Claude Haiku 5.5** 宣布将在“未来几周”推出。

### Budget Model Comparison（预算模型对比）

| 模型 | 成本（每 1M 输入/输出） | 质量信号 | 上下文 | 最适用场景 |
|-------|----------------------------|----------------|---------|----------|
| **GPT-6 Luna** | $0.10 / $0.50 | 以半价接替 GPT-5.6 Luna | 1.05M | 路由、分类、抽取 |
| **Gemini 3.8 Flash** | 首发 $0.75 / $3.75；2027 年 1 月 1 日起 $1.50 / $7.50 | DeepSWE v1.1 74%（三方并列） | 1M | 编码智能体、RAG |
| **DeepSeek V4.1-Flash** | 峰时 $0.30 / $1.20；谷时半价 | AA 39 | 1M | 谷时批处理（周末全为谷时） |
| **GLM-5.3-Flash** | $0.15 / $0.50 | AA 42 | 1M | MIT 权重：API 或自托管使用相同模型 |
| **MiMo-V2.6-Flash** | $0.14 / $0.28（OpenRouter） | - | 1M | MIT，309B / 激活 15B；API 无法满足时可放入一个 8-GPU 节点 |
| **Claude Haiku 4.5** | $1.00 / $5.00 | 目前唯一 Haiku | 200K | Anthropic 栈快速层；规划 Haiku 5.5 和 Foundry 11 月 15 日退役 |

### 开放权重模型

| 模型 | 参数量 | 许可证 | AA v4.3.2 | 最适用场景 |
|-------|------------|---------|-----------|----------|
| **Xiaomi MiMo-V2.6-Pro** | 1.02T / 激活 42B | MIT | 46 | 顶级开放模型；两个 8-GPU 节点 |
| **Z.ai GLM-5.3** | 744B / 激活 40B | MIT 加收入超过 US$10B 的 MaaS 运营商安全审查 | 45 | 智能体式编码 |
| **Moonshot Kimi K3** | 2.8T / 激活 104B | 定制：收入超过 US$20M 的 MaaS 需另行签约 | 44 | 许可适合时的强大通用模型 |
| **Z.ai GLM-5.3-Flash** | 320B / 激活 18B | MIT | 42 | 智能体式编码默认自托管候选 |
| **Qwen3.8-Flash-Next** | 125B / 激活 6B + 51B N-gram 内存 | Qwen Community 1.0（任何 MaaS 或编码/办公助手业务需另获许可） | 40 | Qwen4 架构预览；主机 RAM 参数内存 |
| **DeepSeek V4.1-Flash** | 552B（763B 检查点）；激活 8B / 16B | MIT | 39 | 廉价 1M 上下文服务 |
| **Tencent Hy4 preview** | 770B / 激活 49B | Apache 2.0 | - | 接近前沿规模中最清晰的许可证 |
| **Qwen3.8-27B** | 27B 稠密 | Apache 2.0 | 34 | 单 GPU 级别 |
| **Inkling-Small** | ~266B / 激活 12B | Apache 2.0 | 26 | 美国排名最高的开放权重模型 |
| **NVIDIA Nemotron 3 Ultra** | 550B / 激活 55B | OpenMDW-1.1 | 23 | NVIDIA 栈开放智能体 |

先检查许可，再看基准。多个领先开放模型现有针对模型即服务转售商的收入门槛商业条款，Mistral Medium 3.5 权重对月收入超过 US$20M 的组织撤销所有权利。Llama 4 仅发布 Scout（总参数 109B）和 Maverick（总参数约 400B）；不存在 Llama 4 8B、70B 或 405B。

---

## 用例映射

### 按应用类型（2026 年 10 月）

| 用例 | 推荐模型 | 理由 |
|----------|-------------------|-----------|
| **能力上限研究 / 最难问题** | Claude Fable 5.1、GPT-6 Astra | 仅在 Opus 5.5 提高强度后仍无法通过自身评估时升级；Fable 在 1M 内统一费率，Astra 超过 272K 翻倍 |
| **自主开发** | Claude Opus 5.5、Claude Sonnet 5.5、GPT-6.1 Sol；重视每任务成本时用 Gemini 3.8 Flash | Opus 5.5 在 Anthropic 发布表每项胜过 Fable 5.1、编码项目胜过 Astra（Astra 在 AutomationBench 和 Terminal-Bench-Science 领先），Sonnet 5.5 报告与其相差几分（均为供应商报告）；Sonnet 5.5 和 GPT-6.1 Sol 以 $2 / $10 服务集群 |
| **企业级 RAG** | Claude Sonnet 5.5、Gemini 3.8 Flash，抽取用 GPT-6 Luna | Claude 统一 1M 费率；Flash 用于高吞吐；OpenAI 提示词保持低于 272K |
| **客户支持** | GPT-6 Luna、Gemini 3.8 Flash（low 思考）、Claude Haiku 4.5 | 低延迟低成本；困难工单升级中间层 |
| **推理 / 调试** | Claude Opus 5.5（high 或 xhigh 强度）、GPT-6 Astra、Claude Fable 5.1 | effort 是调节旋钮；仅在评估证明有收益时为 max 付费 |
| **计算机使用** | Claude Opus 5.5、Gemini 3.8 Flash、GPT-6 Astra | OSWorld 2.0 榜单（v2.1 全集）：Opus 5 在 max 强度下二元得分 44.33%。供应商报告部分得分：Opus 5.5 81.8%、Astra 72.6%（彼此或与二元得分均不可比较） |
| **语音智能体** | `gpt-live-1`、Gemini 3.8 Live、`gpt-realtime-2.1` | 按分钟与按 token 计费模型不同；见[实时语音智能体](../18-voice-and-audio-agents/01-realtime-voice-agents.md) |
| **视频 / 多模态** | 视频和音频用 Gemini 3.8 Flash；图像密集工作用 GPT-6 Sol 或 Claude Opus 5.5 | Gemini 原生接受文本、图像、视频、音频和 PDF 输入；GPT-6 Sol 和当前 Claude 模型接受文本与图像，不接受音频或视频 |
| **私有代理** | GLM-5.3-Flash、MiMo-V2.6、Hy4 preview（开放权重） | 最强的宽松许可智能体模型 |

### 按约束

| 约束 | 方案 |
|------------|----------|
| **延迟关键** | 速度层级（OpenAI Fast 2 倍、Ultrafast 6 倍；Anthropic Opus 快速模式）、小模型（GPT-6 Luna、Gemini 3.8 Flash low 思考、Claude Haiku 4.5）、扩散模型（Mercury 2.5，供应商报告 1,107 tokens/s）或自托管小模型 |
| **提示词 > 272K token** | Claude 4.6 及之后（1M 内统一费率）、Gemini 3.8 Flash；OpenAI 和 xAI 整个请求重新定价，但 GPT-6 Luna 长上下文费率 $0.20 / $0.75 仍便宜。Llama 4 Scout 的 10M 窗口超过 32K 后快速衰减 |
| **零数据泄露** | 自有 VPC 内自托管 GLM-5.3-Flash、MiMo-V2.6 或 Hy4 preview，或符合 ZDR 资格的 API（Claude Opus 5.5、Sonnet 5.5） |
| **复杂工具使用** | Claude Opus 5.5 或 GPT-6.1 Sol。最新 Claude 模型使用 `auto` 加严格工具 Schema；强制 `tool_choice` 返回 400 |
| **长期受监管工作负载** | 公布最早退役日期的模型（Opus 5.5、Sonnet 5.5、Fable 5.1 不早于 2027 年 9 月；Bedrock 上 GPT-6 Astra 不早于 2027 年 9 月 8 日） |

---

## 成本分析

### 成本建模（2026 年 10 月）

| 模型 | 输入 / 1M | 输出 / 1M | 说明 |
|-------|------------|-------------|-------|
| **Claude Fable 5.1** | $10.00 | $50.00 | 1M 内统一费率；缓存读取 $0.25 |
| **GPT-6 Astra** | $10.00 | $50.00 | 超过 272K 整个请求 $20 / $75 |
| **Claude Opus 5.5** | $4.00 | $20.00 | Anthropic 默认；缓存读取 $0.20 |
| **GPT-5.6 Sol** | $4.00 促销（$5.00 标价） | $20.00 促销（$30.00 标价） | 促销仅保证至 2026 年 11 月 21 日 |
| **Claude Sonnet 5.5** | $2.00 | $10.00 | 与 Sonnet 5 同价 |
| **GPT-6.1 Sol / GPT-6 Sol** | $2.00 | $10.00 | 超过 272K 为 $4 / $15；6.1 缓存为 0.05 倍 |
| **Gemini 3.1 Pro Preview** | $2.00 | $12.00 | 超过 200K 为 $4 / $18 |
| **Grok 4.7** | $2.00 | $6.00 | 提示词达到或超过 200K 时，每个 token 均按 $4 / $12 |
| **Muse Spark 1.3** | $1.25 | $4.25 | 注意每任务 token |
| **Gemini 3.8 Flash** | 首发 $0.75，2027 年 1 月 1 日起 $1.50 | 首发 $3.75，2027 年 1 月 1 日起 $7.50 | 任何长期任务都应使用 2027 年数字 |
| **DeepSeek V4.1-Flash** | 峰时 $0.30 | 峰时 $1.20 | 谷时半价 |
| **GPT-6 Luna** | $0.10 | $0.50 | 大规模工作负载层级 |

完整价目表、缓存条款和退役日历见[定价与成本](03-pricing-and-costs.md)。

### 成本对比例子

假设每次查询 1K 输入 token + 500 输出 token，Standard 层，无缓存：

| 量级 | GPT-6 Astra | Claude Opus 5.5 | Sonnet 5.5 / GPT-6 Sol | Gemini 3.8 Flash（首发 / 标价） | GPT-6 Luna |
|--------|-------------|-----------------|------------------------|---------------------------------|------------|
| 10K 次查询/月 | $350 | $140 | $70 | $26.25 / $52.50 | $3.50 |
| 1M 次查询/月 | $35,000 | $14,000 | $7,000 | $2,625 / $5,250 | $350 |

*洞察：每 token 表夸大了价差。DeepSWE v1.1 上三者以 74% 并列，每任务成本 Gemini 3.8 Flash 为 $2.36，GPT-6 Astra 为 $4.43，Claude Opus 5 为 $11.84。Flash（首发价）与 Astra 的 13 倍标价差，因每任务 token 不同，变成了每任务 1.9 倍。应给任务定价，而非 token。*

---

## 运营考量

### 速率限制与配额

| 提供方 | 层级 | 限额示例 | 备注 |
|----------|------|----------------|-------|
| Anthropic | Start / Build / Scale | 月支出上限 $500 / $1,000 / $200,000。Scale：Opus 5.5 和 Sonnet 5.5 为 10,000 RPM、10M ITPM、2M OTPM；Fable 5.x 为 4,000 RPM、4M ITPM、800K OTPM | 触顶返回 429 `enforced_spend_limit_reached`，无 `retry-after`，直到下月 1 日 UTC 00:00。缓存读取不计入 ITPM |
| OpenAI | Tier 1-5 | 按模型。GPT-6 Astra Ultrafast：500K TPM（tier 1-3）、1M（tier 4）、5M（tier 5）。`gpt-live-1`：25 至 500 个并发会话 | 9 月 2 日起，流量增长过快返回 429 `slow_down`；过载返回 503，两者均可带 `Retry-After` |
| Amazon Bedrock | 服务配额 | GPT-6 Astra 输出 token 按 10 倍消耗 TPM 配额 | Legacy 模型禁止新客户，现有客户闲置 15 天后可能失去访问 |

准确数字请查组织限额页面；它们会随层级和模型变化。

### 可靠性模式

```python
class ReliableModelClient:
    def __init__(self):
        self.providers = {
            "primary": AnthropicClient(model="claude-sonnet-5-5"),
            "fallback1": OpenAIClient(model="gpt-6-sol"),
            "fallback2": GoogleClient(model="gemini-3.8-flash"),
        }

    async def generate(self, prompt: str) -> str:
        for name, client in self.providers.items():
            try:
                return await client.generate(prompt)
            except RateLimitError as e:
                if e.code == "enforced_spend_limit_reached":
                    alert_finops(name)      # hard monthly cap: retrying will not help
                elif e.code == "slow_down":
                    await ramp_down(name)   # traffic grew too fast; back off this provider
                continue
            except ServiceError:            # includes 503 overload
                continue

        raise AllProvidersUnavailable()
```

**回退必须跨供应商。** Anthropic 在 2026 年 8 月 16 日至 9 月 29 日间至少发生 12 次重大或严重事故，OpenAI 于 9 月 29 日在 API、ChatGPT 和 Codex 范围发生约 5 小时 20 分钟故障。同供应商回退共享故障。

**对话中途在 Claude 模型间故障转移需谨慎。** Fable 5.1、Opus 5.5 和 Sonnet 5.5 的思考块绑定生成模型和对话前缀。回退模型会静默丢弃无法读取的块，2026 年 8 月 31 日及之后创建的账户若改写思考块之前任何内容会返回 400。只追加地重放历史，不要在回退途中编辑。

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
        normalized = self._normalize_request(model, messages, kwargs)
        
        # Call provider
        response = await client.generate(**normalized)
        
        # Normalize response
        return self._normalize_response(response)
    
    def _normalize_request(self, model: str, messages: list[dict], kwargs: dict) -> dict:
        # Handle differences between providers and model generations:
        # - Newest Claude models and GPT-6 Astra reject temperature/top_p: drop them
        # - Claude Fable 5.1 / Opus 5.5 / Sonnet 5.5 return 400 on forced tool_choice
        #   ("any" or "tool"): send "auto" plus strict tool schemas instead
        # - GPT-6 Astra tool calling requires the Responses API
        # - Set reasoning effort explicitly; defaults change between versions
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
            "simple": "gpt-6-luna",
            "complex": "claude-sonnet-5-5",
            "code": "claude-opus-5-5",
            "long_context": "claude-sonnet-5-5",  # flat price to 1M
            "reasoning": "gpt-6.1-sol"
        }
    
    async def route(self, query: str, context_length: int) -> str:
        # Classify query complexity
        query_type = await self.classifier.classify(query)
        
        # Override for long context: avoid whole-request repricing
        # above 272K on OpenAI (and at 200K on xAI)
        if context_length > 272_000:
            return self.models["long_context"]
        
        return self.models[query_type]
```

### 级联模式

**逻辑**：不要用 70B 模型去做 1B 模型就能完成的任务。使用一个“Router（路由器）”来为置信度打分。

```python
class ModelCascade:
    """The 'Efficiency First' Pattern."""
    
    async def generate_optimized(self, query: str):
        # 1. Draft check (SLM / Classifier)
        if is_simple_intent(query):
            return await gpt_6_luna.generate(query)
            
        # 2. Main Generation (Efficient model)
        response = await claude_sonnet_5_5.generate(query)
        
        # 3. Validation / Escalate
        if needs_verification(response):
            return await claude_opus_5_5.generate(
                f"Verify this: {response}", effort="high"
            )
            
        return response
```

**高阶建议**：实现“Semantic Fallback（语义回退）”，即出错时不要只是重试同一个模型，而是立即切换到更大的模型或不同提供方（OpenAI -> Anthropic），以避免相关性故障。

---

## 面试问题

### 问：在生产应用中，你如何在 OpenAI、Anthropic 和 Google 模型之间做选择？

**强答案：**

“我的选择取决于具体需求：

**对大多数生产工作负载**，我从 Claude Sonnet 5.5 或 GPT-6 Sol / GPT-6.1 Sol 开始，均为 $2 / $10。智能体式编码会测试 Claude Opus 5.5，$4 / $20，Anthropic 现在推荐它为默认。只有评估证明需要最高能力的任务才路由到 Claude Fable 5.1 或 GPT-6 Astra（$10 / $50）。

**对长上下文应用**，定价与窗口大小同样重要。Claude 4.6 及之后在 1M 内统一费率，OpenAI 超过 272K、xAI 达到 200K 则对整个请求重新定价。廉价模型受价格跃升影响较小：GPT-6 Luna 长上下文费率（$0.20 / $0.75）仍比 Gemini 3.8 Flash 首发价 $0.75 / $3.75 便宜，且 Flash 于 2027 年 1 月 1 日翻倍。信任任何一个模型前，都应在自己的文档上检查深层召回。

**对成本敏感的高吞吐场景**，选 GPT-6 Luna（$0.10 / $0.50）或 Gemini 3.8 Flash，按每任务而非每 token 成本比较。

**我的实际做法：**
1. 用中间层模型做原型，验证用例
2. 在自己的具体任务上，以将要上线的推理强度评估
3. 构建带跨供应商回退的抽象层，方便切换
4. 将简单请求路由到更便宜模型，优化成本
5. 按（模型，平台）组合跟踪退役日期

我从不只依赖基准分数。供应商宣传数字反映其最佳测试框架和推理强度；榜单排名较低的模型可能在我的领域更好。”

### 问：什么时候该自托管，什么时候该使用 API 提供方？

**强答案：**

“这是控制权与运维负担的权衡。

**以下情况使用 API：**
- 流量无法让 GPU 节点全天繁忙（8x H100 节点每月 $16K-23K；对比 GPT-6 Luna，每月需数千万请求才盈亏平衡）
- 需要立即使用最新模型
- 团队缺乏 GPU 基础设施经验
- 工作负载可变，难以做容量规划
- 上市时间至关重要

**以下情况自托管：**
- 数据不能离开基础设施（合规），且无适合的 ZDR 或驻留选项
- 持续流量能饱和节点，按路由后 API 账单而非前沿标价比较
- 需要 P99 延迟低于 100ms
- 需要定制模型权重或微调（OpenAI 于 2027 年 1 月 6 日停止现有客户创建新微调任务）
- 需要完全控制模型行为与版本，没有静默替换或强制退役

**先检查许可：** MIT 和 Apache 2.0 选项（GLM-5.3-Flash、MiMo-V2.6、DeepSeek V4.1-Flash、Hy4 preview）清晰；Kimi K3、GLM-5.3、Qwen 社区许可证和 Mistral Medium 3.5 有商业门槛。

**混合方案往往最好：**
- 可预测的高吞吐工作负载自托管
- 突发流量与专用模型使用 API
- 自托管失败时以 API 回退

自托管隐性成本包括 GPU 采购、工程时间、模型更新和监控。应计入 1-2 名专职基础设施工程师。”

### 问：模型版本现在每周发布，如何保持选型及时又不破坏生产？

**强答案：**

“Anthropic 在 Sonnet 5 发布三个月后用 Sonnet 5.5 接替它，OpenAI 在 GPT-6 Sol 一周后发布 GPT-6.1 Sol。我将模型升级视为常设流水线，而非一次项目：

1. **固定精确模型 ID，再验证实际服务内容。** 固定 ID 必要但不足：DeepSeek 把退役的 `deepseek-v4-flash` 名称路由到 V4.1-Flash，xAI 退役的 Grok 标识按 grok-4.3 费率计费，Azure Foundry 甚至于 2026 年 12 月 9 日将带日期的 gpt-4o 2024-05-13 自动升级到 gpt-5.6-sol。我记录每个响应报告的模型，并在变化时告警。
2. **比较 API 契约，而不只是质量。** Opus 5.5 将默认强度从 high 改为 medium；Sonnet 5.5 拒绝 `thinking: disabled`；最新 Claude 模型拒绝强制 `tool_choice`；GPT-6 Astra 移除 temperature 和 logprobs。每一项都可能破坏代码或改变延迟，而基准中不会出现质量回归。
3. **每个变更都必须通过自身评估集，以生产推理强度运行**，包括供应商在 ID 未变时修复的问题。OpenAI 于 9 月 25 日在不更名的情况下修复 GPT-6 Sol 图像理解，并要求客户重跑图像评估。
4. **先影子流量，再金丝雀发布**，比较每任务成本、延迟、拒答率（Anthropic 部分拒答现在收费）与升级率，而不只看质量分。
5. **维护按（模型，平台）的退役日期注册表**，提前 90、60、30 天告警。通知期从 60 天（Anthropic）、6 个月（OpenAI GA）到预览仅 2 周，OpenAI `gpt-5.4-cyber` 仅 20 天不等。

成本是一小笔长期评估与迁移预算。否则就会从事故中发现变更。”

---

## 参考资料

- OpenAI API: https://developers.openai.com/api/docs
- Anthropic API: https://platform.claude.com/docs
- Anthropic 模型概览： https://platform.claude.com/docs/en/models/overview
- Google AI: https://ai.google.dev/
- Artificial Analysis: https://artificialanalysis.ai/
- Arena（前身为 LMArena）： https://arena.ai/
- Terminal-Bench 榜单： https://www.tbench.ai/

---

*上一篇：[定价与成本](03-pricing-and-costs.md) | 下一篇：[Fine-Tuning Guide（微调指南）](../03-training-and-adaptation/02-fine-tuning-strategies.md)*
