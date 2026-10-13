# LoRA、QLoRA 和 PEFT

参数高效微调（PEFT，Parameter-Efficient Fine-Tuning）是适配 LLM（大语言模型）的行业标准。本章介绍 LoRA 和其他 PEFT 方法的机制及高级变体。

## 目录

- [PEFT 革命](#peft-革命)
- [LoRA 机制](#lora-机制)
- [QLoRA：4 位微调](#qlora-4-位微调)
- [高级变体（DoRA、VeRA、RS-LoRA）](#高级变体)
- [多 LoRA 服务（适配器）](#多-lora-服务-适配器)
- [面试题](#面试题)
- [参考文献](#参考文献)

---

## PEFT 革命

大多数企业无力对前沿规模的开放模型（稠密的 Llama 3.1 405B、总参数约 1.6T 的 DeepSeek V4 Pro，以及总参数 2.8T / 活跃参数 104B 的 Kimi K3）进行全参数微调；客户也根本无法对封闭的前沿模型进行全参数微调。PEFT 允许：

1. **内存效率**：通过 QLoRA 在单张 80 GB GPU 上训练 70B 模型。
2. **速度**：只更新不到 1% 的权重，训练速度快 2 倍。  
3. **模块化**：在共享的基础模型上切换“技能”（适配器），而无需重新加载权重。

---

## LoRA 机制

LoRA（Low-Rank Adaptation，低秩适配）将可训练的秩分解矩阵注入到 transformer 层中。

```python
# The LoRA Equation for a Weight Matrix W:
h = Wx + (BA)x * (alpha/r)
```
- **W**：预训练权重（冻结，梯度 = None）
- **A、B**：LoRA 适配器（可训练）
- **r**：秩（例如，8、16、64）
- **alpha**：缩放因子（通常为 2 * rank）

### 关键细节：目标模块
历史上，我们只针对 query/value 投影（`q_proj`、`v_proj`）。
**现代标准**：为了获得最大的稳定性和性能，即使在较低秩下，也要针对**所有**线性层（`q, k, v, o, gate, up, down`）。

---

## QLoRA：4 位微调

QLoRA 通过将基础模型量化到 4 位（NF4）并同时保持 16 位梯度，进一步提升效率。

| 优化 | 方法 | 好处 |
|--------------|--------|---------|
| **NF4 量化** | 归一化浮点 4 | 比标准 Int4 具有更好的信息密度 |
| **双重量化** | 对量化常量进行量化 | 每参数节省约 0.37 位（65B 模型约节省 3 GB） |
| **分页优化器** | NVIDIA 统一内存 | 在内存使用尖峰时将优化器状态分页到 CPU RAM，避免 OOM |

---

## 高级变体

### 1. DoRA（Weight-Decomposed Low-Rank Adaptation，权重分解低秩适配）
DoRA 将权重更新分解为**幅度**和**方向**。
- **结果**：论文报告，在 LLaMA、LLaVA 和 VL-BART 任务上，相同秩的 DoRA 均优于 LoRA，只需增加少量训练成本便缩小了与全参数微调的部分差距。
- **胜出的原因**：它允许模型独立调整“变化多少”和“具体改什么”。

### 2. VeRA（Vector-based Random Matrix Adaptation，基于向量的随机矩阵适配）
VeRA 不使用可训练的低秩矩阵 `A` 和 `B`，而是在不同层间共享一对冻结的随机矩阵，只训练每层的小型缩放向量。
- **效率**：每层只训练两个小向量，因此 VeRA 的可训练参数量仅为 LoRA 的**一小部分**；具体比例取决于对比的 LoRA 秩（秩越高，差距越大）。
- **使用场景**：超大规模多 LoRA 服务。

### 3. RS-LoRA（Rank-Stabilized LoRA，秩稳定 LoRA）
使用缩放因子 `alpha / sqrt(r)`。
- **好处**：允许你提高秩（到 256+），而不会让模型变得不稳定或需要更低的学习率。

---

## 多 LoRA 服务（适配器）

生产系统现在会提供一个基础模型（例如，Llama 3.3 70B 或 Qwen3.8-27B），并在同一批次中动态切换适配器。

```python
# vLLM / SGLang multi-LoRA pattern:
# Request 1 -> Base + Finance_Adapter
# Request 2 -> Base + Legal_Adapter
# Request 3 -> Base + Medical_Adapter
```
**技术方案**：批量 LoRA 内核（Punica 的 SGMV）让一次解码步骤能对批次中的不同行应用不同适配器；S-LoRA 的**统一分页（Unified Paging）**将适配器权重与 KV 缓存置于同一个分页池，闲置适配器保留在主机内存。S-LoRA 报告称，当时可服务数千个适配器，吞吐量最高为 HuggingFace PEFT 和 vLLM 的 4 倍。在 vLLM 中，`--enable-lora`、`--max-loras`（每批次常驻的适配器数）和 `--max-lora-rank` 是容量控制参数；开销会随秩及每批次不同适配器的数量增加，因此应针对自己的请求组合进行基准测试。

**采用前检查功能之间的相互影响。** LoRA 支持往往落后于其他服务功能：例如，vLLM 的自适应推测验证在 2026 年 8 月推出时尚不支持 LoRA。如果租户的适配器使推测解码或快速内核路径在未察觉的情况下失效，该租户的延迟表现便会与基础模型不同。

---

## 面试题

### 问：为什么 LoRA 的 alpha 参数通常设为秩的 2 倍？

**强回答：**
更新项按 `alpha/r` 缩放；B 初始化为零，A 随机初始化，因此训练从与基础模型完全一致的状态开始。原始 LoRA 论文固定 `alpha`（取第一次尝试的秩），使 `alpha/r` 随秩增大而减小，从而大致归一化更新幅度，调整 `r` 时无需重新调节学习率。`alpha = 2r` 是社区经验规则，不是定律：它把缩放比例固定在 2，让常见秩（8 到 64）的更新更强，通常训练也更快。但在高秩下存在问题：rsLoRA 表明，随着 `r` 增大，`alpha/r` 会过度缩小更新，而 `alpha/sqrt(r)` 是稳定的缩放方式；因此高秩训练（256+）会使用 rsLoRA。面试要点是 `alpha` 与学习率相互关联：选定一种约定，再调节另一项。

### 问：什么是 DoRA，为什么要用它而不是标准 LoRA？

**强回答：**
DoRA（Weight-Decomposed Low-Rank Adaptation，权重分解低秩适配）是一种 2024 年提出的技术，它像 Weight Normalization（权重归一化）那样将预训练权重分为幅度和方向，只对方向应用 LoRA，同时直接训练幅度向量。标准 LoRA 将二者耦合，因此难以实现“小幅改变方向、大幅改变幅度”（或反过来）的更新，而全参数微调中会出现这种模式。论文报告称，DoRA 以适度增加训练计算量为代价，在相同秩下持续优于 LoRA；幅度向量可在推理时合并回权重，因此服务成本不变。在高风险领域适配中，我会将它作为相对于 LoRA 成本较低的 A/B 对比，而非自动采用的默认方案。

---

## 参考文献
- Hu 等人. “LoRA: Low-Rank Adaptation of Large Language Models” (2021)
- Liu 等人. “DoRA: Weight-Decomposed Low-Rank Adaptation” (2024)
- Dettmers 等人. “QLoRA: Efficient Finetuning of Quantized LLMs” (2023)
- Kopiczko 等人. “VeRA: Vector-based Random Matrix Adaptation” (2024)
- Sheng 等人. “S-LoRA: Serving Thousands of Concurrent LoRA Adapters” (2023)
- Kalajdzievski. “A Rank Stabilization Scaling Factor for Fine-Tuning with LoRA” (rsLoRA, 2023)

---

*下一篇：[RLHF 和 DPO](04-rlhf-and-dpo.md)*
