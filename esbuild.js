// esbuild.js
const esbuild = require('esbuild');
const { nodeExternalsPlugin } = require('esbuild-node-externals');
const { writeFileSync } = require('fs');
const { join } = require('path');

const isWatch = process.argv.includes('--watch');

const baseConfig = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  minify: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/extension.js',
  plugins: [nodeExternalsPlugin()],
  external: ['vscode', 'nyc', 'mocha'],
  format: 'cjs',
  sourcemap: false,
  target: 'es2020',
  metafile: true
};

function logBuildDetails(result) {
  const details = {
    buildTime: result.metafile.buildTime,
    inputs: Object.keys(result.metafile.inputs),
    outputs: Object.keys(result.metafile.outputs)
  };

  writeFileSync(
    join(__dirname, 'build-stats.json'), 
    JSON.stringify(details, null, 2)
  );
}

async function build() {
  try {
    const buildOptions = {
      ...baseConfig,
      ...(isWatch ? { 
        watch: {
          onRebuild(error, result) {
            if (error) {
              console.error('Rebuild failed:', error);
            } else {
              console.log('Rebuild successful');
              if (result) {
                logBuildDetails(result);
              }
            }
          }
        }
      } : {})
    };

    const result = await esbuild.build(buildOptions);

    if (!isWatch) {
      logBuildDetails(result);
      console.log('Build complete! 🚀');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();