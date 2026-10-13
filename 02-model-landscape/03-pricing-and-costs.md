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
- 输出标记的成本通常是输入标记的 2-8 倍（Claude Opus 5.5、Claude Sonnet 5.5、GPT-6 Sol 和 Gemini 3.8 Flash 为 5 倍；Grok 4.7 为 3 倍；GPT-5.6 Sol 和 Terra 按标价为 6 倍；Gemini 3.5 Flash-Lite 约为 8 倍；托管 MiMo-V2.6 为 2 倍），部分开放权重托管商对两者收取相同价格（Together AI 的 Llama 3.3 70B 为 $1.04 / $1.04），因此输出密集型工作负载应先看输出价格列
- 推理标记按输出计费，最新 Claude 模型已无法完全关闭思考
- 价目表只是基础：长上下文价格跃升、缓存条款、速度层级、数据驻留和促销都会对其施加倍率

### 价目表之上的倍率（2026 年 10 月）

同一模型上 token 数相同的两次请求，价格可能相差超过 10 倍。以下维度需要显式建模：

| 维度 | 计费方式 | 当前示例 |
|-----------|--------------|------------------|
| **长上下文价格跃升** | 提示词超过阈值后，**整个请求**进入更高费率，而非仅超出部分 | OpenAI 输入超过 272K：输入和缓存为 2 倍，输出为 1.5 倍（Batch、Flex 以及 GPT-6 和 GPT-5.6 系列的 Fast 也适用）。xAI Grok 4.6/4.7 达到或超过 200K：所有 token 翻倍。Gemini 3.1 Pro Preview 超过 200K。Anthropic Claude 4.6 及之后模型在 1M 内费率不变 |
| **缓存写入 / 读取** | 写入前缀支付溢价，TTL 内重读享受折扣 | OpenAI GPT-5.6 及之后：写入 1.25 倍，读取 0.1 倍（GPT-6.1 Sol 为 0.05 倍），固定 30 分钟 TTL。Anthropic：写入 1.25 倍（5 min）或 2 倍（1 h）；读取 0.1 倍，Opus 5.5 为 0.05 倍，Fable 5.1 为 0.025 倍。Gemini：读取 0.1 倍，另按小时收取存储费 |
| **服务层级** | 等待更久可少付费，优先处理或更快速度需多付费 | OpenAI、Anthropic 和 Gemini API 的 Batch 为 0.5 倍；提供 Flex 的平台为 0.5 倍（OpenAI、Gemini API、Bedrock 的多数模型；Anthropic 无 Flex，Bedrock 上的 GPT-6 Astra 既不支持 Flex 也不支持 Priority）。OpenAI Fast（7 月 30 日由 Priority 更名）为 2 倍，GPT-5.5 为 2.5 倍；Ultrafast 为 6 倍（GPT-6 Astra 已 GA，GPT-5.6 Sol 为预览）。Gemini Priority 约 1.8 倍。Bedrock Priority 为 1.75 倍。Anthropic Opus 快速模式为 2 倍；Anthropic 已不再销售 Priority Tier |
| **数据驻留** | 固定区域处理约贵 10% | Anthropic `inference_geo: "us"` 对所有 token 类型收取 1.1 倍费用（Claude 4.6+）。OpenAI 对 2026 年 3 月 5 日起发布的模型提供驻留端点。Bedrock 和 Google Cloud 的区域 Claude。Bedrock 区域 GPT-6 Astra（$11/$55）。Mistral 欧盟推理 |
| **促销窗口** | 临时费率可能有截止日期，或仅保证一个最早结束日期 | Gemini 3.6/3.7/3.8 Flash 半价至 2026 年 12 月 31 日。GPT-5.6 Sol 为 $4/$20，仅保证“至少持续至 2026 年 11 月 21 日”。Gemini 4 Argon 公布的首发价没有截止日期 |
| **时段** | 谷时折扣 | DeepSeek 谷时为峰时的 50%；峰时仅限工作日 UTC 01:00-04:00 和 06:00-10:00，中国法定节假日除外 |
| **按分钟** | 按会话或音频时长而非 token 计费 | `gpt-live-1` 为 $0.05/min，另加后端 token；`gpt-transcribe` 为 $0.0045/min |
| **付费拒答** | 安全拦截也可能收费 | Anthropic 自 2026 年 9 月 24 日起，对 `bio`、`frontier_llm` 和 `reasoning_extraction` 类别的输出前拒答收费；其他类别仍不收费 |
| **用数据换折扣** | 允许供应商使用流量可获得更低价格 | Meta `muse-spark-1.3-contributor` 为 $0.10/$0.20，普通版为 $1.25/$4.25 |
| **运行时计量** | token 之外再按会话或沙箱时长收费 | Claude Managed Agents 每运行会话小时 $0.08（空闲免费）。OpenAI Agents API 容器每 20 分钟会话费率：small $0.03、medium $0.12、large $0.48；按分钟计费，最低 5 分钟 |

因此，请求的有效价格为：

```
effective_cost = residency_mult × tier_mult × (
      uncached_in × in_rate(prompt_size)
    + cache_write × write_rate(prompt_size)
    + cache_read  × read_rate(prompt_size)
    + (visible_output + reasoning_tokens) × out_rate(prompt_size)
)
# rate(prompt_size) jumps for the WHOLE request past the vendor's long-context threshold
```

### 用量与承诺式定价

公开标价没有自动用量折扣。折扣来自协商承诺，以下数字是企业交易的示例，并非公开条款：

| 层级 | 月支出 | 典型协商折扣 |
|------|---------------|-----------------------------|
| Standard | $0 - $5K | 0% |
| Growth | $5K - $50K | 10-20% |
| Enterprise | $50K+ | 定制协商 |

```
Standard: $2.50 / 1M input tokens
Committed (1-year): $2.00 / 1M input tokens (20% savings)
```

**容量现在与价格分开购买。** Anthropic 不再销售 Priority Tier 承诺（现有合同履行至到期），因此容量保障来自定制协议或 Bedrock Reserved 等云预留（1 或 3 个月期限）。Anthropic 自助层级（Start、Build、Scale）的月支出硬上限分别为 $500、$1,000 和 $200,000；触顶后返回 HTTP 429 和 `enforced_spend_limit_reached`，不含 `retry-after`，直到下月 1 日 UTC 00:00 才恢复。预算上限已成为可用性风险，应提前充分告警。

---

## 当前 API 定价

### 2026 年 10 月定价

