# 服务器切换弹窗实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在主页面添加服务器切换弹窗功能，用户可以点击 SERVER 徽章打开弹窗，从列表中选择并切换 FMO 服务器。

**Architecture:** 使用原生 JavaScript 实现弹窗功能，通过 WebSocket API 获取服务器列表并支持切换。弹窗样式遵循现有项目设计风格，支持响应式布局。

**Tech Stack:** HTML5, CSS3, JavaScript (ES6), WebSocket API

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `index.html` | 添加服务器列表弹窗 HTML 结构 |
| `src/style.css` | 添加弹窗相关 CSS 样式 |
| `src/app.js` | 添加服务器列表获取、弹窗控制、服务器切换逻辑 |

---

### Task 1: 添加弹窗 HTML 结构

**Files:**
- Modify: `index.html:169` (在 `</body>` 前添加)

- [ ] **Step 1: 在 index.html 中添加弹窗 HTML**

在 `</body>` 标签前添加以下代码：

```html
  <!-- 服务器列表弹窗 -->
  <div id="server-modal" class="modal hidden">
    <div class="modal-overlay" id="server-modal-overlay"></div>
    <div class="modal-content">
      <div class="modal-header">
        <span>服务器列表</span>
        <button class="modal-close" id="server-modal-close">&times;</button>
      </div>
      <div class="modal-body" id="server-list-container">
        <!-- 服务器列表项动态生成 -->
      </div>
    </div>
  </div>
```

- [ ] **Step 2: 验证 HTML 结构**

在浏览器中打开 index.html，检查页面底部是否有弹窗元素（默认隐藏）。

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add server modal HTML structure"
```

---

### Task 2: 添加弹窗 CSS 样式

**Files:**
- Modify: `src/style.css:547` (在文件末尾添加)

- [ ] **Step 1: 在 src/style.css 中添加弹窗样式**

在文件末尾添加以下代码：

```css
/* ===== 服务器列表弹窗 ===== */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal.hidden {
  display: none;
}

.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
}

.modal-content {
  position: relative;
  background: var(--white);
  border-radius: 4px;
  width: 90%;
  max-width: 400px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  z-index: 1001;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  font-size: 16px;
  font-weight: 700;
  color: var(--black);
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--black);
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.modal-close:active {
  opacity: 0.5;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.server-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--black);
  cursor: pointer;
  transition: background 0.15s;
}

.server-item:active {
  background: var(--light-gray);
}

.server-item.active {
  background: var(--black);
  color: var(--white);
}

.server-item-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.server-item-check {
  margin-left: 8px;
  font-size: 18px;
}

/* 移动端优化 */
@media (max-width: 480px) {
  .modal-content {
    width: 95%;
    max-height: 70vh;
  }

  .server-item {
    padding: 14px 16px;
    font-size: 18px;
  }
}
```

- [ ] **Step 2: 运行构建命令**

```bash
npm run build
```

- [ ] **Step 3: 验证样式**

在浏览器中打开 index.html，手动在控制台执行 `document.getElementById('server-modal').classList.remove('hidden')`，检查弹窗样式是否正确显示。

- [ ] **Step 4: Commit**

```bash
git add src/style.css
git commit -m "feat: add server modal CSS styles"
```

---

### Task 3: 添加弹窗控制逻辑

**Files:**
- Modify: `src/app.js:93` (在 `bindEvents` 方法中添加)

- [ ] **Step 1: 在 app.js 的 bindEvents 方法中添加弹窗事件绑定**

在 `bindEvents` 方法的 `}` 结束符之前添加以下代码：

```javascript
    // 服务器列表弹窗
    addTouchEvent(document.getElementById('server-modal-close'), () => {
      this.closeServerModal();
    });

    addTouchEvent(document.getElementById('server-modal-overlay'), () => {
      this.closeServerModal();
    });

    addTouchEvent(document.getElementById('server-name'), () => {
      this.openServerModal();
    });
```

- [ ] **Step 2: Commit**

```bash
git add src/app.js
git commit -m "feat: add server modal event bindings"
```

---

### Task 4: 添加弹窗打开/关闭方法

**Files:**
- Modify: `src/app.js:423` (在 `fetchStationName` 方法后添加)

- [ ] **Step 1: 在 app.js 中添加 openServerModal 方法**

在 `fetchStationName` 方法后添加以下代码：

```javascript
  async openServerModal() {
    const modal = document.getElementById('server-modal');
    modal.classList.remove('hidden');
    await this.fetchStationList();
  },

  closeServerModal() {
    const modal = document.getElementById('server-modal');
    modal.classList.add('hidden');
  },
