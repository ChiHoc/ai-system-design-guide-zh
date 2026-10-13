# 预训练基础

预训练是构建 LLM 最耗计算资源的阶段，模型在海量数据集上学习通用知识和语言模式。

## 目录

- [预训练目标](#预训练目标)
- [数据课程与质量](#数据课程与质量)
- [扩展定律（推理最优）](#扩展定律-训练最优-vs-推理最优)
- [计算需求](#计算需求)
- [训练稳定性](#训练稳定性)
- [面试题](#面试题)
- [参考文献](#参考文献)

---

## 预训练目标

大多数现代 LLM 都是 **仅解码器（Decoder-only）**，并使用 **因果语言建模（Causal Language Modeling，CLM）**：

```python
# Objective: Minimize Cross-Entropy Loss
Loss = -sum(log P(token_i | token_1, ..., token_{i-1}))
```

模型根据上下文预测下一个 token。这个简单目标在大规模下会带来涌现出的推理能力。许多当前模型还加入辅助的**多 token 预测（MTP）**目标（DeepSeek-V3 推广了这一做法）：它既增强训练信号，也留下可供推理服务引擎复用于[推测解码](../04-inference-optimization/03-speculative-decoding.md)的草稿头。

---

## 数据课程与质量

重点已经从“更多数据”转向“更好的课程”。

### 前沿模型的 token 预算
公开的开放模型预训练预算处于 15T 到 36T+ token 范围：Llama 3 使用约 15T token，DeepSeek-V3 为 14.8T，Qwen3 约 36T；Meta 称 Llama 4 的混合数据超过 30T。封闭实验室（OpenAI、Anthropic、Google）不公布 token 数，因此 GPT、Claude 或 Gemini 的任何具体数值都只能视为猜测。在这个规模下，**去重（Deduplication）** 和 **质量过滤（Quality Filtering）** 是主要差异点。

### 数据混合标准
| 组成 | 百分比 | 目的 |
|-----------|------------|---------|
| Web（CommonCrawl） | 50-60% | 通用知识，多样风格 |
| 代码（GitHub、StackOverflow） | 15-20% | **对逻辑与推理至关重要** |
| 书籍（Project Gutenberg） | 10% | 叙事连贯性，长上下文 |
| 学术（ArXiv、PubMed） | 10% | 专门技术知识 |
| 合成数据（模型生成） | 5-10% | 数学、逻辑和特定指令路径 |

这些占比是典型通用模型的数据配比，并非定律。侧重推理的小模型使用合成数据的比例高得多：微软的 Phi-4 报告将 40% 的预训练 token 分配给合成数据（见[合成数据生成](06-synthetic-data-generation.md)）。

**细微之处： “代码效应”**
研究表明，在预训练混合数据中增加代码，会通过教授结构化思维来提升模型在**非编码**推理任务上的表现（例如数学、逻辑谜题）。

**数据来源现在是设计要求。** 法院正将作品用于训练是否合法，与作品如何取得分别判断（Bartz v. Anthropic 裁决认为训练合法，但通过盗版取得作品不合法；此案以 $1.5B 和解）。应按语料库保存获取记录，而不只是记录许可证字段。

---

## 扩展定律：训练最优 vs. 推理最优

### Chinchilla 范式（2022-2024）
`数据 token（D）≈ 20 * 参数（N）`
对于一个 70B 模型，这意味着大约 ~1.4T token。

### 推理最优范式
现代模型（Llama 3、Llama 4、Qwen3）相对于 Chinchilla 来说属于**严重过训练**。
- **为什么？**：训练成本只付一次；推理成本会支付数十亿次。
- **结果**：小模型（8B）现在会在 15T+ token 上训练，使它们具备与更早的 70B 模型相当的能力，但部署成本低得多。

| 策略 | token/参数 比率 | 最适合 |
|----------|-------------------|----------|
| Chinchilla | 20:1 | 研究 / 概念验证 |
| **推理最优** | **200:1 到 2,000:1+** | 生产部署（Llama 3 8B 使用约 15T token，约为 1,900:1） |

---

## 计算需求

常用的粗略估算公式是：**训练 FLOPs ≈ 6 × N × D**，其中 N 为每个 token 涉及的参数量，D 为训练 token 数（前向传播为 2ND，反向传播为 4ND）。

| 模型 | N（每 token） | D | ≈ FLOPs | 报告的算力消耗 |
|------|---------------|---|---------|----------------|
| Llama 3.1 405B（稠密） | 405B | 15.6T | 3.8 × 10^25 | 30.84M H100 GPU 小时（Meta 模型卡） |
| DeepSeek-V3（MoE，总参数 671B） | 37B 活跃参数 | 14.8T | ~3.3 × 10^24 | 2.788M H800 GPU 小时（DeepSeek 报告） |

面试官常考察两点：
- **MoE 应使用活跃参数量**，而不是总参数量。若按 DeepSeek-V3 的 671B 总参数计算，算力消耗会被高估约 18 倍。它每个 token 激活 37B 参数，而 Llama 3.1 405B 的 405B 参数全部参与计算，因此在 token 数相近时，其训练 FLOPs 约为后者的十分之一。
- **GPU 小时 = FLOPs /（峰值 FLOPs × MFU）**。对于充分调优的大型 BF16 稠密模型训练，35-45% 的模型 FLOPs 利用率较为典型；Meta 报告 Llama 4 Behemoth 在 32K GPU 上使用 FP8 时，每块 GPU 达到 390 TFLOPs。混合精度下，分片前权重、梯度和优化器状态约需每参数 16 字节；正是训练内存需求迫使系统采用 ZeRO/FSDP 分片及流水线并行，远早于算力耗尽。

---

## 训练稳定性

在“Ultra”规模（100k+ GPU，约 10 万+）下训练会面临巨大的稳定性问题。

### 1. 损失尖峰
loss 的突然跳升，可能毁掉一次训练运行。
- **标准修复**：**周期性检查点（Periodic Checkpointing）** 和 **自动回滚（Automatic Rollbacks）**。
- **架构修复**：**残差缩放（Residual Scaling）**（初始化权重，使残差分支从接近零开始）。

### 2. 精度：BF16、FP8 与 FP4
- **BF16**：对大多数团队而言，仍是稳定的默认选择。
- **FP8 混合精度**：DeepSeek-V3 展示了在 671B 规模上的应用后，它成为前沿规模的标准做法（细粒度分块缩放、更高精度的累加，以及让敏感运算保持在 BF16/FP32）；Meta 也用 FP8 训练了 Llama 4。FP8 能使 H100/B200 的 tensor core 峰值吞吐量翻倍，但并非所有运算都使用 FP8，因此端到端收益较小。
- **FP4（NVFP4 / MXFP4）**：正在兴起的前沿方案。NVIDIA 使用 NVFP4、随机 Hadamard 变换和随机舍入，在 10T token 上训练了一个 12B 模型，结果与 FP8 基线相当（arXiv:2509.25149）。NVIDIA 将 Vera Rubin NVL72 机架的 NVFP4 训练性能标为 2,520 PFLOPS；The Register 报道称，Meta 以训练为先的 MTIA 400 达到 12 PFLOPS MXFP4。预计 FP4 预训练方案在 2027 年继续普及；它取决于训练配方和内核，而不是白得的 2 倍收益。

---

## 面试题

### Q: 如果 Chinchilla 说 160B 个 token 才是最优，为什么还要在 15T token 上训练一个 8B 模型？

**强答案：**
Chinchilla 的最优性关注的是如何最好地使用固定的**训练**算力预算。然而在生产环境中，我们关心的是 **总拥有成本（Total Cost of Ownership，TCO）**，而它主要由推理成本主导。通过对小模型进行过训练，我们把更多智能“烘焙”进更少的参数里。这样得到的模型在服务端效率高得多（更高 TPS、更低 VRAM），同时达到按 Chinchilla 最优点训练的更大模型的质量。收益会递减（每增加一万亿 token 带来的提升更少），因此何时停止是成本决策，而非定律。

### Q: LLM 预训练中的“课程（curriculum）”是什么？

**强答案：**
课程指的是数据的顺序和混合方式。一个常见的现代模式是：
1. **通用知识阶段：** 80% 的 token（Web、书籍）。
2. **推理聚焦阶段：** 15% 的 token（代码、数学、逻辑）。
3. **高质量“冷却”阶段：** 最后 1-5% 的 token 采用极高质量、人工精选或教科书类数据。这个“冷却”阶段有助于让模型更少抖动，并在任何微调开始前更好地遵循指令。

实验室越来越多地在 RL 之前将第 3 阶段延长为侧重推理的专门**中期训练**阶段，因为它能提高基础能力，供后续 RL 进一步强化（见 [RLVR 与推理模型](08-rlvr-and-reasoning-models.md)）。

### Q: 估算在 15T token 上预训练 70B 稠密模型所需的算力。

**强答案：**
6 × 70e9 × 15e12 ≈ 6.3 × 10^24 FLOPs。H100 的稠密 BF16 峰值性能约为 1 PFLOPS；若 MFU 为 40%，则每秒约为 4 × 10^14 FLOPs，因此需要约 1.6 × 10^10 GPU 秒，即约 4.4M GPU 小时。在 16K GPU 集群上，纯计算时间约为 11-12 天；重启、评估和失败的训练通常还会增加 20-50%。可用 Meta 报告的 Llama 3.1 70B 训练消耗 7.0M H100 GPU 小时做合理性检查。如果模型改为活跃参数量相同的 MoE，FLOPs 不变，但内存和通信（专家并行、all-to-all）会成为主要工程难题。

---

## 参考文献
- Kaplan et al.《神经语言模型的扩展定律》（Scaling Laws for Neural Language Models，2020）
- Hoffmann et al.《训练计算最优的大语言模型》（Training Compute-Optimal Large Language Models，Chinchilla，2022）
- Meta AI.《Llama 3 模型家族》（The Llama 3 Herd of Models，2024）及《Llama 4 模型家族》（The Llama 4 herd，博客，2025）
- DeepSeek-AI.《DeepSeek-V3 技术报告》（DeepSeek-V3 Technical Report）arXiv:2412.19437（2024）
- NVIDIA.《使用 NVFP4 预训练大语言模型》（Pretraining Large Language Models with NVFP4）arXiv:2509.25149（2025）

---

*下一篇：[微调策略](02-fine-tuning-strategies.md)*
