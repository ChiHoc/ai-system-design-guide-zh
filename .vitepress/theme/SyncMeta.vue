<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'

const { page, frontmatter } = useData()
const upstreamCommit = computed(() => String(frontmatter.value.upstreamCommit))
const hasUpstreamSource = computed(() => Boolean(frontmatter.value.hasUpstreamSource))
const shortCommit = computed(() => upstreamCommit.value.slice(0, 7))
const sourceUrl = computed(() =>
  `https://github.com/ombharatiya/ai-system-design-guide/blob/${upstreamCommit.value}/${page.value.relativePath}`,
)
</script>

<template>
  <aside class="sync-meta" aria-label="翻译同步信息">
    <span class="sync-meta__status"><i />{{ hasUpstreamSource ? `已同步至上游 ${shortCommit}` : '中文镜像项目页面' }}</span>
    <a v-if="hasUpstreamSource" :href="sourceUrl" target="_blank" rel="noreferrer">查看英文原文 ↗</a>
    <a v-else href="https://github.com/ChiHoc/ai-system-design-guide-zh/issues/new/choose" target="_blank" rel="noreferrer">反馈问题 ↗</a>
  </aside>
</template>
