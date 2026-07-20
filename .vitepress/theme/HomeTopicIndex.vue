<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

const { frontmatter } = useData()
const shortCommit = computed(() => String(frontmatter.value.upstreamCommit).slice(0, 7))

const topics = [
  ['面试准备', '高频问题、回答框架、白板练习与岗位趋势。', '/00-interview-prep/'],
  ['基础', 'Token、Attention、Transformer、Embedding 与推理流水线。', '/01-foundations/'],
  ['模型版图', '模型分类、能力评估、价格成本与选型方法。', '/02-model-landscape/'],
  ['训练与适配', '微调、LoRA、对齐、蒸馏、合成数据与量化。', '/03-training-and-adaptation/'],
  ['推理优化', 'KV Cache、批处理、PagedAttention、服务与边缘部署。', '/04-inference-optimization/'],
  ['Prompt 与上下文', 'Prompt、上下文工程、结构化生成与注入防御。', '/05-prompting-and-context/'],
  ['检索系统', 'RAG、向量数据库、重排、GraphRAG 与多模态检索。', '/06-retrieval-systems/'],
  ['Agentic Systems', '推理循环、工具、规划、多 Agent、状态与安全。', '/07-agentic-systems/'],
  ['Memory 与状态', '短期上下文、长期记忆、语义缓存与状态模式。', '/08-memory-and-state/'],
  ['框架与工具', 'LangChain、LangGraph、DSPy、LlamaIndex 与选型。', '/09-frameworks-and-tools/'],
  ['文档处理', 'Vision-LLM OCR、布局分析与结构化提取。', '/10-document-processing/'],
  ['基础设施与 MLOps', 'GPU、服务网关、CI/CD、FinOps 与 Token 经济。', '/11-infrastructure-and-mlops/'],
  ['安全与访问控制', 'LLM 安全、身份认证、授权与多租户隔离。', '/12-security-and-access/'],
  ['可靠性与安全', 'Guardrail、集成方法、可靠性模式与 AI 治理。', '/13-reliability-and-safety/'],
  ['评估与可观测性', '评估体系、追踪、基准测试与排行榜。', '/14-evaluation-and-observability/'],
  ['AI 设计模式', '生产系统设计模式目录与常见反模式。', '/15-ai-design-patterns/'],
  ['案例研究', '企业 RAG、Agent、金融、合规与多租户真实架构。', '/16-case-studies/'],
  ['工具与计算机 Agent', '工具生态、Computer Use、OpenClaw 与治理。', '/17-tool-use-and-computer-agents/'],
  ['语音与音频 Agent', '实时语音 Agent 的延迟、交互和生产架构。', '/18-voice-and-audio-agents/'],
  ['多模态生成', '图像、视频与跨模态生成系统设计。', '/19-multimodal-generation/'],
]
</script>

<template>
  <section class="topic-index" aria-labelledby="topic-heading">
    <h2 id="topic-heading">主题索引</h2>
    <div class="topic-index__grid">
      <a v-for="([title, detail, link], index) in topics" :key="title" :href="withBase(link)" class="topic-row">
        <span class="topic-row__number">{{ String(index).padStart(2, '0') }}</span>
        <span><strong>{{ title }}</strong><small>{{ detail }}</small></span>
        <span aria-hidden="true">→</span>
      </a>
    </div>
    <div class="home-sync">
      <span class="home-sync__icon" aria-hidden="true">↻</span>
      <span><strong>已同步至上游 {{ shortCommit }}</strong><small>本指南持续与英文仓库保持同步，确保内容及时、准确、可靠。</small></span>
      <a href="https://github.com/ChiHoc/ai-system-design-guide-zh/commits/main">查看更新日志 →</a>
    </div>
  </section>
</template>
