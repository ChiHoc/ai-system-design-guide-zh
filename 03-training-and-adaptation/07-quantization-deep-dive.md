# 量化深度解析

量化（quantization）是降低模型权重精度的过程，例如从 16 位降到 4 位，以节省内存并提高推理速度。这是在消费级和单 GPU 硬件上部署大模型的主要工具；到 2026 年，它也是数据中心提供模型服务的默认做法，其中 FP4 权重配合 FP8 KV 缓存是主要配置。

## 目录

- [精度与性能的权衡](#精度与性能的权衡)
- [量化方法（NF4、AWQ、FP8、FP4）](#量化方法)
- [文件与服务格式](#文件与服务格式)
- [KV 缓存量化（VRAM 节省器）](#kv-缓存量化-vram-节省器)
- [量化感知微调](#量化感知训练-qat)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 精度与性能的权衡

传统模型使用 **BF16**（16 位）。量化的目标是将其降低到 **8 位（FP8）**、**4 位（Int4、NF4、NVFP4、MXFP4）**，甚至 **约 1.6 位的三值权重**（BitNet b1.58 及其后续模型）。

| 精度 | 位数 | 权重大小（8B 模型） | 质量损失 | 硬件 |
|-----------|------|------------------------|--------------|-------------------|
| **BF16** | 16 | 16 GB | 0%（基线） | 所有现代设备 |
| **FP8** | 8 | 8 GB | < 1% | H100 / H200 / B200 / RTX 4090 及更新型号；AMD MI300 及更新型号 |
| **4 位整数（NF4、AWQ、GPTQ）** | 4 | 4.5-5 GB | 1-2% | 所有现代设备 |
| **4 位浮点（NVFP4 / MXFP4）** | 4 | ~4.5 GB | 校准和内核良好时损失较小 | NVFP4：Blackwell、Rubin；MXFP4：AMD MI350/MI455X 和 Blackwell |
| **2 位（直接训练后量化）** | 2 | 2.5 GB | 10-15% | 研究 / 专用 |
| **三值权重（专门训练或适配）** | ~1.6-1.7 | ~1.7 GB | 厂商称部分 27B 级模型接近 FP16 质量 | 仅限定制内核 |

2 位与三值权重两行说明，仅看“位数”无法预测质量：直接将模型训练后量化为 2 位会严重损害推理能力，而针对三值权重适配的模型可能保持质量。PrismML 的 Ternary Bonsai 2 27B（2026 年 9 月，Apache 2.0，基于 Qwen3.8-27B）在 5.95 GB 文件中平均每权重占 1.72 位，并报告在 14 项思考模式基准上达到 FP16 质量的 98.2%（厂商报告）。它需要 PrismML 分叉版的 llama.cpp 和 MLX；原版 llama.cpp 无法加载，这也是特殊格式通常要付出的代价。

---

## 量化方法

### 1. NF4（NormalFloat4，正态浮点 4）
用于微调（QLoRA）的黄金标准。它假设权重遵循正态分布，并将其映射到一组 16 个值。

### 2. AWQ（Activation-aware Weight Quantization，激活感知权重量化）
AWQ 观察到，约 **1% 的权重“显著”**（它们与较大的激活值相乘），主导了量化误差。将其保留在更高精度可以缓解误差，却需要不利于硬件执行的混合精度。因此，AWQ 改为在量化前**放大显著输入通道**（并将反向缩放折叠进前一个运算），既保护这些通道，又让所有权重最终仍为 4 位。
- **优点**：在许多场景下，同位宽时比 GPTQ 更准确，无需反向传播，且只需少量校准数据。

### 3. FP8
通过 NVIDIA 的 Transformer Engine 在 Hopper 及后续硬件上获得原生支持（AMD MI300 级硬件也支持）。
- **为何胜出**：它提供 Int8 的速度，同时具备远大于 Int8 的动态范围，因此在训练和推理中都较稳定。权重和激活使用 E4M3，梯度等更需要动态范围的部分使用 E5M2。

### 4. FP4：NVFP4 与 MXFP4
这是 2026 年服务模型时备受关注的精度格式。两者都是采用分块缩放的 4 位浮点（E2M1），区别在于块大小和缩放格式：

| 格式 | 块大小 | 缩放方式 | 适用硬件 |
|------|--------|----------|----------|
| **NVFP4** | 16 个值 | 每块一个 FP8（E4M3）缩放值，另有每张量一个 FP32 缩放值 | NVIDIA Blackwell、Rubin |
| **MXFP4**（OCP Microscaling） | 32 个值 | 每块一个 2 的幂（E8M0）缩放值 | AMD MI350 和 MI455X、NVIDIA Blackwell |

它已成为主流的证据包括：NVIDIA 将 Vera Rubin NVL72 机架的 NVFP4 推理性能标为 3,600 PFLOPS；MLPerf Inference v6.1（2026 年 9 月）中已有提交从 FP8 转向 FP4，包括 NVFP4 权重配合 FP8 KV 缓存；DeepSeek-V4 的 MoE 专家权重使用 FP4，而大多数其他参数使用 FP8。检查点在不同厂商硬件间也越来越可移植：SGLang v0.5.18 在 AMD 上加载 NVFP4 检查点时将其重新量化为 MXFP4，并报告五个大型 MoE 模型的 GSM8K 恢复率为 97.5% 至 100.2%。

**内核路径仍需注意。** 低精度只有在内核路径足够好时才有优势。NVIDIA 自己在 B200/GB200 上运行 Nemotron 3.5 Lightning 的 Dynamo 配方时，测得 BF16 比采用 Marlin 内核的 NVFP4 **快 80%**，比采用 CuTeDSL 内核的 NVFP4 仍快 12%。vLLM v0.30.0 在 SM100/103 上将 FlashInfer CuTeDSL 设为默认 NVFP4 W4A16 路径，替代 Marlin，因此同一个检查点在引擎升级后速度也可能变化。迁移前，应对准确的模型、引擎版本和内核后端做基准测试。

---

## 文件与服务格式

### GGUF（llama.cpp）
- **部署**：CPU + GPU 卸载；是 llama.cpp、Ollama 和 LM Studio 的本地格式。
- **优点**：跨平台（Mac、Linux、Windows）、单文件、高度便携。
- **缺点**：并发服务时比 GPU 原生服务格式更慢。

### EXL2 / EXL3（ExLlama）
- **部署**：仅 GPU（NVIDIA），用于单用户本地推理。
- **优点**：在消费级 NVIDIA GPU 上速度很快，且每权重位数可灵活调整；ExLlamaV3 的 EXL3 格式是 QTIP 的简化变体。
- **缺点**：仅支持 NVIDIA，也不是多租户服务格式。

### 数据中心服务格式
- **AWQ / GPTQ** int4 检查点：在 vLLM、SGLang 和 TensorRT-LLM 中使用 Marlin 系列内核提供服务。
- **FP8、NVFP4、MXFP4** 检查点：使用 NVIDIA Model Optimizer 或 llm-compressor 等工具制作，模型厂商也常正式发布（例如 IBM 的 Granite 4.2 提供 FP8、MXFP4、NVFP4、GGUF 和 MLX 版本）。
- **bitsandbytes（NF4）** 首先是训练格式：vLLM 在 v0.28.0（2026 年 8 月）将 bitsandbytes 移至树外插件。生产部署前应合并 QLoRA 适配器，并重新量化为服务格式。

---

## KV 缓存量化（VRAM 节省器）

在长上下文服务中，**KV Cache（键值缓存）** 往往比模型权重本身消耗更多 VRAM。以 Llama 3.1 8B（32 层、8 个 KV 头、头维度 128）为例：

- **BF16 KV 缓存**：每 token 128 KiB，因此 128K token ≈ 16 GB（与 BF16 权重相当），1M token ≈ 128 GB。
- **FP8 KV 缓存**：容量减半（每 token 64 KiB）；**4 位 KV**：降至四分之一。

**细微差别**：服务引擎（vLLM、SGLang、TensorRT-LLM）在写入时量化 KV，因此 FP8 KV 能以较小的质量代价，使单块 GPU 可并发处理的长上下文请求数大约翻倍；FP4 权重配合 FP8 KV 因而成为默认组合。2026 年更大的改进来自架构，而非数据类型：DeepSeek V4.1-Flash 以 FP4 存储主 KV，并使用压缩稀疏注意力，全局 KV 每 token 约 890 字节；相比之下，BF16 Llama-3.1-70B 每 token 为 320 KiB。参见 [KV 缓存与上下文缓存](../04-inference-optimization/02-kv-cache-and-context-caching.md)。

---

## 量化感知训练（QAT）

QAT 不会在模型训练完成后再进行量化（Post-training Quantization，训练后量化），而是在训练过程中模拟量化。
- **结果**：模型会学会补偿精度损失。
- **状态**：对于目标是 4 位的小模型和端侧模型，它是默认做法。Google 发布了 Gemma 的 QAT int4 版本（包括 Gemma 4 12B），Apple 表示其第三代基础模型采用了量化感知训练。量化感知蒸馏让全精度模型充当教师，是同一思路但信号更强（见[知识蒸馏](05-knowledge-distillation.md#量化感知蒸馏)）。

---

## 面试题

### 问：为什么在 QLoRA 中使用 NF4，而不是标准 Float4？

**强答案：**
标准 Float4 使用固定网格，这与 LLM 权重的真实分布并不匹配，而权重通常遵循以零为中心的正态分布。NF4（NormalFloat4）是一种在数学上经过优化的数据类型，使得每个量化区间都包含来自正态分布的相同数量的值。这可以防止权重“聚集”，并确保模型尽可能保留信息（熵），从而比标准 4 位整数获得显著更高的准确率。

### 问：AWQ 与 GPTQ 有什么不同？

**强答案：**
GPTQ 逐层量化，并利用校准集提供的近似二阶（Hessian）信息更新尚未量化的权重，以减小每层输出误差。AWQ 则具有激活感知能力：它利用校准时的激活值找出约 1% 的显著输入通道，在量化前放大这些通道以降低相对舍入误差，再将反向缩放折叠进前一个运算。所有权重最终仍为 4 位，使内核保持简单；认为 AWQ 把显著权重以更高精度存储是常见误解。AWQ 不需要反向传播或权重重建，由于较少过拟合校准集，跨领域泛化表现好，并且在 4 位及以下量化时常优于 GPTQ。

### 问：团队想将服务精度从 FP8 降为 NVFP4，以降低成本。你会检查什么？

**强答案：**
四个方面。第一，硬件：NVFP4 需要 Blackwell 或 Rubin tensor core；AMD 上的对应格式是 MXFP4，有些引擎可在加载时将 NVFP4 检查点重新量化为 MXFP4，因此要检查这条路径的质量恢复情况。第二，内核：低精度并不必然更快。NVIDIA 自己的 Dynamo 配方测得，采用 Marlin 内核时 BF16 比 NVFP4 快 80%，采用 CuTeDSL 时仍快 12%；我会在真实批次大小和上下文长度下，针对准确的模型、引擎版本和内核后端测试吞吐量与交互延迟的关系，而不是只看一个数字。第三，质量：运行我们的任务评估，而非只测困惑度，特别关注长上下文和推理任务；优先使用厂商发布或经 QAT 训练的检查点，而非自行训练后量化（PTQ）。第四，KV 缓存：权重缩小 2 倍，但长上下文中 KV 缓存可能主导内存占用，因此要将 FP4 权重与 FP8 KV 缓存配对，重新计算能容纳多少并发序列。决策依据是在我们的 SLO 下实测的每百万 token 成本，而不是位宽。

---

## 参考资料
- Dettmers et al. "QLoRA: Efficient Finetuning of Quantized LLMs" (2023)
- Frantar et al. "GPTQ: Accurate Post-Training Quantization for Generative Pre-trained Transformers" (2022)
- Lin et al. "AWQ: Activation-aware Weight Quantization for LLM Compression and Acceleration" (2023)
- Ma 等人。"The Era of 1-bit LLMs: All Large Language Models are in 1.58 Bits"（BitNet b1.58，2024）
- Open Compute Project。"OCP Microscaling Formats (MX) Specification"（2023）
- NVIDIA。[Vera Rubin NVL72](https://www.nvidia.com/en-us/data-center/vera-rubin-nvl72/)

---

*下一篇：[训练推理模型：RLVR 与 GRPO](08-rlvr-and-reasoning-models.md)*