```

- [ ] **Step 2: Commit**

```bash
git add src/app.js
git commit -m "feat: add server modal open/close methods"
```

---

### Task 5: 添加服务器列表获取方法

**Files:**
- Modify: `src/app.js:433` (在 `closeServerModal` 方法后添加)

- [ ] **Step 1: 在 app.js 中添加 fetchStationList 方法**

在 `closeServerModal` 方法后添加以下代码：

```javascript
  async fetchStationList() {
    try {
      const resp = await this.sendRequest({ type: 'station', subType: 'getListRange', data: { start: 0, count: 100 } });
      if (resp.code === 0 && resp.data) {
        const list = resp.data.list || [];
        const currentResp = await this.sendRequest({ type: 'station', subType: 'getCurrent' });
        const currentUid = currentResp.code === 0 ? currentResp.data?.uid : 0;
        this.renderStationList(list, currentUid);
      }
    } catch (e) {
      console.error('获取服务器列表失败:', e);
      this.closeServerModal();
    }
  },
```

- [ ] **Step 2: Commit**

```bash
git add src/app.js
git commit -m "feat: add fetchStationList method"
```

---

### Task 6: 添加服务器列表渲染方法

**Files:**
- Modify: `src/app.js:449` (在 `fetchStationList` 方法后添加)

- [ ] **Step 1: 在 app.js 中添加 renderStationList 方法**

在 `fetchStationList` 方法后添加以下代码：

```javascript
  renderStationList(list, currentUid) {
    const container = document.getElementById('server-list-container');
    container.innerHTML = '';

    if (list.length === 0) {
      container.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--gray);">暂无可用服务器</div>';
      return;
    }

    list.forEach(station => {
      const item = document.createElement('div');
      item.className = 'server-item' + (station.uid === currentUid ? ' active' : '');
      item.innerHTML = `
        <span class="server-item-name">${station.name || '未命名'}</span>
        ${station.uid === currentUid ? '<span class="server-item-check">&#10003;</span>' : ''}
      `;
      item.addEventListener('click', () => this.switchStation(station.uid));
      container.appendChild(item);
    });
  },
```

- [ ] **Step 2: Commit**

```bash
git add src/app.js
git commit -m "feat: add renderStationList method"
```

---

### Task 7: 添加服务器切换方法

**Files:**
- Modify: `src/app.js:470` (在 `renderStationList` 方法后添加)

- [ ] **Step 1: 在 app.js 中添加 switchStation 方法**

在 `renderStationList` 方法后添加以下代码：

```javascript
  async switchStation(uid) {
    try {
      const resp = await this.sendRequest({ type: 'station', subType: 'setCurrent', data: { uid } });
      if (resp.code === 0) {
        this.closeServerModal();
        await this.fetchStationName();
        await this.fetchAllData();
      }
    } catch (e) {
      console.error('切换服务器失败:', e);
    }
  },
```

- [ ] **Step 2: Commit**

```bash
git add src/app.js
git commit -m "feat: add switchStation method"
```

---

### Task 8: 构建并验证

**Files:**
- Modify: `app.min.js` (构建生成)
- Modify: `style.min.css` (构建生成)

- [ ] **Step 1: 运行构建命令**

```bash
npm run build
```

- [ ] **Step 2: 在浏览器中验证功能**

1. 打开浏览器开发者工具
2. 点击页面上的 SERVER 徽章
3. 验证弹窗正常显示
4. 验证服务器列表正确加载
5. 点击服务器进行切换
6. 验证切换成功并更新显示
7. 验证可以通过 X 号关闭弹窗
8. 验证可以通过点击遮罩层关闭弹窗

- [ ] **Step 3: 在手机浏览器中验证功能**

1. 使用手机浏览器打开页面
2. 触摸点击 SERVER 徽章
3. 验证弹窗正常显示
4. 触摸选择服务器进行切换
5. 验证切换成功

- [ ] **Step 4: Commit**

```bash
git add app.min.js style.min.css
git commit -m "build: rebuild minified files with server modal"
```
