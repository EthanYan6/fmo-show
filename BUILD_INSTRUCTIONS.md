# FMO Show 构建说明

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 构建项目
```bash
npm run build
```

### 3. 启动开发模式
```bash
npm run watch
```

## 目录结构

```
fmo-show/
├── src/                    # 源代码目录
│   ├── app.js             # JavaScript 源文件
│   └── style.css          # CSS 源文件
├── app.min.js              # 压缩后的 JavaScript (自动生成)
├── style.min.css           # 压缩后的 CSS (自动生成)
├── build.js                # 构建脚本
├── index.html              # 主页面 (自动更新引用)
├── package.json            # 项目配置
└── .gitignore              # Git 忽略文件
```

## 构建脚本功能

### JavaScript 压缩 (app.min.js)
- 使用 UglifyJS 进行代码压缩
- 移除注释和多余空白
- 变量名混淆
- 添加时间戳防止浏览器缓存
- 压缩率: ~35%

### CSS 压缩 (style.min.css)
- 使用 CleanCSS 进行样式压缩
- 合并相同选择器
- 优化属性值
- 移除冗余代码
- 压缩率: ~23%

### HTML 自动更新
- 自动将 `app.js` 引用更新为 `app.min.js`
- 自动将 `style.css` 引用更新为 `style.min.css`

## 开发工作流

### 修改代码
1. 编辑 `src/app.js` 或 `src/style.css`
2. 运行 `npm run build` 或使用 `npm run watch` 自动构建
3. 刷新浏览器查看效果

### 监听模式
```bash
npm run watch
```
此命令会监听源文件变化，自动重新构建。

### 清理构建文件
```bash
npm run clean
```
删除生成的 `.min` 文件。

## 部署说明

### 生产环境
1. 运行 `npm run build` 生成压缩文件
2. 部署以下文件到服务器:
   - `index.html`
   - `app.min.js`
   - `style.min.css`
   - `svg/` 目录
   - `LICENSE`

### 注意事项
- `app.min.js` 和 `style.min.css` 已添加到 `.gitignore`
- 这些文件不会提交到 Git 仓库
- 每次部署前需要运行 `npm run build`

## 故障排除

### 构建失败
1. 确保已安装依赖: `npm install`
2. 检查 Node.js 版本 (建议 14+)
3. 查看错误信息并修复源代码

### 文件引用错误
1. 运行 `npm run build` 重新生成压缩文件
2. 检查 `index.html` 中的引用是否正确
3. 确保所有文件在正确的位置

### 性能优化
- 压缩后的文件会添加时间戳，防止浏览器缓存旧版本
- 生产环境建议配置服务器缓存策略
- 可以使用 CDN 加速静态资源加载