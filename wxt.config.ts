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
    permissions: ['storage', 'alarms', 'declarativeNetRequest', 'favicon'],
    // Redirecting a page (rather than just blocking it) needs host access.
    host_permissions: ['<all_urls>'],
    web_accessible_resources: [{ resources: ['blocked.html'], matches: ['<all_urls>'] }],
    action: { default_title: 'Block' },
  },
});
