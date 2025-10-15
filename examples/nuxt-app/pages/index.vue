
<template>
  <div class="p-6">
    <h1>Nuxt Atomic Demo</h1>
    <button @click="run">Run CreateUser</button>
    <pre>{{ output }}</pre>
  </div>
</template>

<script setup lang="ts">
const output = ref(null)
const run = async () => {
  const res = await $fetch('/api/atomic/CreateUser', {
    method: 'POST',
    body: { name: 'Ada', email: 'ada@lovelace.io', credits: 50 }
  }).catch(e => e.data || { error: e.message })
  output.value = res
}
</script>
