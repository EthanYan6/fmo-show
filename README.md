# fmo-show
做一个简约美观，墨水屏可以直接访问fmo的网页端

![fmo-show 介绍](src/image/fmo-show介绍.jpg)

![黑白模式](src/image/fmo黑白.jpg)
![彩色模式](src/image/fmo彩色.jpg)

## 构建系统

### 目录结构

```
fmo-show/
├── src/                # 源文件目录
│   ├── app.js         # JavaScript 源文件
│   └── style.css      # CSS 源文件
├── app.min.js          # 压缩后的 JavaScript
├── style.min.css       # 压缩后的 CSS
├── build.js            # 构建脚本
├── index.html          # 主页面
└── package.json        # 项目配置
```

### 使用方法

#### 安装依赖
```bash
npm install
```

#### 构建压缩文件
```bash
npm run build
```

#### 监听模式（自动重新构建）
```bash
npm run watch
```

#### 清理生成的文件
```bash
npm run clean
```

### 构建流程

1. **JavaScript 压缩**
   - 使用 UglifyJS 压缩和混淆代码
   - 移除注释和空白
   - 添加时间戳防止缓存

2. **CSS 压缩**
   - 使用 CleanCSS 压缩样式
   - 优化选择器和属性
   - 移除冗余代码

3. **HTML 更新**
   - 自动更新 index.html 中的文件引用
   - 引用压缩后的 .min 文件

### 开发建议

- 修改代码时编辑 `src/` 目录下的源文件
- 使用 `npm run watch` 自动监听变化并重新构建
- 压缩后的文件已添加到 `.gitignore`，不会提交到版本控制
