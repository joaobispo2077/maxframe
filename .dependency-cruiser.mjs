/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: 'domain-does-not-import-infrastructure',
      comment: 'Domain stays free of infrastructure adapters.',
      severity: 'error',
      from: { path: '^src/domain/' },
      to: { path: '^src/infrastructure/' },
    },
    {
      name: 'renderer-does-not-import-main',
      comment: 'The renderer does not import the Electron main process.',
      severity: 'error',
      from: { path: '^packages/renderer/src/' },
      to: { path: '^packages/main/' },
    },
    {
      name: 'renderer-does-not-import-node',
      comment: 'Renderer source does not import Node built-ins.',
      severity: 'error',
      from: { path: '^packages/renderer/src/' },
      to: { dependencyTypes: ['core'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
