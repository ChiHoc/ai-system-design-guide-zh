# 案例研究：AI 驱动的客户支持 (AI-Powered Customer Support)

## 问题

一家电子商务公司每月处理 **200 万张支持工单**。他们希望建立一个 AI 系统，能够在无需人工介入的情况下自动解决 60% 的工单，并在复杂问题出现时将完整上下文交给人工客服。

**面试中给出的约束条件：**
- 24/7 跨 12 种语言运行
- 必须与现有的 Zendesk 和 Salesforce 集成
- 不能做出虚假承诺（退款、发货日期）
- 人工客服必须能够在对话中途接管
- 成本目标：每张已解决工单 $0.05
- 必须告知欧盟客户他们正在与 AI 对话（欧盟《人工智能法》第 50 条，自 2026 年 8 月 2 日起适用）

---

## 面试题

> “设计一个客户支持 AI，能够自动处理 ‘Where is my order?’，但在遇到 ‘I want to sue you for fraud’ 时知道何时升级给人工。”

---

## 方案架构

```mermaid
flowchart TB
    subgraph Intake["Ticket Intake"]
        TICKET[New Ticket] --> CLASSIFY[Intent Classifier<br/>GPT-6 Luna]
        CLASSIFY --> INTENT{Intent Type}
    end

    subgraph Routing["Smart Routing"]
        INTENT -->|Simple| AUTO[Auto-Resolution Path]
        INTENT -->|Complex| HYBRID[Hybrid Path]
        INTENT -->|Escalate| HUMAN[Immediate Escalation]
    end

    subgraph AutoResolve["Auto-Resolution"]
        AUTO --> TOOLS[Tool Calls<br/>Order API, FAQ DB]
        TOOLS --> DRAFT[Draft Response]
        DRAFT --> SAFETY[Safety Check]
        SAFETY -->|Pass| SEND[Send to Customer]
        SAFETY -->|Fail| HUMAN
    end

    subgraph HybridPath["Hybrid Resolution"]
        HYBRID --> AGENT_DRAFT[AI Drafts Response]
        AGENT_DRAFT --> QUEUE[Human Review Queue]
        QUEUE --> APPROVE{Approve?}
        APPROVE -->|Yes| SEND
        APPROVE -->|Edit| EDIT[Human Edits]
        EDIT --> SEND
    end
```

---

## 核心设计决策

### 1. 三层路由（Auto / Hybrid / Escalate）

**答案：** 并不是所有工单都相同。我们将其分类到三条路径：

| 路径 | 标准 | 示例 | 人工介入 |
|------|------|------|----------|
| **Auto** | 高置信度、低风险 | "Where is my order?" | 无 |
| **Hybrid** | 中等置信度或中等风险 | "I want a refund" | 审核 AI 草稿 |
| **Escalate** | 法务、威胁、VIP、低置信度 | "This is fraud" | 完全人工处理 |

### 2. 基于工具的解决方案（Tool-Based Resolution），而非纯生成（Pure Generation）

**答案：** AI 不会“知道”订单位置。它会调用 Order API 工具。这对准确性至关重要：

```python
@tool
def get_order_status(order_id: str) -> dict:
    """Retrieve real-time order status from OMS."""
    order = oms_client.get_order(order_id)
    return {
        "status": order.status,
        "shipped_date": order.shipped_at,
        "estimated_delivery": order.eta,
        "tracking_url": order.tracking_url
    }
```

LLM 负责编排工具，但从不编造数据。

### 3. 为什么要先做安全检查（Safety Check）？

**答案：** 即便是自动解决的工单，也要经过安全过滤：

1. **Promise Detection 承诺检测**：标记像“我保证”或“We will pay”之类的表述
2. **Sentiment Mismatch 情绪不匹配**：当客户情绪激烈时，捕捉 AI 回复过于友好或不匹配的语气
3. **PII Leak PII 泄露**：确保不出现内部备注或其他客户数据
4. **Competitor Mention 竞争对手提及**：标记 AI 若推荐竞争对手的情况
5. **联系渠道白名单**：草稿中的任何电话号码、URL 或支付链接都必须与已验证白名单一致。2026 年 9 月，一名安全研究人员报告，有钓鱼活动向网络投放虚假支持页面和 PDF，诱使 ChatGPT、Gemini 和 Google AI Overviews 展示航空公司与银行的诈骗客服电话；从开放网络或客户提供的文本检索资料的支持机器人，也可能重复传播这些诱饵

---

## 升级智能（Escalation Intelligence）

最难的是判断何时升级。我们使用多信号置信度评分：

```mermaid
flowchart LR
    subgraph Signals["Confidence Signals"]
        S1[Intent Confidence<br/>0.92] --> COMBINE
        S2[Sentiment Score<br/>Negative] --> COMBINE
        S3[Customer Tier<br/>VIP] --> COMBINE
        S4[Topic Risk<br/>Legal = High] --> COMBINE
    end

    COMBINE[Weighted Aggregation] --> SCORE{Final Score}
    SCORE -->|> 0.85| AUTO[Auto-Resolve]
    SCORE -->|0.5 - 0.85| HYBRID[Human Review]
    SCORE -->|< 0.5| ESCALATE[Immediate Escalate]
```

**关键洞察：** 一个 VIP 客户即使问题简单，也会进入 Hybrid 路径，因为错误成本更高。

---

## 多语言支持

支持 12 种语言，无需 12 个独立模型，也无需经英语中转翻译：

