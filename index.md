---
layout: home
title: AI 系统设计指南
titleTemplate: false
hero:
  text: 构建生产级 AI 系统的完整指南
  tagline: 从 LLM 基础、RAG、Agent 到评估与可靠性，持续跟进上游更新。
  image:
    src: /architecture-blueprint.svg
    alt: AI 系统分层架构图
  actions:
    - theme: brand
      text: 开始阅读
      link: /01-foundations/01-llm-internals
    - theme: alt
      text: 查看 GitHub
      link: https://github.com/ChiHoc/ai-system-design-guide-zh
features:
  - title: 准备 AI 系统设计面试
    details: 覆盖常见考点与高频系统设计题，附参考架构与思路。
    link: /00-interview-prep/
  - title: 构建生产级 RAG
    details: 深入检索增强生成的全流程，从索引到检索与优化。
    link: /06-retrieval-systems/01-rag-fundamentals
  - title: 设计可靠的 Agent
    details: Agent 架构、工具使用与编排，提升可控性与成功率。
    link: /07-agentic-systems/01-agent-fundamentals
  - title: 评估与观测
    details: 评估方法、指标体系与观测实践，保障系统质量。
    link: /14-evaluation-and-observability/01-llm-evaluation
---

<section class="learning-path-section" aria-labelledby="learning-path-title">
  <h2 id="learning-path-title">学习路径</h2>
  <div class="learning-paths">
  <a href="./01-foundations/01-llm-internals">
    <span>01 · 从零入门</span>
    <strong>基础 → 模型 → Prompt → RAG</strong>
    <small>建立完整的 AI 系统设计知识骨架。</small>
  </a>
  <a href="./00-interview-prep/01-question-bank">
    <span>02 · 面试冲刺</span>
    <strong>题库 → 框架 → 白板 → 案例</strong>
    <small>围绕高频问题训练结构化表达。</small>
  </a>
  <a href="./11-infrastructure-and-mlops/01-llm-infrastructure">
    <span>03 · 生产进阶</span>
    <strong>基础设施 → 安全 → 可靠性 → 评估</strong>
    <small>把原型扩展为可运营的生产系统。</small>
  </a>
  </div>
</section>

<HomeTopicIndex />
