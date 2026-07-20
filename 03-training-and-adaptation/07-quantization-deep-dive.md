# 量化深度解析

量化（quantization）是降低模型权重精度的过程，例如从 16 位降到 4 位，以节省内存并提高推理速度。这是在消费级和单 GPU 硬件上部署大模型的主要工具。

## 目录

- [精度与性能的权衡](#精度与性能的权衡)
- [量化方法（NF4、GPTQ、AWQ）](#量化方法)
- [GGUF 与 EXL2](#gguf-与-exl2)
- [KV 缓存量化（VRAM 节省器）](#kv-缓存量化-vram-节省器)
- [量化感知微调](#量化感知训练-qat)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 精度与性能的权衡

传统模型使用 **BF16**（16 位）。量化的目标是将其降低到 **8 位（FP8）**、**4 位（Int4/NF4）**，甚至 **1.5 位（BitNet）**。

| 精度 | 位数 | 权重大小（8B 模型） | 质量损失 | GPU 兼容性 |
|-----------|------|------------------------|--------------|-------------------|
| **BF16** | 16 | 16 GB | 0%（基线） | 所有现代设备 |
| **FP8** | 8 | 8 GB | < 1% | H100 / B200 / RTX 4090 |
| **4 位（NF4）**| 4 | 5 GB | 1-2% | 所有现代设备 |
| **2 位** | 2 | 2.5 GB | 10-15% | 研究 / 专用 |

---

## 量化方法

### 1. NF4（NormalFloat4，正态浮点 4）
用于微调（QLoRA）的黄金标准。它假设权重遵循正态分布，并将其映射到一组 16 个值。

### 2. AWQ（Activation-aware Weight Quantization，激活感知权重量化）
AWQ 不会把所有权重等量量化，而是识别出对质量最重要的 **1% 个“显著”权重**，并将它们保留在更高精度中。
- **优点**：比 GPTQ 更准确。

### 3. FP8（Multi-Node Standard，多节点标准）
由 Nvidia 的 Transformer Engine 支持的硬件原生量化。
- **为何胜出**：它提供了 Int8 的速度，同时具备 Float16 的动态范围，因此在训练和推理中都更稳定。

---

## GGUF 与 EXL2

### GGUF（llama.cpp）
- **部署**：CPU + GPU 卸载。
- **优点**：跨平台（Mac、Linux、Windows）、单文件、高度便携。
- **缺点**：比纯 GPU 格式更慢。

### EXL2（ExLlamaV2）
- **部署**：仅 GPU（Nvidia）。
- **优点**：Nvidia GPU 上**最快的 4 位格式**。相较 AutoGPTQ/AWQ 有显著性能提升。
- **缺点**：不灵活（仅限 Nvidia）。

---

## KV 缓存量化（VRAM 节省器）

在长上下文 RAG（1M+ tokens）中，**KV Cache（键值缓存）** 往往比模型权重本身消耗更多 VRAM。

- **BF16 KV Cache**：2M tokens ≈ 32GB VRAM（在 8B 模型上）。
- **FP8/Int4 KV Cache**：2M tokens ≈ 8GB - 16GB VRAM。

**细微差别**：现代服务框架（vLLM、SGLang、TensorRT-LLM）现在支持 **Streaming Quantization（流式量化）**，可在运行时即时压缩 KV 缓存，使同一块 GPU 的并发能力提升 4 倍。

---

## 量化感知训练（QAT）

QAT 不会在模型训练完成后再进行量化（Post-training Quantization，训练后量化），而是在训练过程中模拟量化。
- **结果**：模型会学会补偿精度损失。
- **状态**：参数少于 3B 的模型若要在 4 位下仍然可用，这是必需的。

---

## 面试题

### 问：为什么在 QLoRA 中使用 NF4，而不是标准 Float4？

**强答案：**
标准 Float4 使用固定网格，这与 LLM 权重的真实分布并不匹配，而权重通常遵循以零为中心的正态分布。NF4（NormalFloat4）是一种在数学上经过优化的数据类型，使得每个量化区间都包含来自正态分布的相同数量的值。这可以防止权重“聚集”，并确保模型尽可能保留信息（熵），从而比标准 4 位整数获得显著更高的准确率。

### 问：AWQ 与 GPTQ 有什么不同？

**强答案：**
GPTQ 是一种“逐层”（Layer-wise）量化方法，目标是最小化权重的均方误差。AWQ（Activation-aware Weight Quantization，激活感知权重量化）是“输入感知”的。它会基于一次小规模校准运行中看到的实际激活值，识别哪些权重最“显著”。通过只将这些重要权重（通常为 1%）保留在更高精度中，并量化其余部分，AWQ 比 GPTQ 获得更好的困惑度，尤其是在较小模型或更激进的量化（例如 3 位）下。

---

## 参考资料
- Dettmers et al. "QLoRA: Efficient Finetuning of Quantized LLMs" (2023)
- Frantar et al. "GPTQ: Accurate Post-Training Quantization for Generative Pre-trained Transformers" (2022)
- Lin et al. "AWQ: Activation-aware Weight Quantization for LLM Compression and Acceleration" (2023)

---

*下一篇：[训练推理模型：RLVR 与 GRPO](08-rlvr-and-reasoning-models.md)*
