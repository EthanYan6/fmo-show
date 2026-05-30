const fs = require('fs');
const { execSync } = require('child_process');
const chokidar = require('chokidar');

const isWatch = process.argv.includes('--watch');

function buildJS() {
  try {
    execSync(
      'node node_modules/javascript-obfuscator/bin/javascript-obfuscator src/app.js ' +
      '--output app.min.js ' +
      '--compact true ' +
      '--control-flow-flattening true ' +
      '--string-array true ' +
      '--string-array-encoding rc4',
      { stdio: 'pipe' }
    );
    const size = (fs.statSync('app.min.js').size / 1024).toFixed(2);
    console.log(`✓ JS构建完成: app.min.js (${size}KB, obfuscated)`);
  } catch (err) {
    console.error('JS构建失败:', err.message);
  }
}

function buildCSS() {
  try {
    execSync(
      'node node_modules/clean-css-cli/bin/cleancss -o style.min.css src/style.css',
      { stdio: 'pipe' }
    );
    const size = (fs.statSync('style.min.css').size / 1024).toFixed(2);
    console.log(`✓ CSS构建完成: style.min.css (${size}KB)`);
  } catch (err) {
    console.error('CSS构建失败:', err.message);
  }
}

function build() {
  console.log('\n开始构建...');
  buildJS();
  buildCSS();
  console.log('构建完成!\n');
}

build();

if (isWatch) {
  console.log('监听文件变化...\n');

  const watcher = chokidar.watch(['src/app.js', 'src/style.css'], {
    ignoreInitial: true
  });

  watcher.on('change', (filePath) => {
    console.log(`文件变化: ${filePath}`);
    build();
  });

  watcher.on('error', (error) => {
    console.error('监听错误:', error);
  });
}