> **最后核验：2026 年 10 月 1 日。** 价格会频繁变动。请始终重新核对：[OpenAI](https://developers.openai.com/api/docs/pricing)、[Anthropic](https://platform.claude.com/docs/en/about-claude/pricing)、[Google](https://ai.google.dev/gemini-api/docs/pricing)、[xAI](https://docs.x.ai/developers/models)、[DeepSeek](https://api-docs.deepseek.com/quick_start/pricing)、[Mistral](https://mistral.ai/pricing/api)。第一方条目已在该日期重新核验。标为“沿用”的条目反映 2026 年 8 月 15 日的核验结果。第三方托管价格（OpenRouter、Together AI、Fireworks）是各托管商自己的标价，因提供方而异。
>
> **2026 年 8 月 15 日至 10 月 1 日的变化：**
> - **最高价维持 $10 / $50，但长上下文规则不同。** Claude Fable 5.1（9 月 1 日）和 GPT-6 Astra（9 月 3 日）标价均为 $10 / $50，但 Astra 输入超过 272K 后整个请求按 $20 / $75 计费，而 Fable 在 1M 内费率不变。
> - **中间层价格趋同于 $2 / $10：** Claude Sonnet 5.5（9 月 28 日）、GPT-6 Sol（9 月 22 日）、GPT-6.1 Sol（9 月 29 日），以及 Gemini 4 Argon 公布的首发价。
> - **Opus 降价。** Claude Opus 5.5（9 月 22 日）从 $5 / $25 降至 $4 / $20，Anthropic 现在建议客户从它开始。
> - **价格下限降低。** GPT-6 Luna 为 $0.10 / $0.50，约为 GPT-5.6 Luna 的 $0.20 / $1.20 的一半。
> - **缓存读取费率因模型分化：** 标准为 0.1 倍，Opus 5.5 和 GPT-6.1 Sol 为 0.05 倍，Fable 5.1 为 0.025 倍（Fable 5 为 0.1 倍）。
> - **促销附带日期。** Gemini 3.6、3.7 和 3.8 Flash 在 12 月 31 日前为 $0.75 / $3.75，2027 年 1 月 1 日起为 $1.50 / $7.50。GPT-5.6 Sol 自 8 月 21 日起为 $4 / $20，仅保证至 11 月 21 日。长期工作负载按标价做预算。
> - **语音与转录改为按分钟计费**（见[语音与转录](#语音与转录-按分钟计费)）。
> - **DeepSeek 下调 Flash 价格**，9 月 10 日发布 V4.1-Flash（峰时 $0.30 / $1.20）。V4-Pro 未变，仍提供服务：原定 9 月 14 日将 V4-Pro 流量转向 V4.1-Flash 的计划已于 9 月 11 日撤回。

#### OpenAI（GPT-6 代）
| 模型 | 输入 / 1M | 输出 / 1M | 备注 |
|-------|------------|-------------|-------|
| **GPT-6 Astra** | $10.00 | $50.00 | 自 2026 年 9 月 3 日分阶段发布（先面向 Daybreak 计划），9 月 5 日前进入 API。缓存 $1.00，缓存写入 $12.50。输入超过 272K 后整个请求按 $20 / $75 计费。Batch 和 Flex 为 $5 / $25；Fast 为 $20 / $100；Ultrafast 为 $60 / $300（9 月 29 日 GA）。1.05M 上下文，128K 输出。不支持 `none` 推理强度、temperature、top_p 或 logprobs；工具调用需要 Responses API。9 月 8 日在 Bedrock GA（In-Region 和 Geo 推理为 $11 / $55）；也已在 Microsoft Foundry GA。 |
| **GPT-6.1 Sol** | $2.00 | $10.00 | 2026 年 9 月 29 日。缓存 $0.10（0.05 倍），缓存写入 $2.50；超过 272K 为 $4 / $15。默认推理强度 `medium`。在 Bedrock 上遵循 OpenAI 自己的生命周期条款。 |
| **GPT-6 Sol** | $2.00 | $10.00 | 2026 年 9 月 22 日。缓存 $0.20，缓存写入 $2.50；超过 272K 为 $4 / $15；Batch 和 Flex 为 $1 / $5。9 月 25 日在同一模型 ID 下修复了图像理解缺陷：需重跑图像评估。9 月 22 日在 Bedrock GA。 |
| **GPT-6 Luna** | $0.10 | $0.50 | 2026 年 9 月 22 日。缓存 $0.01，缓存写入 $0.125；超过 272K 为 $0.20 / $0.75；Batch 和 Flex 为 $0.05 / $0.25。9 月 25 日同样修复了图像问题。尚未公布 GPT-6 Terra。 |
| **GPT-5.6 Sol** | $4.00 促销（$5.00 标价） | $20.00 促销（$30.00 标价） | 自 2026 年 8 月 21 日促销，仅保证“至少持续至 2026 年 11 月 21 日”；按 $5 / $30 做预算。超过 272K 时促销费率为 $8 / $30。缓存 $0.40，缓存写入 $5.00。Ultrafast 处于预览。已由 GPT-6 Sol 接替。 |
| **GPT-5.6 Terra** | $2.00 | $12.00 | 超过 272K 为 $4 / $18。没有 GPT-6 后继型号；GPT-6 Sol 现在输入同价，输出更便宜。 |
| **GPT-5.6 Luna** | $0.20 | $1.20 | 超过 272K 为 $0.40 / $1.80。已由约半价的 GPT-6 Luna 接替。 |
| **GPT-5.6-Cyber** | $12.50 | $75.00 | 2026 年 8 月 10 日。缓存 $1.25。400K 上下文，无长上下文层级。仅限 Daybreak Red（身份验证、法律声明、仅支持 Responses API）。 |
| **GPT-Rosalind**（`gpt-rosalind-research`） | $5.00 | $25.00 | 生命科学推理模型，2026 年 9 月 8 日通过可信访问计划 GA。缓存 $0.50。2026 年 10 月 5 日开始计费。 |
| **GPT-5.5** | $5.00 | $30.00 | 2026 年 4 月 23 日。缓存 $0.50；超过 272K 为 $10 / $45。该模型 Fast 为 2.5 倍。 |
| **GPT-5.5 Pro / GPT-5.4 Pro** | $30.00 | $180.00 | 无缓存输入折扣；超过 272K 约为 $60 / $270。GPT-5.6 和 GPT-6 系列也可通过 `reasoning.mode: "pro"` 使用 Pro，按所选模型标准费率计费。 |
| **GPT-5.4** | $2.50 | $15.00 | 缓存 $0.25（0.1 倍；本表旧版写为 $1.25）。超过 272K 为 $5 / $22.50。 |
| **GPT-5.4-mini** | $0.75 | $4.50 | 缓存 $0.075。 |
| **GPT-5.4-nano** | $0.20 | $1.25 | 缓存 $0.02。2027 年 4 月 1 日停止服务（迁移到 GPT-6 Luna）。 |
| **GPT-4.1** | $2.00 | $8.00 | 缓存 $0.50。旧版。 |
| **GPT-4o** | $2.50 | $10.00 | 缓存 $1.25。2026 年 2 月 13 日从 ChatGPT 退役。最初的 `gpt-4o-2024-05-13` 快照于 2026 年 10 月 23 日在 OpenAI API 停服（替代：gpt-5.6-sol）。Azure Foundry 上 gpt-4o 2024-05-13 Standard 部署于 2026 年 12 月 9 日自动升级到 gpt-5.6-sol。 |
| **GPT-4o-mini** | $0.15 | $0.60 | 缓存 $0.075。旧版。 |

#### Anthropic（Claude 5.x 代）
| 模型 | 输入 / 1M | 输出 / 1M | 上下文 | 备注 |
|-------|------------|-------------|---------|-------|
| **Claude Opus 5.5** | $4.00 | $20.00 | 1M | 2026 年 9 月 22 日（`claude-opus-5-5`）在 Claude API、Bedrock、Google Cloud、Microsoft Foundry 和 Claude Platform on AWS 发布。Anthropic 建议“从这里开始”的默认选择。缓存写入 $5（5 min）/ $8（1 h）；缓存读取 $0.20（0.05 倍）；Batch $2 / $10；快速模式 $8 / $40（研究预览，仅 Claude API）。128K 输出（Batch 加 beta 请求头可达 300K）。默认推理强度 `medium`（Opus 5 默认为 `high`）；无法关闭思考。支持 ZDR。退役不早于 2027 年 9 月 22 日。 |
| **Claude Sonnet 5.5** | $2.00 | $10.00 | 1M | 2026 年 9 月 28 日（`claude-sonnet-5-5`），同样覆盖五个平台，价格与 Sonnet 5 相同。缓存写入 $2.50 / $4.00；缓存读取 $0.20；Batch $1 / $5。128K 输出。API 默认推理强度 `high`（Claude Code 和 Claude 应用中为 medium）。`thinking: {type: "disabled"}` 返回 400；最低设置为 `between_tools`。支持 ZDR。退役不早于 2027 年 9 月 28 日。 |
| **Claude Fable 5.1** | $10.00 | $50.00 | 1M | 2026 年 9 月 1 日（`claude-fable-5-1`），五个平台均已 GA。缓存读取 $0.25（0.025 倍，Fable 5 为 $1.00）；缓存写入 $12.50 / $20.00；Batch $5 / $25。128K 输出，默认推理强度 `high`。保留数据 30 天；仅在 Anthropic 明确授权时支持 ZDR（符合 Enterprise Frontier Safeguards 资格的客户，在 EFS 就绪前）。安全护栏拒答可在服务端回退（`fallbacks: "default"`，beta）到 Opus 4.8 或 Opus 5。退役不早于 2027 年 9 月 1 日。 |
| **Claude Mythos 5.1** | $10.00 | $50.00 | 1M | 与 Fable 5.1 相同的模型，护栏更宽松。文档称仅限 Project Glasswing；已公布 Life Sciences 和 Cyber Verification Program 访问计划。 |
| **Claude Haiku 4.5** | $1.00 | $5.00 | 200K | 仍是唯一 Haiku。Haiku 5.5 宣布将在“未来几周”推出，但截至 10 月 1 日尚未发布。Claude API 退役下限为“不早于 2026 年 10 月 15 日”，但尚未发出弃用通知，因此按 Anthropic 的 60 天通知政策，约 12 月前不应退役。Foundry 于 11 月 15 日退役。 |
| **Claude Opus 5** | $5.00 | $25.00 | 1M | 2026 年 7 月 24 日。旧版，仍可用。快速模式 $10 / $50。 |
| **Claude Sonnet 5** | $2.00 | $10.00 | 1M | 2026 年 6 月 30 日。旧版，仍可用。首发价于 2026 年 8 月 10 日永久化。 |
| **Claude Fable 5** | $10.00 | $50.00 | 1M | 2026 年 6 月 9 日。旧版，仍可用。缓存读取 $1.00（0.1 倍），是 Fable 5.1 的四倍。 |
| **Claude Opus 4.8** | $5.00 | $25.00 | 1M | 2026 年 5 月 28 日。旧版。快速模式 $10 / $50。 |
| **Claude Opus 4.7 / 4.6** | $5.00 | $25.00 | 1M | 旧版。不再提供快速模式（4.7 报错；4.6 按标准速度与费率运行）。 |
| **Claude Sonnet 4.6** | $3.00 | $15.00 | 1M | 旧版；Sonnet 5.5 更新且更便宜。 |
| **Claude Sonnet 4.5** | $3.00 | $15.00 | 200K | 2026 年 9 月 30 日弃用；2026 年 11 月 30 日在 Claude API 和 Foundry 退役（`claude-sonnet-4-5-20250929` 迁移到 `claude-sonnet-5-5`）。 |
| **Claude Opus 4.5** | $5.00 | $25.00 | 200K | Claude API 退役“不早于 2026 年 11 月 24 日”，但截至 10 月 1 日无通知，因此约 12 月前不应退役。Foundry 于 11 月 24 日退役。 |

> [!NOTE]
> **值得记住的 Anthropic 计费规则（2026 年 10 月）：**
> - **长上下文统一费率。** Claude 4.6 及之后模型的完整 1M 窗口按标准费率计费，快速模式溢价也不随窗口长度变化。
> - **缓存读取因模型而异：** 多数模型为 0.1 倍，Opus 5.5 为 0.05 倍，Fable 5.1 为 0.025 倍。Batch 为 50%，可叠加缓存折扣。
> - **快速模式**支持 Opus 5.5（$8 / $40，仅 Claude API 研究预览）、Opus 5 和 Opus 4.8（$10 / $50）。可叠加缓存倍率，但不支持 Batch API 或 Claude Platform on AWS。
> - **数据驻留：** Claude 4.6 及之后模型的 `inference_geo: "us"` 对输入、输出、缓存写入和缓存读取均收取 1.1 倍费用；旧模型设置此参数返回 400。
> - **拒答：** 自 2026 年 9 月 24 日起，`stop_details.category` 为 `bio`、`frontier_llm` 或 `reasoning_extraction` 的输出前拒答收费；其他类别不收费。成本看板应按类别拆分拒答支出。
> - **影响成本代码的破坏性变更：** Fable 5.1、Opus 5.5 和 Sonnet 5.5 的 `tool_choice` 为 `any` 或 `tool` 时返回 400，思考块绑定于生成它的模型和对话。Bedrock 与 Google Cloud 自行制定 Claude 退役时间。Anthropic 称自己的日期适用于 Claude API、Claude Platform on AWS 和 Foundry，但 Microsoft Foundry 的退役计划当前列出的 claude-haiku-4-5（11 月 15 日）和 claude-opus-4-5（11 月 24 日）日期，早于 Anthropic 通知政策隐含的日期；Foundry 上应按较早日期规划，并向双方确认。

#### Google（Gemini 3.x 和 4）
| 模型 | 输入 / 1M | 输出 / 1M | 上下文 | 备注 |
|-------|------------|-------------|---------|-------|
| **Gemini 3.8 Flash** | $0.75 首发（2027 年 1 月 1 日起 $1.50） | $3.75 首发（2027 年 1 月 1 日起 $7.50） | 1M（65K 输出） | 2026 年 9 月 2 日 GA。输出价格含思考 token。Batch 和 Flex 首发 $0.375 / $1.875（1 月 1 日起 $0.75 / $3.75）；Priority 首发 $1.35 / $6.75（1 月 1 日起 $2.70 / $13.50）；缓存读取首发 $0.075（1 月 1 日起 $0.15），另加存储首发每 1M token 每小时 $0.50（1 月 1 日起 $1.00）。思考级别 low、medium、high。报道指出其每任务消耗更多推理 token，抵消了部分低费率优势。 |
| **Gemini 3.7 Flash / 3.6 Flash** | $0.75 首发 | $3.75 首发 | 1M | 同样的首发价，2027 年 1 月 1 日翻倍。已由 3.8 Flash 接替。 |
| **Gemini 4 Argon** | $2.00 首发（之后 $4.00） | $10.00 首发（之后 $20.00） | 1M 输出（据 Google） | **2026 年 9 月 30 日公布，尚未普遍可用。** 先向 Fairwind Program 的网络防御人员推出；之后面向付费 API 客户和 Google AI Ultra，日期未定。截至 10 月 1 日 Gemini API 无模型 ID。缓存输入优惠 95%。首发期未公布结束日期。 |
| **Gemini 3.1 Pro Preview** | $2.00 | $12.00 | 1M | 超过 200K：$4.00 / $18.00。Gemini API 唯一 Pro 层模型；不存在 Gemini 3.5 Pro。 |
| **Gemini 3.5 Flash** | $1.50 | $9.00 | 1M | |
| **Gemini 3.5 Flash-Lite** | $0.30 | $2.50 | 1M | Google 推荐原本会使用 2.5 Flash-Lite 的新项目采用它。 |
| **Gemini 3.1 Flash-Lite** | $0.25 | $1.50 | 1M | 2027 年 5 月 7 日停服（迁移到 3.5 Flash-Lite）。 |
| **Gemini 3 Flash Preview** | $0.50 | $3.00 | 1M | 旧版列出“Gemini 3.1 Flash”为 $0.10 / $3.00；Google 定价页没有此名称与价格的模型。 |
| **Gemini 2.5 Pro** | $1.25 | $10.00 | 1M | 超过 200K：$2.50 / $15.00。仅限现有用户（见下文）。 |
| **Gemini 2.5 Flash-Lite** | $0.10 | $0.40 | 1M | 仅限现有用户。 |

Google Search grounding：Gemini 3.x 模型每月共享 5,000 次免费请求，之后每 1,000 次 $14。

> [!WARNING]
> **Gemini 2.5 生命周期：** 旧版引用的 2026 年 6 月 17 日停服日期在当时属实，但后来被推迟，再被撤回。2026 年 9 月 18 日，Google 将 Gemini API 的 Gemini 2.5 模型限制为此前使用过它们的项目，称其“未弃用”，将服务至另行通知；新项目建议使用 Gemini 3.5 Flash-Lite 或 3.8 Flash。在 Google Cloud（Vertex AI，Google 文档现在称为 Gemini Enterprise Agent Platform）上，`gemini-2.5-pro`、`gemini-2.5-flash` 和 `gemini-2.5-flash-lite` 于 **2026 年 10 月 20 日**退役。同一模型，两套生命周期。

#### xAI（Grok）
| 模型 | 输入 / 1M | 输出 / 1M | 上下文 | 备注 |
|-------|------------|-------------|---------|-------|
| **Grok 4.7** | $2.00 | $6.00 | 500K | 2026 年 9 月 21 日。缓存 $0.50。提示词达到或超过 200K 后，**请求中每个 token** 的费率均变为 $4 / $12（缓存 $1）。快速变体（2 倍速度、2 倍价格）仅在 Cursor 和 Grok Build 提供，公共 API 不提供。底座比 4.6 更大更新，但 Artificial Analysis 仅高 2 分（46 对 44）。 |
| **Grok 4.6** | $2.00 | $6.00 | 500K | 2026 年 8 月 12 日。已由同价、相同长提示词规则的 4.7 接替。 |
| **grok-4.3** | $1.25 | $2.50 | - | xAI 于 2026 年 5 月 15 日退役的文本标识（`grok-4-0709`、`grok-4-fast`、`grok-4-1-fast`、`grok-3`）的重定向目标。旧标识仍可解析，但按 grok-4.3 的费率与行为提供服务。Azure Foundry 仍将 `grok-4` 和 `grok-4-1-fast` 列为 GA。 |

#### 通过 API 提供的开放权重、挑战者与价值层模型
| 模型 | 输入 / 1M | 输出 / 1M | 上下文 | 提供方与许可证说明 |
|-------|------------|-------------|---------|----------------------------|
| **DeepSeek V4.1-Flash**（`deepseek-flash`） | $0.30 峰时 / $0.15 谷时 | $1.20 峰时 / $0.60 谷时 | 1M（384K 输出） | 2026 年 9 月 10 日起在 DeepSeek API 提供。缓存命中输入 $0.006 / $0.003。MIT 权重；552B 主干（763B 检查点），预填充激活 8B、解码激活 16B。旧 `deepseek-v4-flash` 名称按此费率路由至此。Together AI 和 Fireworks 标价同为 $0.30 / $1.20。 |
| **DeepSeek V4-Pro**（`deepseek-v4-pro`，0813 构建） | $1.32 峰时 / $0.66 谷时 | $3.96 峰时 / $1.98 谷时 | 1M | 8 月 16 日重新定价后未变。缓存命中输入 $0.044 / $0.022。DeepSeek 于 9 月 10 日宣布 9 月 14 日起将所有 V4-Pro 流量转向 V4.1-Flash，随后于 9 月 11 日撤回。V4.1-Pro 尚未发布。 |
| **Xiaomi MiMo-V2.6-Pro** | $0.435 | $0.87 | 1M | 2026 年 9 月 21 日，MIT，总参数 1.02T / 激活 42B。OpenRouter 价格。Artificial Analysis Index v4.3.2 上排名最高的开放权重模型（46）。 |
| **Xiaomi MiMo-V2.6-Flash** | $0.14 | $0.28 | 1M | 309B / 激活 15B，MIT。OpenRouter 价格；与 DeepSeek V4 Flash 在 8 月前的费率相同。 |
| **Z.ai GLM-5.3** | $1.40 | $4.40 | 1M | 缓存 $0.26。2026 年 8 月 28 日发布权重，MIT 加 Z.ai 安全审查条款：12 个月收入超过 US$10B 的模型即服务运营商需接受审查。也已在 Mistral La Plateforme GA（9 月 28 日）；GLM 5.2 将于 10 月 31 日在该平台退役。 |
| **Z.ai GLM-5.3-Flash** | $0.15 | $0.50 | 1M | 2026 年 8 月 26 日，纯 MIT，320B / 激活 18B。缓存 $0.03。 |
| **Moonshot Kimi K3** | $3.00 | $15.00 | 1M | 缓存 $0.30。定制许可证：12 个月收入超过 US$20M 的 MaaS 运营商须另行签约。Index v4.3.2 得分 44（广泛引用的 57.1 来自旧版、不可比较的指数）。 |
| **Qwen3.8-Max / -0902** | $2.00 | $6.00 | 1M | 阿里 Model Studio 国际价格，适用于 `qwen3.8-max` 及 9 月 2 日仅 API 提供的 `-0902` 快照。开放的 2.4T / 激活 95B 检查点仍是 8 月 12 日构建，12 个月收入超过 US$50M 的 MaaS 和助手产品有许可门槛：自托管者数周内就落后于 API 模型。 |
| **Qwen3.8-Flash**（托管 Flash-Next） | $0.15 | $0.47 | 1M | Qwen Cloud。开放权重（Qwen3.8-Flash-Next，Qwen4 架构预览）使用 Qwen Community License 1.0，任何 MaaS 或编码/办公助手业务均须另获许可，不论收入。 |
| **Tencent Hy4 preview** | $0.834 | $2.501 | 1M | 2026 年 8 月 28 日，Apache 2.0，770B / 激活 49B。Tencent TokenHub 标价（缓存命中 $0.042）；第三方 OpenRouter 托管商同价。 |
| **Meta Muse Spark 1.3**（闭源） | $1.25 | $4.25 | 1M | 2026 年 9 月 2 日，Meta Model API 和 Muse Code。缓存 $0.15。`muse-spark-1.3-contributor` 为 $0.10 / $0.20，因为 Meta 可以使用流量：启用前核对政策。比 1.2 更冗长，因此每 token 价格不变时每任务成本仍上涨。 |
| **StepFun Step 5 Preview**（仅 API） | $1.00 | $2.70 | 1M | 缓存命中 $0.05。截至 10 月 1 日无官方权重。Index v4.3.2 得分 44，但输出冗长：Artificial Analysis 测试集约消耗 160M 输出 token，中位数为 81M。 |
| **Mistral Medium 3.5** | $1.50 | $7.50 | 256K | 权重采用修改版 MIT，月收入超过 US$20M 的组织失去所有权利。欧盟区域推理 +10%。Medium 3.1 于 2026 年 8 月 31 日退役。 |
| **Mistral Large 3** | $0.50 | $1.50 | 256K | Mistral API、AWS Bedrock。 |
| **Microsoft MAI-Thinking-1** | 未公布 | 未公布 | 256K | 2026 年 8 月 12 日，Foundry 公共预览。总参数约 1T / 激活 35B。 |
| **MAI-Code-1.1-Flash** | $0.20 | $1.20 | 查看最新 | Microsoft，2026 年 8 月 11 日。沿用。 |
| **Inception Mercury 2.5**（扩散） | $0.20 标价（$0.04 发布促销） | $0.75 标价（$0.15 发布促销） | - | 1,107 tokens/s（供应商报告）。速度选项，非前沿质量选项。 |
| **Llama 3.3 70B** | $1.04 | $1.04 | 128K | Together AI 标价。Groq 于 2026 年 8 月 16 日对免费和开发者层停用 `llama-3.3-70b-versatile`。 |
| **Llama 4 Scout / Maverick** | 查看最新 | 查看最新 | 10M / 1M | Groq 于 2026 年 7 月 17 日对免费和开发者层退役 Scout，快速推理托管商现以 gpt-oss、Qwen、GLM 和 DeepSeek 为中心。Scout 超过 32K 后有效上下文快速衰减。 |
| **Gemma 4 / Qwen3.8-27B** | 自托管 | 自托管 | 256K / - | Apache 2.0。 |

OpenRouter 于 2026 年 9 月 22 日新增 Batch API：70+ 模型通常优惠 50%，beta 期间批次完成时间中位数为 7 分钟。这让不直接提供批处理的供应商也能享受批量折扣。

#### 语音与转录（按分钟计费）

2026 年语音不再仅按 token 计费。语音智能体成本现在是**分钟数 × 会话费率 + 后端模型 token**，因此通话时长和空闲时间与 token 同样重要。应关闭空闲会话：`gpt-live-1` 对静音和后端等待时间也收费。

| 模型 | 价格 | 备注 |
|-------|-------|-------|
| **`gpt-live-1`** | 每会话分钟 $0.05，按秒计费，另加后端模型和工具 token | 2026 年 9 月 10 日 GA。全双工；将推理和工具委派给 Responses 模型或自有后端。创建 WebRTC 会话预收 15 秒费用，会话运行后抵扣。 |
| **`gpt-realtime-2.1`** | 每 1M 音频输入 $32 / 缓存 $0.40 / 输出 $64；文本 $4 / $0.40 / $24 | 上下文增长前，每分钟来电者音频约 $0.019，智能体音频约 $0.077（推导）。每次响应重发整个对话，因此长通话每分钟更贵。 |
| **`gpt-realtime-2.1-mini`** | 每 1M 音频 $10 / $0.30 / $20；文本 $0.60 / $0.06 / $2.40 | 替代 `gpt-realtime-mini`。 |
| **`gpt-realtime-translate`** | $0.034/min | 每个目标语言一个会话。 |
| **`gpt-transcribe`** | $0.0045/min | 文件和已提交轮次。替代 `whisper-1` 和 `gpt-4o-*-transcribe` 模型，后者于 2027 年 2 月 26 日停服。 |
| **`gpt-live-transcribe`** | $0.017/min | 流式，约为批处理费率的 3.8 倍。 |
| **Gemini 3.8 Live** | 每 1M 音频输入 $3 / 输出 $12（约每分钟 $0.005 / $0.018）；文本 $0.75 / $4.50 | 2026 年 9 月 15 日 GA。Extended Thinking 变体同价。 |
| **Gemini 3.8 Flash TTS** | 每 1M 输入 $0.50 / 输出 $9，促销至 12 月 31 日；2027 年 1 月 1 日起 $1 / $18 | 2026 年 9 月 22 日 GA。Flash-Lite TTS 每 1M 音频 token $6，也在 1 月 1 日翻倍。 |
| **Gemini 3.5 Transcribe Live** | 综合约 $0.009/min | 2026 年 8 月 26 日 GA。 |
| **Microsoft MAI-Transcribe-2** | 每音频小时 $0.10（约 $0.0017/min），限时 | 2026 年 9 月 3 日发布。优惠结束后需按更高费率预算。 |
| **OpenAI TTS**（`gpt-4o-mini-tts`） | 每 1M 音频 token $12 | 8 月和 9 月未发布新 OpenAI TTS 模型。`tts-1`、`tts-1-hd` 和 `gpt-4o-mini-tts` 快照于 2027 年 1 月 6 日停服。 |
| **xAI Grok voice** | $0.08/min，另加每次文本输入 $0.004 | 语音到语音按分钟统一计费。xAI 语音转文本每小时 $0.10（REST）或 $0.20（流式）；TTS 每 1M 字符 $15。 |
| **整套语音智能体平台** | 约 $0.06-0.14/min，另加电话费用 | Telnyx 约 $0.06（供应商报告），Deepgram Voice Agent $0.075（自备 LLM 和 TTS 时 $0.05），ElevenLabs Agents $0.08（突发 $0.16），Vapi $0.05 加提供方成本（总计约 $0.08-0.13），Retell 实例约 $0.13，Bland $0.12-0.14。这是自行组装流水线必须超越的基准。 |

这些选项的架构权衡见[实时语音智能体](../18-voice-and-audio-agents/01-realtime-voice-agents.md)。

#### 嵌入模型（Embedding Models）
| 模型 | 每 1M token 成本 | 备注 |
|-------|------------------|-------|
| **Cohere embed-v5.0-pro / -fast** | $0.12 / $0.08 | 2026 年 9 月 30 日。两者共享嵌入空间，128K 输入。 |
| **voyage-4-large / voyage-4 / voyage-4-lite** | $0.12 / $0.06 / $0.02 | 2026 年 1 月 15 日。共享空间，32K 输入。 |
| **voyage-context-4, voyage-code-4** | $0.12 | voyage-code-4 报告比 voyage-code-3 提升 +27.54%（供应商报告）。 |
| **text-embedding-3-large** | $0.13 | 3072 维，8,192-token 输入。未变。 |
| **text-embedding-3-small** | $0.02 | 1536 维。沿用。 |
| **gemini-embedding-2** | $0.20（文本；Batch $0.10） | 多模态，自 2026 年 4 月起稳定；每 1M 图像 $0.45、音频 $6.50、视频 $12.00（Google 定价页）。 |
| **Cohere Embed 4** | $0.10 | Cohere 上一代；Matryoshka 维度 256 / 512 / 1024 / 1536。沿用。 |

重排模型：Voyage rerank-3 每 1M token $0.05，rerank-3-lite 为 $0.02（2026 年 9 月 30 日，32K 上下文）。

> [!IMPORTANT]
> **推理 token 就是输出 token。** 对于始终开启或自适应思考的模型（Claude Fable 5.1、Opus 5.5 和 Sonnet 5.5；没有 `none` 推理强度的 GPT-6 Astra），未出现在响应中的思考也按输出费率计费。这可能让逻辑密集任务的请求总成本增至 2x-10x。Opus 5.5 无法关闭思考，Sonnet 5.5 最低设置为 `between_tools`，因此成本控制依靠 **effort** 设置与 `max_tokens` 上限，而非思考开关。注意默认值的静默变化：Opus 5.5 默认为 `medium`（Opus 5 使用 `high`），GPT-6.1 Sol 为 `medium`，Sonnet 5.5 的 API 为 `high`。每个请求都应显式设置 effort。

### 退役与价格变动日历：2026 年 Q4 至 2027 年初

生命周期现在按**（模型，平台）**组合跟踪：同一模型在供应商 API、Bedrock、Google Cloud 和 Foundry 上的退役可能相差数月。最短通知期也不同：OpenAI 的 GA 模型为 6 个月，专用变体为 3 个月，预览最短仅 2 周（`gpt-5.4-cyber` 为 20 天）；Anthropic 为 60 天；Bedrock 自 2026 年 9 月 7 日起发布的模型有 6 个月或 45 天 Legacy 期，Legacy 期间现有客户闲置 15 天后可能失去访问；Foundry 对 Fireworks 按 token 计费模型给出 15 天。

**2026 年 8 月 15 日至 10 月 1 日已执行：** Groq 免费和开发者层的 Llama 3.3 70B 和 3.1 8B（8 月 16 日）；Anthropic Workbench 和实验性提示工具（8 月 17 日）；OpenAI 与 Azure OpenAI Assistants API（8 月 26 日，由 Responses 加 Conversations 替代）；Mistral Medium 3.1（8 月 31 日，迁移到 3.5）；OpenAI Sora 2 模型和 Videos API（9 月 24 日，无一对一替代）；`gpt-5.4-cyber`（10 月 1 日，提前 20 天通知）。

**同一窗口内已计划（未独立确认执行）：** Bedrock Claude 3 Haiku（9 月 10 日）；Bedrock Nova Premier 和 Nova Sonic v1（9 月 14 日）；Bedrock Nova Canvas 和 Nova Reel（9 月 30 日）；`gpt-3.5-turbo-instruct`、`babbage-002` 和 `davinci-002`（9 月 28 日）；API 上的 Mistral OCR 4.0（同价迁移到 OCR 4.1）和 Leanstral 1.5（9 月 30 日）；`gemini-2.5-flash-image`（10 月 2 日）。代码中若仍使用这些模型，在实际测试前都应视为已失效。

| 日期 | 类型 | 平台 | 变化 | 迁移到 |
|------|------|----------|--------------|---------|
| 2026 年 10 月 5 日 | 退役 | Gemini API | `antigravity-preview-05-2026` | `antigravity-preview-09-2026` |
| 2026 年 10 月 5 日 | 价格 | OpenAI | GPT-Rosalind 开始计费（$5 / $25） | - |
| 2026 年 10 月 8 日 | 价格 | Bedrock | Claude Opus 4.1 进入公开延长访问期，采用提供方制定的更高价格 | Claude 4.6+ |
| 2026 年 10 月 14 日 | 退役 | Bedrock | Claude Sonnet 4 EOL | Sonnet 5.5 |
| 2026 年 10 月 14 日 | 退役 | Foundry | `gpt-4.1-nano` | - |
| 2026 年 10 月 15 日 | 退役 | Foundry | `gpt-4o-transcribe`、`gpt-4o-mini-transcribe`（2025-03-20） | `gpt-transcribe` |
| 2026 年 10 月 15 日 | 仅为最早日期 | Claude API | Claude Haiku 4.5 退役下限；尚未通知，因此约 12 月前不会退役 | Haiku 5.5 发布后迁移 |
| 2026 年 10 月 20 日 | 退役 | Google Cloud | `gemini-2.5-pro`、`-flash`、`-flash-lite` | Gemini 3.8 Flash、3.5 Flash-Lite |
| 2026 年 10 月 23 日 | 退役 | OpenAI | 旧快照（4 月 22 日公布）：`gpt-4o-2024-05-13`、`gpt-4-turbo`、`gpt-4-0613`、`gpt-4-1106-preview`、`gpt-3.5-turbo-0125`、`gpt-4.1-nano`、`o1`、`o1-pro`、`o3-mini`、`o4-mini`、`gpt-image-1`。无后缀 `gpt-4` 和 `gpt-3.5-turbo` 别名也停用，GPT-3.5 Turbo、GPT-4、GPT-4.1-nano、o4-mini、`babbage-002` 和 `davinci-002` 的微调模型同样停用 | gpt-5.6-sol / terra / luna（o1-pro 通过 `reasoning.mode: "pro"`）；`gpt-image-2.5-sunburst` 或 `-flare` |
| 2026 年 10 月 31 日 | 退役 | OpenAI | Evals 平台转为只读 | Promptfoo（OpenAI 所有，MIT） |
| 2026 年 10 月 31 日 | 退役 | Mistral | Z.ai GLM 5.2 | GLM 5.3 |
| 2026 年 11 月 2 日 | 退役 | xAI | `grok-imagine-image-quality` | `grok-imagine-image-2.0` |
| 2026 年 11 月 15 日 | 退役 | Foundry | `claude-haiku-4-5`、`codex-mini` | - |
| 2026 年 11 月 19 日 | 退役 | Foundry | o1、o1-pro、o3、o3-pro、o3-deep-research；o3-mini、o4-mini | gpt-5.6-sol；gpt-5.6-terra |
| 2026 年 11 月 21 日 | 价格 | OpenAI | GPT-5.6 Sol 保证促销窗口结束（$4 / $20 可能恢复为 $5 / $30） | GPT-6 Sol |
| 2026 年 11 月 24 日 | 退役 | Foundry | `claude-opus-4-5`（Claude API 最早日期相同，尚未通知） | Opus 5.5 |
| 2026 年 11 月 26 日 | 退役 | Bedrock | AI21 Jamba 1.5 | - |
| 2026 年 11 月 30 日 | 退役 | Claude API、Foundry | `claude-sonnet-4-5-20250929` | `claude-sonnet-5-5` |
| 2026 年 11 月 30 日 | 退役 | OpenAI | Evals、Agent Builder、Reusable Prompts 关闭 | Promptfoo；Agents SDK |
| 2026 年 12 月 1 日 | 退役 | OpenAI | `gpt-image-1.5`、`gpt-image-1-mini`、`chatgpt-image-latest` | `gpt-image-2.5-sunburst` 或 `-flare` |
| 2026 年 12 月 9 日 | 自动升级 | Foundry | gpt-4o 2024-05-13 Standard 部署 | gpt-5.6-sol（无需改代码，延迟、成本和风格即改变） |
| 2026 年 12 月 11 日 | 退役 | OpenAI | `gpt-5-2025-08-07`（含 mini、nano）、`gpt-5-pro-2025-10-06`、`o3-2025-04-16`、`o3-pro-2025-06-10` | gpt-5.6-sol / terra / luna；pro 通过 `reasoning.mode: "pro"` |
| 2026 年 12 月 15 日 | 退役 | Foundry | whisper、tts、tts-hd | - |
| 2026 年 12 月 31 日 | 价格 | Gemini API | Gemini 3.6 / 3.7 / 3.8 Flash 和 3.8 Flash TTS 促销价最后一天（1 月 1 日起 2 倍） | 按标价预算 |
| 2027 年 1 月 6 日 | 退役 | OpenAI | `tts-1`、`tts-1-hd`、带日期的 `gpt-4o-mini-tts` 快照；现有客户停止创建微调任务 | `gpt-realtime-2.1-mini`；微调采用开放权重、Azure 或 Bedrock |
| 2027 年 1 月 8 日 | 退役 | Bedrock | Claude Opus 4.1 EOL | Claude 4.6+ |
| 2027 年 1 月 20 日 | 退役 | OpenAI | `gpt-realtime`、`gpt-audio`、`gpt-4o-realtime`、`gpt-4o-audio` 系列 | `gpt-realtime-2.1`、`-2.1-mini`、`gpt-audio-1.5` |
| 2027 年 2 月 26 日 | 退役 | OpenAI | `whisper-1`、`gpt-4o-transcribe`、`gpt-4o-mini-transcribe`、`gpt-4o-transcribe-diarize` | `gpt-transcribe`、`gpt-live-transcribe` |
| 2027 年 4 月 1 日 | 退役 | OpenAI | `gpt-5.1`、`gpt-5.3-codex`、`gpt-5.4-nano` | GPT-6 Sol、GPT-6 Luna |
| 2027 年 5 月 7 日 | 退役 | Gemini API | `gemini-3.1-flash-lite` | Gemini 3.5 Flash-Lite |

**同一模型，不同日期：** Claude Sonnet 4 于 2026 年 6 月 15 日在 Claude API 退役，但 Bedrock 提供至 10 月 14 日。Claude Opus 4.1 于 2026 年 8 月 5 日在 Claude API 退役，但 Bedrock 提供至 2027 年 1 月 8 日（10 月 8 日起采用更高的延长访问价格）。Grok 4 于 5 月 15 日被 xAI 退役，但 Azure Foundry 仍列为 GA。多云故障转移链可能悄然落到主平台已退役的模型，因此模型注册表需要按平台记录日期。

### 2026 年早期价格历史

保留以供参考，解释当前价格的形成过程。

- **Anthropic。** Claude Fable 5 于 6 月 9 日以 $10 / $50 发布（带护栏的 Mythos 级能力；Claude Mythos 5 是放宽护栏的同一模型，面向 Glasswing 合作方同价提供）。Claude Opus 4.8 于 5 月 28 日以 $5 / $25 发布，快速模式 $10 / $50（Opus 4.7 快速层曾为 $30 / $150）。Claude Sonnet 5 首发价 $2 / $10 于 8 月 10 日永久化，原定 9 月 1 日上调至 $3 / $15 的计划取消。Claude Sonnet 4 和 Opus 4 于 6 月 15 日、Opus 4.1 于 8 月 5 日在 Claude API 退役。
- **OpenAI。** GPT-5.5 于 4 月 23 日以 $5 / $30 发布。GPT-5.6 Sol、Terra 和 Luna 于 7 月 9 日 GA；7 月 30 日 Terra 降至 $2 / $12、Luna 降至 $0.20 / $1.20，Priority 更名 Fast。GPT-5.6-Cyber 于 8 月 10 日发布。GPT-4o、GPT-4.1、GPT-4.1-mini 和 o4-mini 于 2 月 13 日退出 ChatGPT；Realtime API Beta 于 5 月 12 日移除；Sora 应用于 4 月 26 日关闭。
- **DeepSeek。** 75% 的 V4 Pro 折扣于 5 月 22 日永久化（6 月 1 日起 $0.435 / $0.87），缓存命中输入于 4 月 26 日降至发布价的 1/10。8 月 16 日 DeepSeek 改为峰谷计费，按 token 类型将 V4 价格提至原价 3x 至 12x，结束其无争议低价选项的时期。
- **Google。** Vertex 于 3 月 26 日退役 `gemini-3-pro-preview`；Project Mariner 于 5 月 4 日关闭。Gemini 3.7 Flash 于 8 月 13 日以半价首发费率发布。
---

## 成本计算

### 基础成本公式

以下函数建模了朴素的 `tokens × rate` 计算遗漏的两点：缓存拆分和整个请求的长上下文价格跃升。

```python
# USD per 1M tokens, Standard tier, list prices as of October 1, 2026.
# lc_at = smallest prompt size that moves the WHOLE request to long-context rates.
PRICING = {
    "gpt-6-sol":         {"in": 2.00, "cached": 0.20, "out": 10.00,
                          "lc_at": 272_001, "lc_in": 4.00, "lc_cached": 0.40, "lc_out": 15.00},
    "gpt-6-luna":        {"in": 0.10, "cached": 0.01, "out": 0.50,
                          "lc_at": 272_001, "lc_in": 0.20, "lc_cached": 0.02, "lc_out": 0.75},
    "grok-4.7":          {"in": 2.00, "cached": 0.50, "out": 6.00,
                          "lc_at": 200_000, "lc_in": 4.00, "lc_cached": 1.00, "lc_out": 12.00},
    "claude-sonnet-5-5": {"in": 2.00, "cached": 0.20, "out": 10.00},  # flat to 1M
    "claude-opus-5-5":   {"in": 4.00, "cached": 0.20, "out": 20.00},  # flat to 1M
    # Gemini 3.8 Flash: budget on the January 1, 2027 list price, not the $0.75/$3.75 intro.
    # Cache reads assumed at 0.1x of input; hourly cache storage is not modeled here.
    "gemini-3.8-flash":  {"in": 1.50, "cached": 0.15, "out": 7.50},
}

def request_cost(
    model: str,
    uncached_in: int,
    output_tokens: int,          # visible output + reasoning tokens
    cached_in: int = 0,
    cache_write: int = 0,
    write_mult: float = 1.25,    # OpenAI 1.25x; Anthropic 1.25x (5 min) or 2x (1 h)
    tier_mult: float = 1.0,      # 0.5 Batch/Flex, 2.0 Fast, 6.0 OpenAI Ultrafast
    residency_mult: float = 1.0, # 1.1 for region-pinned processing
) -> float:
    p = PRICING[model]
    prompt = uncached_in + cached_in + cache_write
    long_ctx = "lc_at" in p and prompt >= p["lc_at"]

    def rate(key: str) -> float:
        return p[f"lc_{key}"] if long_ctx else p[key]

    cost = (
        uncached_in * rate("in")
        + cache_write * rate("in") * write_mult
        + cached_in * rate("cached")
        + output_tokens * rate("out")
    ) / 1_000_000
    return cost * tier_mult * residency_mult
```

**用数字看价格跃升（GPT-6 Sol，2K 输出）：** 270K-token 提示词成本为 (270,000 × $2 + 2,000 × $10) / 1M = **$0.56**。275K-token 提示词成本为 (275,000 × $4 + 2,000 × $15) / 1M = **$1.13**。多五千 token 就让账单翻倍。Claude Fable 5.1 的 900K-token 提示词和 9K 一样按每 1M $10 计费；GPT-6 Astra 的相同提示词则按每 1M $20 计费。长上下文 RAG 决策如今也部分取决于定价。

### 示例成本计算

**场景 1：RAG 聊天机器人**
```
Per request:
- System prompt: 500 tokens
- Retrieved context: 2,000 tokens
- User message: 100 tokens
- Response: 300 tokens

Input: 2,600 tokens, Output: 300 tokens

GPT-6 Sol or Claude Sonnet 5.5: (2600 × $2 + 300 × $10) / 1M = $0.0082 per request
GPT-6 Luna:                     (2600 × $0.10 + 300 × $0.50) / 1M = $0.00041 per request

At 10,000 requests/day on GPT-6 Sol:
Daily: $82
Monthly: $2,460
(GPT-6 Luna: $4.10/day, $123/month, if quality holds on your evals)
```

**场景 2：文档摘要**
```
Per document:
- Document: 8,000 tokens
- Summary: 500 tokens

GPT-6 Sol cost: (8000 × $2 + 500 × $10) / 1M = $0.021

1,000 documents: $21
10,000 documents: $210 (Batch API: $105)
```

### 月度成本预测

```python
def project_monthly_cost(
    requests_per_day: int,
    avg_input_tokens: int,
    avg_output_tokens: int,
    model: str,
    **kwargs,
) -> dict:
    per_request = request_cost(
        model, avg_input_tokens, avg_output_tokens, **kwargs
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
    model="gpt-6-sol"
)
# Output: $0.008/request, $400/day, ~$12,000/month
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
            return "gpt-6-luna"   # Simple queries: $0.10 / $0.50
        elif complexity < 0.7:
            return "gpt-6-luna"   # Medium: try cheap first
        else:
            return "gpt-6-sol"    # Complex queries: $2 / $10

    def route_with_fallback(self, query: str, context: str) -> str:
        # Try cheap model first
        response = self.try_model("gpt-6-luna", query, context)

        if self.is_quality_sufficient(response):
            return response

        # Fallback to expensive model
        return self.try_model("gpt-6-sol", query, context)
```

**潜在节省：** 在对质量影响最小的情况下可节省 50-70%。GPT-6 Luna 与 GPT-6 Sol 的输入和输出层级价差现在均为 20 倍，因此路由比一年前收益更大。

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

# Savings on GPT-6 Sol: 1,700 tokens × $2/1M = $0.0034 per request
# At 10K requests/day: $34/day = $1,020/month (before caching, which shrinks this further)
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

### 策略 4：批处理与服务层级

没有人等待结果的任务都应放到更便宜的层级：

```python
# Real-time: pay full price
for query in queries:
    response = model.generate(query)

# Batch API (50% off at OpenAI, Anthropic, Google, and via OpenRouter on 70+ models):
batch_responses = model.batch_generate(queries)
# Cost: 50% of real-time pricing, results within 24 hours

# Flex tiers (OpenAI, Gemini, Bedrock): same 0.5x on the regular API, in exchange
# for slower, lower-priority processing
```

现在的阶梯从 0.5 倍（Batch、Flex），经过 Standard，到 2 倍（OpenAI Fast、Anthropic 快速模式），再到 6 倍（OpenAI Ultrafast）。延迟 SLO 也是成本决策：为每类工作负载（交互、智能体内循环、离线）指定层级，并报告混合费率。

### 策略 5：输出长度控制

适当限制响应长度：

```python
# Reduce unnecessary output
response = model.generate(
    prompt=prompt,
    max_tokens=300,  # Limit output (on reasoning models this budget includes thinking)
    stop=["\n\n"]    # Stop at natural break
)

# Cost impact on GPT-6 Sol:
# Before: avg 500 output tokens = $0.005 per request
# After: avg 250 output tokens = $0.0025 per request
# Savings: 50% on output costs
```

### 策略 6：按提示词长度路由

让 OpenAI 提示词保持在 272K 及以下、xAI 提示词低于 200K，或将长提示词路由到统一费率模型（Claude 4.6 及之后）。在阈值附近削减几千个检索上下文 token，就能将请求成本减半；超过阈值后，压缩或 RAG 通常优于为每个 token 付 2 倍费用。

### 成本优化总结

| 策略 | 工作量 | 潜在节省 |
|----------|--------|-------------------|
| 模型路由 | 中等 | 50-70% |
| **上下文缓存** | 低 | **90-97.5%（缓存输入）** |
| 提示词优化 | 低 | 20-40% |
| 响应缓存 | 中等 | 20-40% |
| Batch / Flex 层级 | 低 | 50%（OpenAI、Anthropic、Google、OpenRouter） |
| 按提示词长度路由 | 低 | 长上下文阈值附近的请求最多节省 50% |
| 谷时调度 | 低 | 50%（DeepSeek） |

---

## 上下文缓存经济学

**规则仍成立：** 稳定前缀（系统提示、工具定义、共享语料）超过几千 token 且在 TTL 内复用，就应缓存。2026 年的变化在于缓存条款因模型而异，因此必须按模型计算。

**盈亏平衡：** 缓存一次性支付 `(write_mult - 1)` 的写入溢价，每次重读节省 `(1 - read_mult)`，因此

`break-even rereads = (write_mult - 1) / (1 - read_mult)`

| 模型 | 输入 | 缓存写入 | 缓存读取 | TTL | 盈亏平衡重读次数 |
|-------|-------|-------------|------------|-----|--------------------|
| Claude Fable 5.1 | $10.00 | $12.50（5 min）/ $20.00（1 h） | $0.25（0.025 倍） | 5 min 或 1 h | 0.26 / 1.03 |
| Claude Opus 5.5 | $4.00 | $5.00 / $8.00 | $0.20（0.05 倍） | 5 min 或 1 h | 0.26 / 1.05 |
| Claude Sonnet 5.5 | $2.00 | $2.50 / $4.00 | $0.20（0.1 倍） | 5 min 或 1 h | 0.28 / 1.11 |
| GPT-6.1 Sol | $2.00 | $2.50 | $0.10（0.05 倍） | 固定 30 min | 0.26 |
| GPT-6 Sol | $2.00 | $2.50 | $0.20（0.1 倍） | 固定 30 min | 0.28 |
| GPT-6 Astra | $10.00 | $12.50 | $1.00（0.1 倍） | 固定 30 min | 0.28 |
| Gemini 3.8 Flash | $0.75 首发 | - | $0.075 首发（2027 年 1 月 1 日起 $0.15），另加存储每 1M token 每小时 $0.50 首发（2027 年 1 月 1 日起 $1.00） | 显式缓存按存储小时计费 | 取决于存储时间 |

盈亏平衡低于 1 意味着 **TTL 内复用一次就能抵消写入费用**。Anthropic 的 1 小时写入至少需要重读两次。

**缓存如今如何改变模型选择。** 考虑一个 50 轮智能体循环，稳定前缀为 100K-token（工具定义加仓库上下文），TTL 为 5 分钟或 30 分钟，仅计算前缀：

| 模型 | 不缓存的前缀成本（50 轮） | 缓存的前缀成本（1 次写入 + 49 次读取） |
|-------|---------------------------------|-----------------------------------------|
| Claude Fable 5.1 | $50.00 | $1.25 + 49 × $0.025 = $2.48 |
| GPT-6 Astra | $50.00 | $1.25 + 49 × $0.10 = $6.15 |
| Claude Opus 5.5 | $20.00 | $0.50 + 49 × $0.02 = $1.48 |
| Claude Sonnet 5.5 | $10.00 | $0.25 + 49 × $0.02 = $1.23 |
| GPT-6.1 Sol | $10.00 | $0.25 + 49 × $0.01 = $0.74 |

有两点启示。首先，使用缓存后，前缀不再主导成本：缓存 Opus 5.5 仅比缓存 Sonnet 5.5 贵 25 美分，远低于不缓存 Sonnet，因此两者真正的成本差异在输出与推理 token。其次，相同标价掩盖不同缓存成本：Fable 5.1 和 Astra 输入标价同为 $10，但 Astra 的 0.1 倍读取费率使相同缓存前缀约贵 2.5 倍。

**生产环境中容易踩到的坑：**
- **OpenAI**（GPT-5.6 及之后）：最小可缓存提示词为 1,024 token；`prompt_cache_options.ttl` 仅接受 `"30m"`。早期 OpenAI 模型不收写入费，使用 `prompt_cache_retention`。272K 长上下文费率同样适用于缓存 token。
- **Anthropic**：Opus 5.5 最小可缓存提示词为 512 token。Fable 5.1、Opus 5.5 和 Sonnet 5.5 的思考块绑定对话前缀：修改系统提示、工具或早期消息会丢弃思考块，2026 年 8 月 31 日及之后创建的账户则返回 400。应将历史视为只追加，这也是保持缓存热度的纪律。`inline-tools-2026-09-15` beta 可在对话中途添加工具而不丢失缓存。
- **Gemini** 显式缓存按小时累积存储费用，因此写入后闲置的缓存可能花费超过节省。
- **观测。** OpenAI Prompt Cache Diagnostics 于 2026 年 9 月 8 日 GA，Anthropic 缓存诊断于 9 月 23 日 GA。将命中率作为 SLO 跟踪；提示词改写和模型升级会悄然将其归零。

OpenAI 和 Anthropic 的批处理折扣（50%）均可叠加缓存。折扣如何对应服务栈内部的 KV 复用，见 [KV 缓存与上下文缓存](../04-inference-optimization/02-kv-cache-and-context-caching.md)。

---

## 自托管与 GPU 云套利

**预留实例与无服务器方案的权衡：**

| 模型大小 | 无服务器方案（RunPod/Together） | 预留方案（Lambda/AWS） |
|------------|-----------------------------|-----------------------|
| **突发容量** | 无限（冷启动） | 固定 |
| **利用率** | 仅按计算时间付费 | 24/7 固定成本 |
| **TCO 盈亏平衡**| **利用率 < 40% 时更具成本效益** | **利用率 > 40% 时更具成本效益** |

**高阶细节：**  
“GPU Cloud Arbitrage（GPU 云套利）”是指基于**spot instance（抢占式实例）可用性**在不同提供商之间迁移生产工作负载。像 **Skypilot** 这样的工具可以自动化这一过程，通过跟随全球“低需求”区域，最多可节省 60% 的自托管成本。MoE 模型降低每 token 的活跃计算量，却不降低容纳权重所需的内存：Llama 4 Scout（总参数 109B）在 INT4 下可放入一张 H100，Maverick（总参数约 400B）需要 8x H100 节点，Xiaomi 称 MiMo-V2.6-Flash（309B / 激活 15B）可放入一个 8-GPU 节点。

**2026 年 GPU 价格与 API 价格反向变动。** 10 月 1 日 Silicon Data 指数中，B200 每 GPU 小时 $5.86（进入 9 月时年内已上涨 27.6%），H100 为 $2.77。10 月 1 日按需标价：Lambda H100 SXM $3.99、B200 $6.69；RunPod H100 $2.69（社区）/ $3.49（安全）、B200 $5.98 / $6.79、B300 $6.94 / $7.89。长期合约更便宜：9 月 7 日，12 个月 B200 均价 $5.39，3 个月为 $5.73。

### 何时适合自托管

```
API cost at scale (1M requests/month, 2,000 input + 500 output tokens each):
- Claude Opus 5.5:                $8,000 + $10,000 = $18,000/month
- Claude Sonnet 5.5 / GPT-6 Sol:  $4,000 +  $5,000 =  $9,000/month
- DeepSeek V4.1-Flash (peak):       $600 +    $600 =  $1,200/month (half off-peak)
- GPT-6 Luna:                       $200 +    $250 =    $450/month
- MiMo-V2.6-Flash (OpenRouter):     $280 +    $140 =    $420/month

Self-hosted MiMo-V2.6-Flash (309B / 15B active, MIT) on one 8x H100 node:
- GPU: 8 × $2.77/GPU-hr (index) × 730 = $16,177/month
       (8 × $3.99 Lambda on-demand = $23,302/month)
- Engineering time: $5,000/month (0.5 FTE)
- Ops overhead: $2,000/month
- Total: ~$23,200 to $30,300/month, before N+1 redundancy
```

在此规模下，自托管比**每个** API 条目都贵，包括 Opus。旧经验法则（“每月约 500K 请求以上就自托管”）假设只有前沿 API；面对 $0.10 / $0.50 的闭源层和 $0.14 / $0.28 的托管开放权重，它已不成立。盈亏平衡现在取决于利用率：节点必须替代每月约 $23K 的 API 支出。按这种请求形状，对比 Sonnet 5.5 或 GPT-6 Sol 约需每月 2.6M 请求，而对比 GPT-6 Luna 约需 51M 请求（约 128B token，即全天候每秒约 49K token）。相信任何一个数字前，都应在目标模型上测量自己的吞吐量。

### 自托管成本组成

| 组成项 | 月度成本 | 说明 |
|-----------|--------------|-------|
| GPU 计算 | $5K-50K | 一个 8x H100 节点为 $16K-23K；HA 使其翻倍 |
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
| 405B 稠密（INT4），如 Llama 3.1 405B | 8x H100 | $16,000-23,000 |
| ~300B MoE，激活 ~15B（MiMo-V2.6-Flash） | 1x 8-GPU 节点 | $16,000-23,000（H100） |
| ~1T MoE，激活 ~42B（MiMo-V2.6-Pro） | 2x 8-GPU 节点（Xiaomi 的 SGLang 配方采用 16 路张量并行） | $32,000-47,000（H100） |

H100 条目假设每 GPU 小时 $2.77-3.99。极端量化改变了小模型端：Ternary Bonsai 2 27B 以每权重 1.72 bits 将 Qwen3.8-27B 底座压至 5.95 GB（Apache 2.0），但需要 PrismML 的推理分支。

### 决策框架

```
Choose API when:
- Volume cannot keep a GPU node busy around the clock
- No ML ops expertise
- Need highest quality (frontier models)
- Fast iteration needed

Choose self-hosting when:
- Sustained volume saturates nodes (price it against a ROUTED API bill)
- Have ML infrastructure team
- Data privacy or residency requirements an API cannot meet
- Predictable, stable workload
- Custom fine-tuning needed (OpenAI ends new fine-tuning jobs Jan 6, 2027)

Before either, check the license:
- MIT / Apache 2.0: MiMo-V2.6, GLM-5.3-Flash, DeepSeek V4.1-Flash, Hy4 preview, Qwen3.8-27B
- Gated: GLM-5.3 (security review for MaaS above US$10B revenue), Kimi K3 (deal for MaaS
  above US$20M revenue), Qwen3.8-Max (MaaS/assistant above US$50M), Qwen Community 1.0
  (any MaaS or coding/office-assistant business), Mistral Medium 3.5 (no rights above
  US$20M monthly revenue)
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

**场景：客服机器人（每月 50K 请求，Claude Sonnet 5.5 每请求 3,000 输入 + 400 输出 token）**

| 成本组成 | 基于 API | 自托管 |
|----------------|-----------|-------------|
| LLM 成本 | $500 | $2,000（一张 H100） |
| 向量数据库 | $70 | $200 |
| 工程（每月） | $500 | $3,000 |
| 监控 | $100 | $200 |
| **月度合计** | **$1,170** | **$5,400** |

*在这个规模下，API 便宜很多。*

**场景：大规模 RAG（每月 2M 请求，每请求 4,000 输入 + 500 输出 token）**

| 成本组成 | API（全部中间层） | API（路由：70% GPT-6 Luna，30% GPT-6 Sol） | 自托管（一个 8x H100 节点） |
|----------------|--------------------|---------------------------------------------|--------------------------------|
| LLM 成本 | $26,000 | $8,710 | $16,200 |
| 向量数据库 | $500 | $500 | $1,000 |
| 工程（每月） | $1,000 | $1,500 | $8,000 |
| 监控 | $200 | $200 | $500 |
| **月度合计** | **$27,700** | **$10,910** | **$25,700** |

*自托管仅比朴素的全部中间层 API 账单便宜，且尚未加上用于冗余的第二个节点。路由后的 API 账单比它低两倍以上。每月 2M 请求时，应为控制权、数据驻留、许可或微调权重而自托管，而非为成本。*

---

## 面试题

### 问：你会如何为高流量 RAG 应用优化成本？

**优秀答案：**  
我会分层进行成本优化：

**1. 架构优化：**
- 模型路由：简单查询使用低成本模型
- 缓存：稳定前缀使用提供方前缀缓存，另加精确与语义响应缓存（30%-40% 的查询可能可缓存）
- 提示词压缩：尽量减少 system prompt 的 token 数，并让提示词低于长上下文阈值（OpenAI 为 272K）

**2. 模型选择：**
```
Request shape: 2,600 input + 300 output tokens
Simple queries (60%): GPT-6 Luna at $0.00041/request
Complex queries (40%): GPT-6 Sol at $0.0082/request
Weighted avg: $0.0035/request (vs $0.0082 all GPT-6 Sol)
Savings: 57%
```

**3. 基础设施：**
- embedding 刷新与离线评估使用 Batch 或 Flex（便宜 50%）
- 向量数据库按需配型
- 尽可能使用 spot instance（抢占式实例）

**4. 监控：**
- 按查询类型及任务跟踪成本，而不仅是每 token 成本
- 将缓存命中率作为 SLO 跟踪
- 对异常情况告警，并在支出上限导致流量硬停前告警

### 问：你会在什么情况下推荐自托管而不是使用 API？

**优秀答案：**  
决策取决于多个因素：

**看利用率，而非请求数：**
- 一个 GPU 节点无论忙闲每月都花 $16K-23K，因此问题在于持续流量能否替代这么多 API 支出
- 对比中间层 API（$2 / $10），每月几百万请求就能达到；对比 GPT-6 Luna（$0.10 / $0.50），则需要数千万
- 应对比路由后的 API 账单，绝不拿前沿标价来比

**团队能力：**
- 没有 ML ops：无论规模都用 API
- 基础设施团队强：可更早考虑自托管

**质量与许可：**
- 需要绝对最佳效果：API（前沿模型）
- 足够好即可：检查许可后使用自托管开放模型（Kimi K3、GLM-5.3、Qwen 和 Mistral Medium 3.5 都有商业门槛）

**其他因素：**
- 数据隐私：可能强制要求自托管，但支持 ZDR 的 API（Opus 5.5、Sonnet 5.5）已覆盖许多情况
- 延迟控制：自托管可提供更多控制
- 微调需求：OpenAI 于 2027 年 1 月 6 日停止现有客户创建新微调任务，推动定制转向开放权重

**我的推荐流程：**
1. 先从 API 开始，以便最快迭代
2. 构建模型切换抽象层
3. 当某个稳定工作负载的 API 支出接近两个节点成本（一个节点加冗余）时评估自托管
4. 在最终定案前先做影子部署试点

### 问：明年的成本模型使用今天的每 token 价格，会算错什么？

**优秀答案：**
每 token 标价是模型中最不稳定的输入。我会检查八件事：

1. **促销到期。** Gemini 3.8 Flash 于 2027 年 1 月 1 日翻倍至 $1.50 / $7.50，GPT-5.6 Sol 的 $4 / $20 仅保证至 2026 年 11 月 21 日。按标价预算，将促销视为额外收益。
2. **长上下文价格跃升。** OpenAI 提示词只要超过 272K 一个 token，整个请求就按约 2 倍输入和 1.5 倍输出收费。xAI 界线为 200K。应建模提示词长度分布，而非均值。
3. **缓存倍率因模型而异。** 读取为 0.1 倍、0.05 倍或 0.025 倍，OpenAI TTL 固定为 30 分钟。即使标价相同，换模型也会改变缓存成本。
4. **速度层级。** 产品若要求更低延迟，Fast 为 2 倍，Ultrafast 为 6 倍。为每类工作负载显式指定层级。
5. **数据驻留。** Anthropic、OpenAI、Bedrock、Google Cloud 和 Mistral 的固定区域处理约为 1.1 倍。仅对需要的租户应用此倍率。
6. **每任务 token，而非每调用 token。** 不同模型的每任务 token 可相差数倍（Artificial Analysis 测得 GPT-6 Astra 每编码任务约使用 GPT-5.6 Sol 三分之一的 token，Step 5 Preview 的输出约为中位数两倍）。思考 token 按输出收费。
7. **非 token 计量。** 按分钟语音计费、托管智能体会话小时、沙箱分钟，以及 Anthropic 某些安全类别中的付费拒答。
8. **强制迁移。** 退役会把流量移向价格与默认值不同的新模型（10 月 23 日旧 GPT-4、GPT-3.5、o1 和 o4-mini 快照，11 月 30 日 Sonnet 4.5，12 月 11 日 GPT-5 和 o3 快照，以及 2027 年初音频栈），Foundry 从 gpt-4o 自动升级到 gpt-5.6-sol 等操作无需改代码就会改变成本。

交付物应是按（模型，平台）维护价格时间表、为日历中每个日期提供场景的模型，而非一个混合费率。

---

## 参考资料

- OpenAI Pricing: https://developers.openai.com/api/docs/pricing
- OpenAI 弃用： https://developers.openai.com/api/docs/deprecations
- OpenAI 提示词缓存： https://developers.openai.com/api/docs/guides/prompt-caching
- Anthropic Pricing: https://platform.claude.com/docs/en/about-claude/pricing
- Anthropic 模型弃用： https://platform.claude.com/docs/en/about-claude/model-deprecations
- Google AI Pricing: https://ai.google.dev/gemini-api/docs/pricing
- xAI Pricing: https://docs.x.ai/developers/models
- DeepSeek 定价： https://api-docs.deepseek.com/quick_start/pricing
- Mistral 定价： https://mistral.ai/pricing/api
- Amazon Bedrock 模型生命周期： https://docs.aws.amazon.com/bedrock/latest/userguide/model-lifecycle.html
- Microsoft Foundry 模型退役计划： https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/model-retirement-schedule
- Lambda Labs GPU Pricing: https://lambdalabs.com/service/gpu-cloud
- RunPod Pricing: https://www.runpod.io/pricing
- LLM Pricing Comparison: https://pricepertoken.com/

---

*上一篇：[能力评估](02-capability-assessment.md) | 下一篇：[模型选择指南](04-model-selection-guide.md)*
