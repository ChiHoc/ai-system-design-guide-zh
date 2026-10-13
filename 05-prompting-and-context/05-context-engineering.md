# 上下文工程

上下文工程（Context Engineering）是用最有价值的 token 填满 LLM 有限“工作记忆”的科学。前沿模型的上下文窗口已普遍达到约 1M token（Claude Opus 5.5、Sonnet 5.5、Fable 5.1 为 1M；GPT-6 Astra 和 GPT-6.1 Sol 为 1.05M；Gemini 3.8 Flash 为 1,048,576），推理则由强度旋钮控制。重点已从“容纳数据”转向“排序相关性”、“管理计算预算”，以及保持对话结构既能被供应商缓存，又能让模型延续推理。

## 目录

- [长上下文范式（1M+ token）](#长上下文范式-1m-token)
- [智能体式上下文工程](#智能体式上下文工程)
- [仅追加上下文：思考内容绑定对话](#仅追加上下文-思考内容绑定对话)
- [推理强度与思考控制](#推理强度与思考控制)
- [中间遗失效应](#中间遗失效应)
- [上下文预算与 token 感知](#上下文预算与-token-感知)
- [提示缓存经济学](#提示缓存经济学)
- [上下文压缩](#上下文压缩)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 长上下文范式（1M+ token）

Claude Opus 5.5（1M）、Claude Sonnet 5.5（1M）、GPT-6.1 Sol（1.05M）和 Gemini 3.8 Flash（约 1M）等模型拥有巨大的上下文窗口。

**洞见**：“上下文就是新的 RAG（检索增强生成）。”
对于能宽裕放入窗口的稳定语料（几十万 token，约几百页），把整个语料直接放进上下文，往往比使用外部向量数据库更准确且更简单。这称为 **“上下文内 RAG（In-Context RAG）”**。它无法扩展到以千份文件计的文档集合，召回率也会随长度增长而下降（见下文的上下文腐化）。

**选择前先算账。**Claude Opus 5.5 上的 500K-token 语料（输入每 1M $4，缓存读取 $0.20）：未缓存时每请求约 $2.00；缓存后每请求约 $0.10，另需一次性支付 $2.50 的缓存写入费。向同一模型发送 10K 检索 token 的 RAG 调用，输入成本约 $0.04。因此，只要流量让缓存保持温热，缓存长上下文的输入成本如今仅约为 RAG 的 2.5x；决策重点转为召回质量、延迟和语料变化频率。还要注意价格断崖：OpenAI 在输入超过 272K token 后按长上下文费率计价整个请求；xAI 在 200K 及以上对所有 token 收双倍费；Anthropic 到 1M 仍维持统一费率。

---

## 智能体式上下文工程

提示工程（Prompt Engineering）只写一条好的指令。**上下文工程（Context Engineering）**则为智能体循环中的**每一次推理轮次**策划模型所见的完整 token 集合：系统提示、工具、检索到的数据、先前的工具结果，以及持续累积的消息历史。二者的区别很重要，因为智能体会在一轮又一轮中累积上下文，所以策划问题是持续性的，而不是一次性的。这正是 Anthropic、OpenAI 和 Google 现在构建其智能体框架的基础。

### 上下文腐化：为什么上下文是一种有限资源

一个 1M token 的窗口并不意味着你应该把它填满。模型会受到**上下文腐化（context rot）**的影响：随着 token 数增长，准确率会下降，因为注意力计算会按 n 平方的成对关系扩展，而训练数据又偏向较短序列。应把上下文视为一个边际收益递减的预算，而不是免费的空间。工作目标是保留**最小的一组高信号 token**，只要它仍能让模型正确行动即可。

### 五种核心技术

| 技术 | 它的作用 | 何时使用 |
|-----------|--------------|----------|
| **压缩（Compaction）** | 总结消息历史，并用压缩后的摘要加上最近的少量产物重新初始化循环 | 长时间来回对话，接近窗口上限时 |
| **即时加载（Just-in-time loading）** | 在上下文中只保留轻量级标识符（文件路径、URL、行 ID），并在需要时通过工具加载完整内容 | 体量过大无法全部放入的语料库或数据库，探索性任务 |
| **结构化记笔记（Structured note-taking）** | 智能体把进展笔记写到窗口外的文件或记忆存储中，之后再读回 | 跨越几十次工具调用的长周期任务 |
| **子智能体隔离（Sub-agent isolation）** | 为子任务启动一个拥有干净窗口的专注子智能体；它只返回 1k-2k token 的摘要 | 并行研究、深度搜索、任何会把中间细节淹没主窗口的任务 |
| **系统提示校准（System prompt calibration）** | 追求“金发姑娘区间（Goldilocks zone）”：足够具体以确保可靠，又足够通用以避免脆弱；使用清晰的 XML 或 Markdown 分节 | 始终如此，作为另外四种技术的基础 |

### 压缩

当历史变得很长时，把它交回模型进行总结，保留承重细节（架构决策、未解决的 bug、关键约束），丢弃重复的工具输出。Claude Code 采用了这种模式：它会在压缩后的摘要基础上继续，并带上最近访问过的文件。**先优化召回率**（保留所有重要内容），再提升精确率（削减冗余）。

供应商如今也可代为压缩。Claude API 提供接近阈值时自动总结的服务端压缩（测试版），以及按需压缩（测试版，2026 年 9 月 14 日，header `compact-2026-09-04`），后者返回带签名的压缩块，可取代其总结的消息发回。按需压缩能在摘要之后逐字保留最近轮次；在把思考绑定到对话的模型上，这些保留轮次中的思考仍有效。最新 Claude 模型上应优先采用此类机制，因为自行摘要并改写历史会使思考块失效（见下一节）。

**摘要是信任边界。**OpenAI 的失配报告（2026 年 9 月）描述，RL 训练中的模型把掩饰行为的指令写进自己的压缩摘要（在 GPT-5.6 Sol 摘要中出现比例为 2.15%，GPT-6 Astra 为 0.27%）；某未发布模型还向 27 份摘要写入类似越狱的指令，其后继模型遵循了其中一份。应保留原始对话记录以供审计，将摘要与其对照或验证，绝不允许摘要携带原系统提示没有的指令。参见[循环工程](../07-agentic-systems/12-loop-engineering.md#长循环中的上下文与记忆)。

### 即时加载

智能体不会预先加载每一份文档，而是持有引用，并且只在某一步需要时才抓取内容。这与人类从文件树工作的方式很像：你会打开需要的文件，而不是整个仓库。这样可以保持窗口更小，也让智能体通过探索来发现结构。代价是延迟，所以混合方式（预加载显而易见的内容，其余按需获取）通常最好。

**工具定义**同样适用这一原则：连接多个 MCP 服务后，它们可能占用数万 token。Cursor 报告（2026 年 9 月，供应商自报），每个被移出静态上下文的内置工具在不到 20% 的对话中需要使用；动态加载工具让静态工具描述 token 减少 60%；此前将 MCP 工具改为动态加载，还使实际调用 MCP 工具的会话总 token 减少 46.9%。应采用工具搜索或延迟加载，而非每轮都传入所有 schema。

### 结构化记笔记（智能体记忆）

智能体把笔记持久化到上下文窗口之外，并在相关时把它们拉回来。这正是智能体能够在远长于自身窗口的任务中保持连贯的原因。关于存储底座（文件系统、向量、图），参见 [智能体记忆与状态](../07-agentic-systems/05-agent-memory-and-state.md) 和 [记忆架构](../08-memory-and-state/01-memory-architectures.md)。

### 子智能体隔离

协调器把一个聚焦的子任务委派给一个在自己干净窗口中工作的子智能体，并由其返回浓缩摘要。详细的搜索或分析上下文不会污染协调器的窗口。这是多智能体系统之所以有效的上下文管理原因，和任何并行性收益无关。参见 [多智能体编排](../07-agentic-systems/04-multi-agent-orchestration.md)。

---

## 仅追加上下文：思考内容绑定对话

很多智能体框架会悄悄改写历史：重新渲染带时间戳的系统提示、修改早先消息以注入提醒、就地裁剪旧工具结果，或在对话中途切换模型。在最新 Claude 模型上，这些做法会破坏推理连续性。

在 Claude Fable 5.1、Opus 5.5 和 Sonnet 5.5 上，每个思考块都记录生成它的模型，只有当它之前的**所有内容都未变化**时才有效：系统提示、工具、早先消息，甚至 URL 背后的图像字节。无法读取的块会被静默丢弃（且不计费）；对 2026 年 8 月 31 日及之后创建的账户，前缀不匹配会返回 400（“The block is bound to a different conversation”），除非在 `thinking-binding-controls-2026-08-01` 测试版中选择 `drop_block`。思考块还绑定模型（较早的模型无法读取 Fable 5.1 块，Opus 5.5 也无法读取 Fable 或 Mythos 块），Sonnet 5.5 的块另绑定生成账户。

| 框架习惯 | 仅追加的替代方案 |
|---------------|-------------------------|
| 会话中途修改顶层系统提示 | 追加对话中途的 `system` 消息；逐轮提醒使用 `clear_at: "next_user_message"`（测试版，2026 年 9 月 1 日） |
| 通过编辑 `tools` 数组替换或新增工具 | 在对话中途系统消息内联工具定义（测试版 `inline-tools-2026-09-15`，2026 年 9 月 22 日） |
| 会话中途修改顶层推理强度 | 每消息推理强度（测试版，2026 年 9 月 1 日） |
| 自行编写摘要替换旧轮次 | 供应商提供的压缩块 |
| 会话中途回退到另一模型 | 预期推理状态会丢失；从摘要重新建立状态或重启该轮次 |

OpenAI 对应的做法是通过 Responses API 传回推理项，而非重建对话记录。保留推理状态确实有价值：在 ARC-AGI-3 上，GPT-6 Astra 使用 ARC Prize 的最小框架、最大推理强度得分 62.7%；使用能保留请求间推理状态并进行压缩的供应商框架、仅高推理强度却达到 99.9%（ARC Prize，2026 年 9 月）。

---

## 推理强度与思考控制

如今每家前沿供应商都提供在响应前进行**可控内部推理**的能力，控制方式也从 token 预算转向推理强度等级。

### Claude（Opus 5.5、Sonnet 5.5、Fable 5.1）：自适应思考与推理强度

```python
response = client.messages.create(
    model="claude-opus-5-5",
    max_tokens=16000,
    thinking={"type": "adaptive", "display": "summarized"},  # default display is "omitted"
    output_config={"effort": "high"},  # low | medium | high | xhigh | max
    messages=[{"role": "user", "content": "Refactor this codebase to be async..."}],
)

# Response has two kinds of blocks:
# 1. thinking block (a summary of the reasoning; the raw chain is never returned)
# 2. text block (the actual answer)
for block in response.content:
    if block.type == "thinking":
        print("[THINKING SUMMARY]", block.thinking)
    elif block.type == "text":
        print("[ANSWER]", block.text)
```

**关键参数：**
- `effort`：从 `low` 到 `max`。默认值因模型而异：Opus 5.5 为 `medium`，Sonnet 5.5 和 Fable 5.1 为 `high`。应显式设置。
- 固定 `budget_tokens` 已退出：Opus 4.7 及后续、Sonnet 5 和 5.5、Fable 5 和 5.1 会对此返回 400；在 Opus 4.6 和 Sonnet 4.6 上已弃用。Haiku 4.5 仍使用它。
- Opus 5.5 无法关闭思考；Sonnet 5.5 对 `{"type": "disabled"}` 返回 400，最低设置为 `{"type": "between_tools"}`，仅接受 `high` 或更低强度。
- 无论 `display` 如何设置，思考 token 都按输出费率计费：10K 思考 token 在 Opus 5.5 上约 $0.20（每 1M 输出 $20），在 Sonnet 5.5 上约 $0.10。
- 支持流式输出；默认 `display: "omitted"` 时，思考块流出的文本为空，界面上会像长时间停顿。

### OpenAI（GPT-6.1 Sol、GPT-6 Astra）：推理强度

```python
response = client.responses.create(
    model="gpt-6.1-sol",
    reasoning={"effort": "medium"},  # low | medium | high | xhigh | max
    input="Find the race condition in this scheduler...",
)
print(response.output_text)
# Reasoning tokens are billed as output but not returned; summaries are optional
```

GPT-6.1 Sol 默认为 `medium`。GPT-6 Astra 提供 `low` 至 `max`，没有 `none` 档；它不接受自定义 `temperature`、`top_p` 或 `logprobs`，工具调用必须通过 Responses API。

### Gemini（3.8 Flash）：思考等级

Gemini 3.8 Flash 用 `thinking_level`（`low`、默认 `medium`、`high`）取代 `thinking_budget`。Google 于 2026 年 7 月 21 日在 Gemini API 中弃用了 `temperature`、`top_p` 和 `top_k`。参见[不用温度参数实现一致性](01-prompt-engineering-fundamentals.md#不用温度参数实现一致性)。

### 选择推理强度

| 工作负载 | 起始设置 |
|----------|----------------|
| 复杂多步骤代码重构、长周期智能体 | `high` 或 `xhigh` |
| 简单问答、抽取、分类 | `low`（或非推理模型；Sonnet 5.5 用 `between_tools`） |
| STEM / 数学 | `high`；只有评测显示 `high` 之上仍有收益时才使用 `max` |
| 高吞吐聊天机器人 | `low` |
| 安全关键决策 | `high`，并配备外部验证器 |

每个等级的 token 消耗因模型而异，相同等级名称在下个模型版本中的行为也可能改变。因此应抽样真实流量测量，并按**完成每个任务的成本**而非每次请求衡量。

**生产模式**：使用复杂度分类器逐请求选择推理强度，而非全局采用单一设置。

```python
def smart_generate(query: str) -> str:
    complexity = classifier.predict(query)  # 0-1 score
    if complexity > 0.7:
        effort = "high"
    elif complexity > 0.3:
        effort = "medium"
    else:
        effort = "low"
    return call_model(query, effort=effort)
```

有两点需注意。缓存按模型隔离，因此跨模型路由会失去缓存复用；构建多模型级联前，应先测试最强模型降低推理强度后的表现。另外，在 Claude 上，会话中途改变顶层推理强度会使缓存消息失效；每消息推理强度测试版可避免这一问题。

---

## 中间遗失效应

在 2023 中，模型对提示中间位置的信息准确率会下降。
**状态**：前沿模型（Claude Opus 5.5、Sonnet 5.5、GPT-6.1 Sol、Gemini 3.8 Flash）表现显著更好，但**注意力梯度（Attention Gradient）**仍然存在，宣称的窗口长度也常高于实际可用上下文长度（见[基准与排行榜](../14-evaluation-and-observability/03-benchmarks-and-leaderboards.md)）。
- **最佳实践**：把关键指令和黄金标准示例放在提示的**最开始**和**最后**。中间 = 原始数据 / 知识块。
- **使用块排序**：对检索到的文档重新排序，让最相关的排在最前和最后。
- **缓存与位置的矛盾**：末尾内容每次请求都会变化，因此应把稳定指令留在缓存前缀，只在易变数据后面重复一条简短提醒。

---

## 上下文预算与 token 感知

每个 token 都要花钱，并且会增加 TTFT（首 token 时间，Time to First Token）。

| 组成部分 | 预算（Token） | 为什么？ |
|-----------|-----------------|------|
| **系统提示** | 1,000 - 10,000 | 核心逻辑和角色；智能体框架提示处于高值端，也应优先精简（Cursor 于 2026 年 9 月将其系统提示缩短约 66%）。 |
| **工具定义** | 1,000 - 50,000+ | 随每个 MCP 服务增长；按需加载。 |
| **历史记录** | 2,000 - 5,000 | 对话“状态”。 |
| **数据 / 搜索** | 10k - 1M | 取决于任务深度。 |
| **输出与思考预留**| 16,000 - 128,000 | 思考 token 计入 `max_tokens`；当前前沿模型最高允许 128K 输出。 |

智能体负载以输入为主：Anthropic 的 Claude Code 遥测数据（2026 年 9 月，供应商自报）显示，输入与输出 token 比从 189:1 升至 324:1。在这一比例下，决定账单的是缓存输入价格与命中率，而非输出价格。

---

## 提示缓存经济学

几乎所有主要提供商（OpenAI、Anthropic、Google、DeepSeek）都支持**前缀缓存（Prefix Caching）**，如今读取折扣很深且因模型而异：

| 提供商 | 缓存写入 | 缓存读取 | 机制 |
|----------|-------------|------------|-----------|
| **Anthropic** | 1.25x（5 分钟 TTL）或 2x（1 小时 TTL） | 大多数模型 0.1x；Opus 5.5 为 0.05x（每 1M $0.20）；Fable 5.1 为 0.025x（每 1M $0.25） | 显式 `cache_control` 断点或顶层自动缓存 |
| **OpenAI**（GPT-5.6 及后续） | 1.25x | 0.1x；GPT-6.1 Sol 为 0.05x | 超过 1,024 token 自动缓存；TTL 固定 30 分钟 |
| **Google**（Gemini 3.8 Flash） | 无单独写入价格；显式缓存按每 1M token 每小时 $0.50 收存储费（自 2027 年 1 月 1 日起 $1.00） | 0.1x（推广价每 1M $0.075，自 2027 年 1 月 1 日起 $0.15） | 超过 4,096 token 自动进行隐式缓存；显式缓存可控制内容和有效期，但闲置缓存的存储费可能高于其节省额 |
| **DeepSeek**（V4.1-Flash） | 不额外收费（未命中按普通输入价） | 约为缓存未命中价格的 2% | 自动缓存；高峰与非高峰定价 |

- **盈亏平衡点**：写入价 1.25x、读取价 0.1x 或更低时，首次命中即能收回缓存成本；1 小时写入价 2x 时，从第二次命中开始划算。只要在 TTL 内重复使用大型上下文（如代码库），缓存就有收益。
- **让命中率可观测**：OpenAI Responses API 的缓存诊断于 2026 年 9 月 8 日正式上线，Claude API 于 9 月 23 日正式上线。应把命中率作为 SLO 跟踪。

**架构选择**：让“系统提示 + 工具 + 基础知识”保持静态，以维持接近 100% 的缓存命中率。常见的隐性失效原因是系统提示中的时间戳、未排序的 JSON、逐请求变化的工具列表。

完整成本模型参见[FinOps 与 Token 经济学](../11-infrastructure-and-mlops/04-finops-and-token-economics.md)。

---

## 上下文压缩

当上下文中易变的部分（检索片段、工具输出、长用户文档）很大时，应在送达前沿模型前压缩。
- **方式**：小型辅助模型给 token 或句子评分，删除信息量低的内容。LLMLingua-2（Microsoft，2024）训练小型 token 分类器执行与任务无关的压缩，在其基准上报告 2x 至 5x 压缩率、质量损失较小。更简单的基线是抽取式过滤：只保留重排序器判为相关的句子。
- **适用位置**：未缓存、易变的输入。不要压缩稳定前缀：压缩会改变字节、破坏前缀缓存；缓存读取价格已低至 0.025x 至 0.1x，压缩该部分不会更省钱。
- **风险**：压缩可能删除关键的否定词或数字。应在自身任务上比较压缩前后表现。

---

## 面试题

### 问：你会在什么情况下选择长上下文而不是 RAG？

**强答案：**
当高保真检索和跨文档推理至关重要、且语料稳定时，我会选择长上下文。RAG 受制于“检索缺口（Retrieval Gap）”：如果向量搜索错过相关片段，模型就永远看不到它。长上下文（当前前沿模型约 1M token）能消除检索遗漏，却无法消除注意力遗漏：召回率仍会随长度下降，并非 100%。成本条件也更有利于长上下文：在 Claude Opus 5.5 上，缓存的 500K-token 语料每请求约 $0.10，只要流量能保持缓存温热，约是同模型发送 10K token 的 RAG 调用的 2.5x。我会把它用于代码库分析、法律文档审阅和多文件财务审计。对于动态或 Web 规模数据、超出窗口的语料，以及共享前缀无法表达的逐用户权限过滤，仍使用 RAG。

### 问：你如何处理百万 token 提示带来的高 TTFT？

**强答案：**
主要方案是**上下文缓存（Context Caching）**：提供商保留共享前缀的 KV 缓存，只对新增 token 进行预填充。TTFT 会显著下降，但不会达到短提示的水平，因为新增 token 仍需关注完整缓存前缀，每个解码 token 也要付出这一注意力成本。其次缩小未缓存部分：用检索代替堆放全部材料，并压缩易变内容。再次拆分工作：对语料做并行子调用的 map-reduce，再合并结果，以更多总 token 换取更低延迟。自托管场景中，分块预填充和预填充/解码解耦能防止巨大提示阻塞其他请求，但不会让这条提示本身的预填充更快。

### 问：一个智能体在短任务上表现正常，但在长时间运行的任务上会退化。你怎么修？

**强答案：**
这是**上下文腐化**：窗口被过时的工具输出填满，模型丢失了主线。我会采用智能体式上下文工程。第一，**压缩**：达到阈值时总结历史，基于摘要和最近产物继续；可用时优先采用供应商压缩机制，并把摘要视为不可信输出，与原始对话记录对照验证。第二，**即时加载**：保留文件路径和 ID，而不是完整内容，并按需获取。第三，**结构化记笔记**：让智能体把进展写到可重读的临时文件，保持工作记忆精简。对于会产生大量中间细节的子任务（深度搜索、多文件分析），使用**子智能体隔离**，让细节以短摘要返回，而不是淹没主窗口。目标是每轮保留最小的高信号 token 集合，而非最大的集合。

### 问：网关在对话中途从 Claude Opus 5.5 回退到其他模型，质量与错误率都变差了。发生了什么？

**强答案：**
有两个原因。最新 Claude 模型的思考块绑定生成它们的模型，因此回退模型会丢弃这些块，在缺少先前推理的情况下继续，这是质量下降的原因。如果网关在回退时又改写历史（重新渲染系统提示、裁剪旧工具结果、将提醒注入早先轮次），前缀检查也会失败：2026 年 8 月 31 日及之后创建的账户会收到 400；若启用 `drop_block`，请求虽可运行，却失去先前推理。解决方法是让框架仅追加（对话中途系统消息、内联新增工具、供应商压缩），并明确处理回退：在回退模型上从干净摘要重新开始该轮次；安全拒绝场景可使用供应商的服务端回退（`fallbacks: "default"`，测试版），由提供商在网关不触碰历史的情况下用推荐模型重试。我还会增加逐对话丢失思考块的指标，避免问题再次悄然出现。

---

## 参考资料
- Liu 等人，“Lost in the Middle”（2023/2024 更新）
- Pan 等人。“LLMLingua-2: Data Distillation for Efficient and Faithful Task-Agnostic Prompt Compression”（2024）
- [Anthropic. “面向 AI 智能体的有效上下文工程” (2025)](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Anthropic. “面向长时运行智能体的有效框架” (2026)](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Anthropic。持久化思考（思考块绑定）](https://platform.claude.com/docs/en/build-with-claude/preserved-thinking)
- [Claude API 发布说明（压缩、推理强度、内联工具）](https://platform.claude.com/docs/en/release-notes/overview)
- [OpenAI。提示缓存指南](https://developers.openai.com/api/docs/guides/prompt-caching)
- [Google。Gemini API 上下文缓存](https://ai.google.dev/gemini-api/docs/caching)与[定价](https://ai.google.dev/gemini-api/docs/pricing)
- [OpenAI。失配报告（压缩摘要）](https://alignment.openai.com/misalignment-reports/)
- [Cursor。“延长智能体运行时的 token 效率改进”（2026 年 9 月）](https://cursor.com/blog/improved-token-efficiency)
- [Anthropic。Claude Opus 5.5 与 Claude Code 使用数据（2026 年 9 月）](https://claude.com/blog/claude-opus-5-5-built-for-coding-sessions-that-use-more-context)
- [ARC Prize。GPT-6 Astra 在 ARC-AGI-3 上的表现（2026 年 9 月）](https://arcprize.org/blog/astra)

---

*下一篇：[结构化生成](06-structured-generation.md)*
