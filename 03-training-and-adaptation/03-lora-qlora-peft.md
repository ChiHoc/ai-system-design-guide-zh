# LoRA、QLoRA 和 PEFT

参数高效微调（PEFT，Parameter-Efficient Fine-Tuning）是适配 LLM（大语言模型）的行业标准。本章介绍 LoRA 和其他 PEFT 方法的机制及高级变体。

## 目录

- [PEFT 革命](#peft-革命)
- [LoRA 机制](#lora-机制)
- [QLoRA：4 位微调](#qlora-4-位微调)
- [高级变体（DoRA、Vera、RS-LoRA）](#高级变体)
- [多 LoRA 服务（适配器）](#多-lora-服务-适配器)
- [面试题](#面试题)
- [参考文献](#参考文献)

---

## PEFT 革命

对前沿模型（GPT-5.5、Claude Opus 4.7、Llama 4 405B）进行全量微调在经济上对大多数企业都不可行。PEFT 允许：

1. **内存效率**：在单张 A100 上训练 70B 模型。  
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
| **双重量化** | 对量化常量进行量化 | 每个模型节省约 0.5 GB 显存 |
| **分页** | 统一内存（Nvidia） | 通过溢出到 CPU RAM 防止 OOM |

---

## 高级变体

### 1. DoRA（Weight-Decomposed Low-Rank Adaptation，权重分解低秩适配）
DoRA 将权重更新分解为**幅度**和**方向**。
- **结果**：学习速度比 LoRA 快 2 倍，表现更接近全量微调。
- **胜出的原因**：它允许模型独立调整“变化多少”和“具体改什么”。

### 2. Vera（Vector-based Random Aggregation，基于向量的随机聚合）
Vera 不使用低秩矩阵 `A` 和 `B`，而是使用固定的随机投影和一个小型可训练向量。
- **效率**：与 LoRA 相比，适配器尺寸缩小 **10 倍**。
- **使用场景**：超大规模多 LoRA 服务。

### 3. RS-LoRA（Rank-Stabilized LoRA，秩稳定 LoRA）
使用缩放因子 `alpha / sqrt(r)`。
- **好处**：允许你提高秩（到 256+），而不会让模型变得不稳定或需要更低的学习率。

---

## 多 LoRA 服务（适配器）

生产系统现在会提供一个基础模型（例如，Llama 4 70B），并在同一批次中动态切换适配器。

```python
# vLLM/LMCache Multi-LoRA Pattern:
# Request 1 -> Base + Finance_Adapter
# Request 2 -> Base + Legal_Adapter
# Request 3 -> Base + Medical_Adapter
```
**技术方案**：**连续批处理 + PagedAttention v3** 使得在相较于基础模型仅增加 5-10% 延迟开销的情况下，能够服务 100+ 个适配器。

---

## 面试题

### 问：为什么 LoRA 的 alpha 参数通常设为秩的 2 倍？

**强回答：**
`alpha` 参数是 LoRA 更新的缩放因子。当我们初始化 LoRA 矩阵时，B 通常初始化为零，而 A 是随机的。随着训练进行，更新幅度取决于秩 `r`。通过设置 `alpha=2r`（或任何常数），我们可以确保如果之后决定修改秩（例如，从 8 改到 16），就不需要重新调节学习率。缩放因子 `alpha/r` 会相对于学习率对更新幅度进行归一化。

### 问：什么是 DoRA，为什么要用它而不是标准 LoRA？

**强回答：**
DoRA（Weight-Decomposed Low-Rank Adaptation，权重分解低秩适配）是一种 2024 技术，它将预训练权重更新分离为幅度和方向两个部分，类似于 Weight Normalization（权重归一化）。而标准 LoRA 会同时更新幅度和方向，DoRA 则允许二者独立学习。经验上，DoRA 展现出更好的收敛性和更高的准确率，即使在低秩下也常常能接近全参数微调，因此在高风险领域适配中通常是首选。

---

## 参考文献
- Hu 等人. “LoRA: Low-Rank Adaptation of Large Language Models” (2021)
- Liu 等人. “DoRA: Weight-Decomposed Low-Rank Adaptation” (2024)
- Dettmers 等人. “QLoRA: Efficient Finetuning of Quantized LLMs” (2023)

---

*下一篇：[RLHF 和 DPO](04-rlhf-and-dpo.md)*
