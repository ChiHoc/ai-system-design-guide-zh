<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{ code: string }>()
const container = ref<HTMLElement>()
let observer: MutationObserver | undefined

/** 根据当前主题重绘图表，深浅模式切换后保持文字与连线可读。 */
async function renderDiagram() {
  const mermaid = (await import('mermaid')).default
  const isDark = document.documentElement.classList.contains('dark')
  mermaid.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'neutral', securityLevel: 'strict' })
  const id = `mermaid-${Math.random().toString(36).slice(2)}`
  const { svg } = await mermaid.render(id, decodeURIComponent(props.code))
  if (container.value) container.value.innerHTML = svg
}

/** Mermaid 只在浏览器端加载，避免静态构建访问 DOM。 */
onMounted(() => {
  void renderDiagram()
  observer = new MutationObserver(() => void renderDiagram())
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="container" class="mermaid-diagram" role="img" aria-label="系统架构图" />
</template>
