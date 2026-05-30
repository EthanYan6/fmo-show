# 服务器切换弹窗功能设计

## 概述

在主页面的 SERVER 徽章上添加点击事件，点击后弹出服务器列表弹窗，用户可以从列表中选择并切换 FMO 服务器。

## 功能描述

### 触发方式
- 电脑：鼠标点击 SERVER 徽章
- 手机：触摸点击 SERVER 徽章

### 弹窗内容
- 顶部：标题"服务器列表" + 关闭按钮（X）
- 中间：可滚动的服务器列表
- 当前服务器高亮显示（黑色背景白色文字）

### 交互流程
1. 用户点击 SERVER 徽章 → 弹出服务器列表弹窗
2. 弹窗显示从 FMO 设备获取的服务器列表（可滚动）
3. 当前服务器高亮显示
4. 点击任意服务器 → 调用 `station/setCurrent` 切换 → 关闭弹窗 → 更新显示
5. 点击 X 号或弹窗外部 → 关闭弹窗

## 技术实现

### 数据源
使用 fmo-mobile-controller 项目中的 WebSocket API：
- `station/getListRange` - 获取服务器列表
- `station/getCurrent` - 获取当前服务器
- `station/setCurrent` - 切换服务器

### 文件修改

| 文件 | 修改内容 |
|------|----------|
| `index.html` | 添加服务器列表弹窗 HTML 结构 |
| `src/style.css` | 添加弹窗相关 CSS 样式 |
| `src/app.js` | 添加服务器列表获取、弹窗控制、服务器切换逻辑 |
| `app.min.js` / `style.min.css` | 重新构建 |

### HTML 结构

```html
<div id="server-modal" class="modal hidden">
  <div class="modal-overlay"></div>
  <div class="modal-content">
    <div class="modal-header">
      <span>服务器列表</span>
      <button class="modal-close">&times;</button>
    </div>
    <div class="modal-body" id="server-list-container">
      <!-- 服务器列表项动态生成 -->
    </div>
  </div>
</div>
```

### CSS 样式要点
- 深色半透明遮罩层（rgba(0,0,0,0.5)）
- 白色弹窗内容，圆角设计
- 服务器列表可上下滚动（overflow-y: auto）
- 当前服务器高亮（background: var(--black); color: var(--white)）
- 响应式设计，支持移动端

### JS 逻辑
1. `openServerModal()` - 打开弹窗，获取服务器列表
2. `closeServerModal()` - 关闭弹窗
3. `fetchStationList()` - 获取服务器列表
4. `switchStation(uid)` - 切换服务器
5. `renderStationList(list, currentUid)` - 渲染服务器列表

## 样式规范

遵循现有项目的设计风格：
- 字体：Courier New, Consolas, monospace
- 颜色：黑色(#000)、白色(#fff)、灰色(#666)
- 边框：1px solid var(--border-color)
- 圆角：2px-4px
- 按钮：黑色背景白色文字，active 状态变为灰色

## 验证方式

1. 在电脑浏览器中打开页面，点击 SERVER 徽章，验证弹窗正常显示
2. 在手机浏览器中打开页面，触摸点击 SERVER 徽章，验证弹窗正常显示
3. 验证服务器列表可以从 FMO 设备正确获取
4. 点击服务器后，验证切换成功并更新显示
5. 验证弹窗可以通过 X 号和点击外部关闭
6. 验证在横屏和竖屏模式下都能正常工作
