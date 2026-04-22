import esbuild from 'esbuild';
import { glob } from 'glob';

console.log('Building server for production...');

const serverFiles = await glob('server/**/*.ts', { 
  ignore: ['**/*.test.ts', '**/*.d.ts'] 
});

await esbuild.build({
  entryPoints: serverFiles,
  bundle: false,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  outdir: 'dist-server',
  outExtension: { '.js': '.js' },
  sourcemap: true,
  external: [
    '@modelcontextprotocol/sdk',
    'express',
    'cors',
    'dotenv',
    'glob',
    'googleapis',
    'd3'
  ]
});

console.log('✓ Server built to dist-server/');
