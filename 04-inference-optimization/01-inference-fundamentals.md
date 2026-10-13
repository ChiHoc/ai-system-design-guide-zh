# 推理基础

推理是从已训练模型生成预测的过程。为了处理重推理与智能体工作负载，推理优化已从“简单加速”转向“架构效率”；硬件范围也从 Hopper（H100/H200）、Blackwell（B200/B300）扩展到 Vera Rubin，NVIDIA 于 2026 年 5 月将后者推进全面量产。

## 目录

- [推理的两个阶段](#推理的两个阶段)
- [瓶颈：计算受限 vs. 内存受限](#瓶颈-计算受限-vs-内存受限)
- [性能指标：TTFT、TPOT 和 Goodput](#性能指标)
- [硬件赋能的优化（FP8 和 FP4）](#硬件赋能的优化-fp8-和-fp4)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 推理的两个阶段

LLM 推理不是单一操作；它由两个不同的计算阶段组成。

### 1. 预填充阶段（Prompt 处理）
模型在一次前向传递中处理整个输入提示词。
- **计算**：高并行矩阵乘法。
- **瓶颈**：**计算受限**（受 GPU TFLOPS 限制）。
- **时间复杂度**：线性层为 $O(N)$，完整注意力为 $O(N^2)$；$N$ 为输入长度（但计算经过并行化）。

### 2. 解码阶段（Token 生成）
模型逐个生成 token，每个 token 都依赖前面的 token。
- **计算**：矩阵向量运算；每一步都从内存读取每个权重（及该序列的 KV 缓存），为每条序列生成一个 token。
- **瓶颈**：**内存受限**（受内存带宽限制）。
- **时间复杂度**：$O(M)$，其中 $M$ 为输出长度（顺序执行）。

部分 2026 年的架构有意为两个阶段分配不同的计算预算：DeepSeek V4.1-Flash 在预填充阶段每 token 激活约 8B 参数，解码阶段则激活 16B。这打破了常见的“活跃参数 × token 数”成本估算，也是分别规划预填充与解码容量的另一个原因。

---

## 瓶颈：计算受限 vs. 内存受限

理解系统的瓶颈所在，对于选择合适的优化至关重要。

| 阶段 | 瓶颈 | 原因 | 主要优化 |
|-------|------------|------|----------------------|
| **预填充** | 计算（FLOPs） | 并行处理会让 GPU 的算术单元饱和。 | FlashAttention、FP8/FP4 精度、前缀缓存。 |
| **解码** | 内存带宽 | 对于*每一个 token*，都必须从 HBM 加载权重。 | 量化（4 位）、GQA/MLA、批处理、推测解码。 |

**内存墙洞察**
内存带宽的增长没有算力快。H100 的稠密 BF16 性能约为 1 PFLOPS，HBM3 带宽为 3.35 TB/s，约合每字节 300 FLOPs。按 NVIDIA 的机架数据估算，一块 Vera Rubin GPU 的 NVFP4 性能约为 50 PFLOPS（72 块 GPU 合计 3,600 PFLOPS），HBM4 带宽为 19.2 TB/s，约合每字节 2,600 FLOPs。解码步骤需要较大的批次（或推测 token）才能用满算力，因此解码是生产优化的主要目标；HBM 容量如今还受供应约束（据 The Register 报道，Micron 预计需求到 2028 年都将超过供应），也必须纳入容量规划。

---

## 性能指标

| 指标 | 全称 | 目标 | 重要性 |
|--------|-----------|------|------------|
| **TTFT** | Time To First Token | < 200ms | 用户感知响应速度。 |
| **TPOT / ITL** | Time Per Output Token / Inter-Token Latency | < 30ms | 阅读速度和对话流畅性。 |
| **Throughput** | Tokens/Second (Agg) | 最大化 | 决定每次查询成本。 |
| **Goodput** | 同时满足 TTFT 和 ITL SLO 的请求数/秒 | 最大化 | 在目标 SLO 下实际可交付的服务能力。 |
| **Latency** | End-to-End Time | < 2.0s | 智能体完整往返耗时。 |

### 在帕累托曲线上测量，而非只看批次大小为 1

批次大小会让吞吐量与单用户速度相互制约，因此单一数字无法说明运行点。厂商宣传的“每秒 token 数”通常是批次大小为 1 时的最高速度，客户在负载下很少见到。应在自己的 SLO 和具有代表性的流量上，比较系统的**吞吐量与交互速度曲线**。

运行点的影响很大：SemiAnalysis 的 InferenceX AgentX 场景（智能体、多轮、高前缀复用）报告，在按自有设备成本计算、DeepSeek V4 Pro 每用户 170 tok/s 时，Vera Rubin NVL72 的单位 TCO 吞吐量约为 GB300 的 **67 倍**；但在更贴近现实的每用户 80 tok/s P90、按 3 年租赁价格计算时，其总 token 量仅比 GB300 NVL72 **高 62%**。硬件和模型相同，仅运行点与成本模型不同，宣传数字就相差 40 倍。MLPerf Inference v6.1（2026 年 9 月）因此也加入了智能体和端到端 RAG 测试。

---

## 硬件赋能的优化（FP8 和 FP4）

**FP8（8 位浮点数）**在 Hopper 及后续硬件上获得原生支持，仍是权重、尤其是 KV 缓存的稳妥默认精度。

- **收益**：tensor core 峰值吞吐量最高为 FP16/BF16 的 2 倍；经过校准后，精度损失通常较小（<1%）。
- **工作原理**：FP8 E4M3 将更多位分配给指数范围，而非尾数精度，因此能比 INT8 更好地覆盖 LLM 激活值的动态范围，所需校准也更简单。

**FP4（NVIDIA Blackwell 和 Rubin 上的 NVFP4，以及 AMD 和 Blackwell 上的 MXFP4）**是 2026 年受关注的服务精度：FP4 权重搭配 FP8 KV 缓存。NVIDIA 将 Vera Rubin NVL72 的机架 NVFP4 性能标为 3,600 PFLOPS；MLPerf Inference v6.1 中也有提交从 FP8 转向 FP4。

**资深级细节**：精度选择如今取决于内核与硬件，而非只看位宽。NVIDIA 自己的 Nemotron 3.5 Lightning Dynamo 配方测得，使用 Marlin 内核时 BF16 比 NVFP4 快 80%，使用 CuTeDSL 内核时仍快 12%。服务框架采用分块和每张量动态缩放，以防异常值损害模型；但 FP4 是否更快，仍取决于实际运行的引擎版本和内核后端。参见[量化深度解析](../03-training-and-adaptation/07-quantization-deep-dive.md)。

---

## 面试题

### 问：为什么 LLM 生成比分类更慢？

**强答案：**
分类是一个“仅预填充”的任务；它在一次并行传递中处理整个输入并产生单个输出，因此计算效率最优。然而，LLM 生成是**自回归**的。每个 token 都依赖前一个 token，迫使系统进入顺序的“解码”循环。由于这个循环中的每一步都受内存限制（读取千兆字节级的权重和 KV 缓存，为每条序列生成一个 token），系统的大部分时间都消耗在等待内存传输，而不是做数学计算。

### 问：如何优化 TTFT 与 TPOT？

**强答案：**
要优化 **TTFT**，必须优化预填充阶段：使用 FlashAttention-3，提高计算并行度（张量并行），或者使用前缀缓存（Prefix Caching）为常见提示词跳过整个预填充阶段。  
要优化 **TPOT**，必须优化解码阶段的内存带宽：使用量化（4 位权重）减少从 VRAM 移动的数据量，使用分组查询注意力（GQA）减小 KV cache 大小，或者使用推测解码（Speculative Decoding）在一次内存加载中生成多个 token。

### 问：厂商宣传某加速器“每秒 3,000 token”。你如何评估？

**强答案：**
我会先问，这个数字是曲线上的哪一个点。批次大小为 1 时的单用户最高速度很难说明成本，因为成本取决于产品所需交互速度下的总吞吐量。因此，我会在自己的模型、上下文长度及前缀复用模式（智能体流量会高度复用长前缀）下，要求或测量完整的吞吐量与单用户速度曲线，读取满足 TTFT 和 ITL SLO 时的 goodput。随后按真实的租赁或自有设备价格换算为每百万 token 成本，而不是采用标称 TCO。差距可能极大：一项 2026 年基准显示，相同 Rubin 与 GB300 的对比，仅因运行点和购买或租赁方式不同，结果可从 67 倍变为 1.6 倍。我还会检查长上下文下的内存上限（依赖大量 SRAM 的设计可能严重限制批次大小）、是否启用推测解码，以及结果是来自 MLPerf、InferenceX 等独立测试，还是厂商自行搭建的环境。

---

## 参考资料
- Pope et al. "Efficiently Scaling Transformer Inference" (2022)
- NVIDIA. "Transformer Engine Documentation" (2024)
- vLLM Blog. "Understanding LLM Inference Latency" (2023)
- SemiAnalysis. ["Vera Rubin NVL72: agentic inference"](https://newsletter.semianalysis.com/p/vera-rubin-nvl72-agentic-inference) (2026)
- MLCommons. [MLPerf Inference v6.1 results](https://mlcommons.org/2026/09/mlperf-inference-v6-1-results/) (2026)

---

*下一篇：[KV Cache 和上下文缓存](02-kv-cache-and-context-caching.md)*
