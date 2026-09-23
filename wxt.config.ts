import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Block',
    description: 'Plan your focus. Only the sites your task needs stay open.',
    permissions: ['storage'],
    action: { default_title: 'Block' },
  },
});
