# 实时语音智能体（Real-Time Voice Agents）

语音智能体（voice agent）是一个围绕 LLM（大语言模型）的软实时媒体系统（soft-real-time media system）。推理部分相对简单；难点在于**时序**（timing）：把音频接入、判断人类何时真正停顿、思考，并足够快地把音频反馈出来，让对话感觉“活着”。一旦时序失衡，用户就会插话、重复自己，最后挂断。本章覆盖架构、延迟预算、2026 年技术栈，以及生产环境中的故障模式。

补充说明：如果你在构建电话（telephony）、客服（support）或语音优先产品（voice-first products），请阅读本章；否则可先看 [agent fundamentals](../07-agentic-systems/01-agent-fundamentals.md) 和 [tool-use](../17-tool-use-and-computer-agents/01-tool-use-landscape.md) 章节，先掌握可迁移的部分。下文中的具体模型名、价格和延迟数据是 2026 年中期快照，变化很快；引用前请先核实。

## 目录（Table of Contents）

- [两种架构（The Two Architectures）](#两种架构-the-two-architectures)
- [按组件拆解的流水线（The Pipeline, Component by Component）](#按组件拆解的流水线-the-pipeline-component-by-component)
- [延迟预算（Latency Budgets）](#延迟预算-latency-budgets)
- [2026 年技术栈（The 2026 Stack）](#_2026-年技术栈-the-2026-stack)
- [生产关注点（Production Concerns）](#生产关注点-production-concerns)
- [真实成熟度（Honest Maturity）](#真实成熟度-honest-maturity)
- [面试题（Interview Questions）](#面试题-interview-questions)
- [参考资料（References）](#参考资料-references)

---

## 两种架构（The Two Architectures）

每个语音智能体都属于以下两种形态之一。

**级联流水线（Cascaded pipeline）：** `mic -> VAD -> streaming STT -> endpointing -> LLM -> streaming TTS -> speaker`。音频在每个边界都转为**文本**（text），每一层都是可替换组件，通常来自不同供应商。

**语音到语音（Speech-to-speech, S2S）：** 单一多模态模型直接摄入音频帧并输出音频帧，文本仅作为副通道（side channel）产生。2026 年的代表有 OpenAI 的 Realtime API、Google 的 Gemini Live native audio，以及 AWS Nova Sonic。

| Dimension | Cascaded | Speech-to-speech |
|-----------|----------|------------------|
| **Latency floor** | 在朴素实现中更高；在完整 streaming 下，总体收敛到 `max(stage)`，大约 400-800ms | 结构上更低（没有文本往返） |
| **Controllability** | 高：每次交接都有文本，可独立替换 LLM/voice，便于 A/B 测试和注入 prompts | 低：单一模型，供应商替换意味着重新架构 |
| **Interruptions** | 可确定性、运行时可控（VAD 触发、取消 TTS、回滚 turn） | 更自然的 full-duplex（全双工），但失败更不透明 |
| **Cost** | 可预测，通常按分钟计费 | 按 token 计费，每 turn 重新发送音频历史，随通话时长增长 |
| **Observability** | 每个边界都有文本制品，便于日志记录和审计 | 需要并行转录流才能做日志 |
| **Prosody / emotion** | 由文本重建，因此情感表达常在 STT 瓶颈处丢失 | 原生保留并生成语气、笑声和重音 |
| **Language / code-switching** | 受每个组件边界限制 | 更自然地处理中途代码切换 |

**决策指引。** 当你需要按组件排障和审计链路、合规（HIPAA、金融）、供应商灵活性、深度工具调用，以及可预测成本时，选择**级联（cascaded）**。这在 2026 年是企业生产环境中的默认方案，部分原因是生态里可替换的 STT 和 TTS 供应商很多，而 S2S 供应商只有少数。  
当你需要最高的对话自然度、最低的打断延迟、富有表现力的声音（陪伴、教练、消费级演示），并且可以接受较弱的可调试性和波动成本时，选择 **S2S**。一种常见的**混合（hybrid）**方案是：对话核心走 S2S，并行保留一条 STT 流，仅用于日志和评测。

对两者都适用的现实判断是：没有谁默认就更快。WebSocket 建连、VAD 配置、网络跳数、编解码器和采样率才是主导因素，而调优良好的级联在许多部署中可以和 S2S 持平。

---

## 按组件拆解的流水线（The Pipeline, Component by Component）

**语音活动检测（Voice Activity Detection, VAD）。** 第一层会实时把每个音频帧分类为 speech 或 silence。Silero VAD 是事实标准开源实现之一，已原生集成到主要框架中，额外开销只有大约 10-50ms。VAD 本身无法分辨句中停顿和回合结束，这就是下一个问题。

**语义端点检测和轮次切换（semantic endpointing and turn-taking），这是核心。** 常见两种方式：
- **静音阈值端点检测（Silence-threshold endpointing）** 等待 N 毫秒的静音。简单，但它会把代价加在每一轮：800ms 的 timeout 会在流水线甚至还没开始前，就额外吃掉将近 1 秒。
- **学习型轮次检测（Learned turn detection）** 读取部分转录并预测语义是否完整，在尾随静音前就提前触发。2026 年的具体实现包括一个小型 transformer turn-detector（约 135M 参数模型，从一个小基座微调而来，在 CPU 上以几十毫秒运行，并有多语言变体），以及 streaming-STT endpointing：它会发出一个学习得到的 end-of-turn token，并提供可调的置信度阈值。收益是把智能体的 turn gap 收紧到约 300ms，同时避免过早打断用户。

**抢话 / 插话（barge-in / interruption）。** 轮次检测在智能体说话时也保持激活。当用户的轨道触发 VAD 时，运行时会取消当前 TTS 流，回滚被打断的 LLM 回合，并重新进入 STT。WebRTC 传输在处理中断方面明显优于 WebSocket，因为 UDP 在丢包时不会发生队头阻塞（head-of-line blocking）。

**流式转录（Streaming transcripts）。** 流式 STT 会在用户说话时每约 50ms 输出一次部分转录，因此转录与说话并行，用户停下后几乎不再增加额外时延。需要区分三种 STT 延迟：部分转录延迟、最终转录延迟（speech ends 之后），以及端点检测延迟。语音智能体优化的是最后一种。

**TTS 和首音频到达时间（TTFA, time-to-first-audio）。** 智能体必须在第一个可说词出现时就开始说，而不是等整句都生成完。TTS 会按 chunk 流式输出音频；TTFA（time to the first audio byte）是核心指标，现代流式引擎会把首个 chunk 的目标压到约 100-200ms。

---

## 延迟预算（Latency Budgets）

在自然的人类对话中，一个人说完到另一个人开始说之间的间隔平均约为 **~200ms**。当端到端低于大约 700ms 时，智能体会显得更像人；高于这个值，来电者就会开始插话和重复。一个完全流式的级联（fully-streaming cascade）在单轮中的现实预算如下：

| Stage | Typical budget | Notes |
|-------|---------------|-------|
| Network transport (one way) | 30-80ms | WebRTC/UDP 可低于 100ms；SIP 每跳增加 20-50ms |
| VAD frame decision | 10-50ms | 持续运行 |
| Endpointing / turn decision | 150-300ms | 主要由静音/置信度配置决定 |
| STT final transcript | 50-100ms after speech ends | 用户说话时部分转录已经在流式输出 |
| **LLM time-to-first-token** | **150-400ms**（也可能更高） | 通常是最大的可控项 |
| TTS time-to-first-audio | 100-200ms | 只算首个 chunk；其余持续流式输出 |
| **Practical end-to-end (TTFA)** | **~600-800ms** is good | 流式化会把总时延压向 `max(stage)`，而不是相加 |

朴素的非流式栈通常会达到 1000-2000ms 甚至更差。按影响排序，杠杆是：**把一切都流式化**（部分转录、token streaming、chunked TTS，把求和变成取最大）；**调优 endpointing**（用学习型轮次检测代替固定的长静音超时）；**选择更快的首 token 路径**（更小/更快的模型，或 speculative drafting，因为 LLM time-to-first-token 往往是长杆）；**按 TTFA 选择 TTS，并在第一分句就开始出声**；以及**在 WebRTC over UDP 上运行**，把 jitter 控制在约 20ms 以内。

---

## 2026 年技术栈（The 2026 Stack）

把具体名称、版本和价格都视为某一时点的快照。

- **编排框架（Orchestration frameworks）：** LiveKit Agents 和 Pipecat 是开源领跑者（WebRTC-native，支持自带（bring-your-own）STT/LLM/TTS，或接入 S2S 模型，并提供 VAD 和 turn-detector）。Vapi、Retell 和 Bland 是托管平台（managed platforms）。把工程时间算进去后，托管方案在每月约 10k 分钟以下通常更便宜；而框架方案在更高用量下通常每通话（per call）更便宜。
- **STT：** Deepgram 和 AssemblyAI 领跑实时流式转录，两者都内置 endpointing，公开的 word error rate（WER）大约在 ~6-7%（视 benchmark 而定）。
- **S2S realtime models：** OpenAI 的 Realtime API（`gpt-realtime` 家族；请查看当前 [model taxonomy](../02-model-landscape/01-model-taxonomy.md)，因为后缀变化很快）、Google Gemini Live native audio，以及 AWS Nova Sonic。它们支持 function calling；对于 OpenAI，还支持在 realtime session 内使用 remote MCP servers。
- **TTS：** Cartesia 和 ElevenLabs 在低延迟流式方面领先；厂商宣称的 TTFA 范围从几十毫秒到约 200ms 不等，且受 benchmark 影响。
- **Transport：** 客户端到智能体媒体层使用 WebRTC（UDP、Opus codec）；服务端到模型这一段用 WebSocket（TCP）更简单，但在丢包时会有队头阻塞。常见的混合方案是：客户端到 relay 用 WebRTC，relay 到模型 API 用 WebSocket。SIP 会桥接到电话网络（PSTN），其中每个运营商跳数都会增加延迟。

---

## 生产关注点（Production Concerns）

**ASR 错误是最主要的故障。** 需要记住的一条基准结论是：身份识别是瓶颈，因为一旦智能体听错姓名、邮箱或验证码，后续一切都会失败。防御手段包括：设置置信度阈值，把低置信度片段路由成澄清问题（“您是说……吗？”）；以及对姓名、SKU 和字母数字串做自定义词表（custom vocabulary）/关键词增强（keyword boosting）。

**对话中途工具调用（Tool calls mid-conversation）。** 两种架构都支持 function calling。工具运行时应插入一句口头填充语（比如“我先帮您查一下”），这样工具执行期间线路不会显得空白。

**跨轮次记忆（Memory across turns）。** S2S 模型会在每个 turn 重新发送音频历史，因此 token 成本和上下文压力会随通话长度增长；应裁剪工具输出并做摘要。语音路径上的跨会话持久记忆（durable cross-session memory）仍然偏弱；把记忆保留在文本/LLM 层（在级联里更便宜）更合适。见 [Agent Memory and State](../07-agentic-systems/05-agent-memory-and-state.md)。

**电话系统（Telephony）。** SIP trunks 桥接到 PSTN 时会提供 8kHz mu-law 音频，如果不处理好，会破坏 VAD 和轮次检测；这在电话线路上是一个已知的 S2S 失效模式。

**可观测性与评测（Observability and evaluation）。** 级联栈天然会产出文本制品；S2S 则需要并行转录流。值得知道的 benchmark 是 **tau-Voice**（Sierra，arXiv:2603.13686），它把 agentic tool-use 评测扩展到带噪声、口音和打断的 full-duplex voice，并区分语音特有的失败类型：ASR 听错、打断处理不当、多步上下文丢失，以及从掉线中恢复失败。见 [Evaluating Agentic Systems](../07-agentic-systems/10-evaluating-agentic-systems.md)。

**成本：音频 token 比文本贵得多。** 对于 OpenAI 的 realtime model，音频输入据称约为文本输入的 8 倍，音频输出约为文本输出的 4 倍，而且音频是按时长编码的（非常粗略地说，用户语音约 1 token / 100ms，合成语音约 1 token / 50ms）。Prompt caching 和裁剪工具输出据称可显著降低每分钟成本。语音智能体应按每分钟预算，而不是按抽象的 token 预算；另见 [FinOps and Token Economics](../11-infrastructure-and-mlops/04-finops-and-token-economics.md)。

---

## 真实成熟度（Honest Maturity）

2026 年已经做得不错的是：在调优后的级联和 S2S 上实现次秒级、自然感较强的单轮延迟；学习型轮次检测优于静音阈值；级联运行时可实现确定性的 barge-in；S2S 的韵律更丰富；以及一个较成熟的工具生态。

仍然困难的是：全双工自然性（自然重叠、backchanneling、可靠的中途打断）；真实世界里的噪声音频；句中 code-switching；以及语音路径中的长上下文记忆。tau-Voice 的核心提醒是：即使是最前沿的语音智能体，在真实噪声条件下也只能保留与等价文本智能体相比约 **30-45%** 的任务能力，而且绝大多数失败来自智能体行为，而不是测试框架。**语音还不是“加了麦克风的文本智能体”**。设计时要考虑这个差距：对关键槽位（姓名、验证码、金额）显式确认，保留人工接管路径，并在噪声和中断条件下评测，而不要只在干净音频上测试。

---

## 面试题（Interview Questions）

### Q: 讲讲语音智能体的延迟预算。毫秒都花在哪，最重要的杠杆是什么？

**Strong answer:**
自然对话的回合间隔大约是 200ms，而端到端低于 ~700ms 时，智能体会更像真人。预算会拆到网络传输（单向 30-80ms）、VAD（10-50ms）、endpointing（150-300ms，由你的静音或置信度配置决定）、STT final transcript（用户停顿后 50-100ms，因为 partials 已在说话期间流式输出）、LLM time-to-first-token（150-400ms，通常是最长的一段）、以及 TTS time-to-first-audio（100-200ms）。最重要的杠杆是把一切都流式化，因为它把各阶段的总和变成大致取最大：partial transcripts、token streaming 和 chunked TTS 彼此重叠，而不是串行执行。之后，用学习型 turn detector 替代固定的长静音超时，可以去掉每轮附加税；再选更快的首 token 模型，就能直接打最长的那一段。

### Q: Cascaded pipeline 还是 speech-to-speech：你怎么选？

**Strong answer:**
如果你需要 auditability、compliance、供应商灵活性、深度工具调用和可预测成本，就选级联，因为每个边界都有文本，带来日志、可替换组件和 moderation hooks；这是企业默认方案。如果你最看重对话自然性和最低打断延迟，并且可以接受不透明失败、更少供应商，以及随通话时长增长的 token 成本，因为它每 turn 都会重新发送音频历史，那就选 speech-to-speech。很多团队会用混合方案：对话核心走 S2S，同时并行一条 STT 流只做日志和评测。我不会假设 S2S 天然更低延迟；调优良好的级联同样有竞争力，而传输和 endpointing 配置在两边都占主导。

---

## 参考资料（References）

- Sierra, "tau-Voice: advancing agent benchmarking to knowledge and voice" arXiv:2603.13686, and [blog](https://sierra.ai/blog/bench-advancing-agent-benchmarking-to-knowledge-and-voice)
- OpenAI, [Introducing the Realtime API](https://openai.com/index/introducing-the-realtime-api/)
- LiveKit, [turn detection for voice agents](https://livekit.com/blog/turn-detection-voice-agents-vad-endpointing-model-based-detection) and [a transformer for end-of-turn detection](https://livekit.com/blog/using-a-transformer-to-improve-end-of-turn-detection)
- AssemblyAI, [turn detection and endpointing](https://www.assemblyai.com/blog/turn-detection-endpointing-voice-agent)
- Deepgram, [speech-to-speech vs cascade architecture](https://deepgram.com/learn/speech-to-speech-vs-cascade-voice-agent-architecture)
- Pipecat, [open-source voice agent framework](https://github.com/pipecat-ai/pipecat)
- Cekura, [voice AI evaluation metrics](https://www.cekura.ai/blogs/voice-ai-evaluation-metrics)

---

*Previous: [Safety and Governance](../17-tool-use-and-computer-agents/07-safety-and-governance.md) · Next: [Multimodal Generation](../19-multimodal-generation/01-multimodal-generation.md)*
