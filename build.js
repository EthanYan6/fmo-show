const fs = require('fs');
const path = require('path');
const UglifyJS = require('uglify-js');
const CleanCSS = require('clean-css');
const chokidar = require('chokidar');

const isWatch = process.argv.includes('--watch');

function buildJS() {
  try {
    const code = fs.readFileSync('src/app.js', 'utf8');

    // 压缩配置
    const options = {
      compress: {
        drop_console: false,
        dead_code: true,
        unused: true,
        passes: 2
      },
      mangle: {
        toplevel: false,
        properties: false
      },
      output: {
        comments: false,
        beautify: false
      }
    };

    const result = UglifyJS.minify(code, options);

    if (result.error) {
      console.error('JS压缩错误:', result.error);
      return;
    }

    // 添加简单的混淆层
    let minified = result.code;

    // 添加时间戳注释（防止缓存）
    const timestamp = Date.now();
    minified = `/*${timestamp}*/${minified}`;

    fs.writeFileSync('app.min.js', minified);
    console.log(`✓ JS构建完成: app.min.js (${(minified.length / 1024).toFixed(2)}KB)`);
  } catch (err) {
    console.error('JS构建失败:', err.message);
  }
}

function buildCSS() {
  try {
    const input = fs.readFileSync('src/style.css', 'utf8');

    const result = new CleanCSS({
      level: 2,
      compatibility: 'ie9+',
      format: false
    }).minify(input);

    if (result.errors && result.errors.length > 0) {
      console.error('CSS压缩错误:', result.errors);
      return;
    }

    // 添加时间戳
    const timestamp = Date.now();
    const output = `/*${timestamp}*/${result.styles}`;

    fs.writeFileSync('style.min.css', output);
    console.log(`✓ CSS构建完成: style.min.css (${(output.length / 1024).toFixed(2)}KB)`);
  } catch (err) {
    console.error('CSS构建失败:', err.message);
  }
}

function updateHTML() {
  try {
    let html = fs.readFileSync('index.html', 'utf8');

    // 替换JS引用
    html = html.replace(
      /<script src="app\.js"><\/script>/,
      '<script src="app.min.js"></script>'
    );

    // 替换CSS引用
    html = html.replace(
      /<link rel="stylesheet" href="style\.css">/,
      '<link rel="stylesheet" href="style.min.css">'
    );

    fs.writeFileSync('index.html', html);
    console.log('✓ HTML引用已更新');
  } catch (err) {
    console.error('HTML更新失败:', err.message);
  }
}

function build() {
  console.log('\n开始构建...');
  buildJS();
  buildCSS();
  updateHTML();
  console.log('构建完成!\n');
}

// 初始构建
build();

// 监听模式
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