```mermaid
flowchart LR
    INPUT[Customer Message<br/>Spanish] --> DETECT[Language Detection]
    DETECT --> PROCESS[原生多语言处理<br/>多语言 LLM + 工具]
    KB[(英语知识库<br/>多语言嵌入)] --> PROCESS
    PROCESS --> RESPONSE[西班牙语回复]
    PROCESS --> HANDOFF[交接摘要<br/>供人工客服使用]
```

**为什么不先翻译成英语，再翻译回来？**

早期设计会经英语中转，以维持一套提示词和知识库。如今的小模型（GPT-6 Luna、Gemini 3.8 Flash、Claude Haiku 4.5）能直接处理主要语言，中转反而得不偿失：每轮多出两次模型调用、增加延迟，并损失升级判断所需的语气信息。知识库仍可保留英语内容，使用多语言嵌入模型跨语言检索（Cohere Embed 5 支持 100 多种语言）。仅在人工需要时翻译，例如客服不懂客户语言时的交接摘要。应在自己的评估集上检验长尾语言，因为 12 种语言的质量并不一致。

---

## 中途接管（Mid-Conversation Human Takeover）

当人工接管时，必须具备完整上下文：

```python
def handoff_to_human(conversation_id: str, agent_id: str):
    conversation = get_conversation(conversation_id)
    
    # Generate summary for human agent
    summary = llm.generate(f"""
    Summarize this conversation for a human agent:
    - Customer issue
    - What AI already tried
    - Why escalation happened
    
    Conversation:
    {conversation.messages}
    """)
    
    # Create handoff package
    return {
        "summary": summary,
        "customer_sentiment": conversation.sentiment,
        "attempted_solutions": conversation.tool_calls,
        "full_transcript": conversation.messages,
        "customer_tier": conversation.customer.tier
    }
```

应把升级原因当作产品数据，而不只是路由数据。Anthropic 于 2026 年 9 月 30 日发布的自家入站销售智能体案例（厂商自述）可作参考：每次对话会以三种方式之一结束——直接结账、带完整对话及原因说明转交销售代表，或给出简短信息答复；Anthropic 称需要人工介入的对话占比下降了约一半。在交接时记录原因，才能分析升级情况。该案例还有两条可直接借鉴的经验：以目标为导向的指令优于冗长细碎的规则清单；每次智能体变更都保存为一个版本，以便将新会话切回旧版本。

---

## 成本分析

按 2026 年 10 月标价估算，假设每张工单约 3 轮对话、每轮约 4K 输入 token。

| Component 组件 | Cost per Ticket 每张工单成本 |
|-----------|-----------------|
| 意图分类（GPT-6 Luna，每 100 万输入/输出 token 为 $0.10 / $0.50） | $0.0001 |
| Tool calls (Order API, FAQ search) | $0.001 |
| 回复生成（GPT-6 Luna：3 × 4K 输入，每轮约 750 输出 token，含推理） | $0.0023 |
| 安全检查（分类器加一次 GPT-6 Luna 检查） | $0.0005 |
| 交接摘要翻译（人工客服需要时） | $0.0005 |
| **Average total 平均总计** | **~$0.0044** |

在 60% 自动解决率下：**每张已解决工单成本约 $0.007**，远低于 $0.05 的目标。每月 200 万张工单的模型 token 支出已不再是主要约束（低于 $10,000）。真正昂贵的是升级处理和错误回答：一次错误退款承诺的代价可能超过一个月的意图分类费用（约 $200）。应把节省下来的预算用于为 Hybrid 路径的草稿选用更强模型（例如 Claude Sonnet 5.5 或 GPT-6 Sol 这样的 $2 / $10 档位模型），而不是继续压缩 Auto 路径成本。

---

## 面试追问

**Q: 如果 AI 一直道歉却始终没有真正帮助怎么办？**

A: 我们跟踪“resolution effectiveness 解决效果”，而不仅是“response sent 已发送回复”。如果客户在 24 小时内就同一问题再次回复，则该工单标记为“unresolved 未解决”，并将该 AI 模式标记为待复盘。我们还会做每周分析：“哪些短语与客户后续追问相关？”

**Q: 如果客户坚持要找真人对话怎么办？**

A: 明确升级触发短语（“talk to a human”, “speak to manager”）会立即触发转接，不受置信度分数影响。我们不会与升级请求对抗。

**Q: 如果客户尝试越狱（jailbreak）支持 AI 怎么处理？**

A: 采用输入净化和权限范围收窄的工具设计。要假设系统提示会泄漏，因为汇总工具输出仍是自由格式生成，所以不能把秘密放进去。真正的保护来自工具按已认证客户限定权限（订单工具只能读取该客户的订单），而退款或账户变更必须走 Hybrid 路径；这样即使越狱成功，也只能生成文字，不能执行操作。系统提示仍应保持收窄，以保证回答质量：“You help with order issues for [Company]. You cannot discuss other topics.”

---

## 面试要点（Key Takeaways for Interviews）

1. **分层路由平衡自动化与风险**：不是每张工单都应自动解决
2. **工具化 grounding（Tool-based grounding）防止幻觉**：AI 检索事实，而不是凭空生成
3. **置信度是多维度的**：意图清晰度 + 情绪 + 客户等级 + 主题风险
4. **人工接管需要上下文**：要总结，不是只倾倒对话记录
5. **升级原因是产品反馈**：记录每次交接的原因，并逐步解决出现最多的原因

---

*Related chapters: [Human-in-the-Loop Patterns](../07-agentic-systems/08-human-in-the-loop-patterns.md), [Guardrails Implementation](../13-reliability-and-safety/01-guardrails.md)*
