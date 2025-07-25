const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function ensureTypescript() {
  try {
    require.resolve('typescript');
  } catch (e) {
    console.log('TypeScript not found, installing...');
    execSync('npm install typescript@latest', { stdio: 'inherit' });
  }
}

ensureTypescript();
