// svelte.config.js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

function fallbackAdapter() {
  return {
    name: '@sveltejs/adapter-vercel-fallback',
    async adapt() {
      // Local fallback when the real adapter isn't installed in this environment.
    },
    supports: {
      read: () => true
    }
  }
}

let adapter = fallbackAdapter

try {
  const vercelAdapter = await import('@sveltejs/adapter-vercel')
  adapter = vercelAdapter.default
} catch {
  adapter = fallbackAdapter
}

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter()
  }
}
