const RESPONSE_ALIASES = {
  station: { getListRange: 'getListResponse' }
};

function normalizeHost(address) {
  if (!address) return '';
  return address.trim().replace(/^(https?|wss?):?\/\//, '').replace(/\/+$/, '');
}

const App = {
  ws: null,
  eventsWs: null,
  connected: false,
  protocol: 'ws',
  reconnectAttempts: 0,
  maxReconnectAttempts: 10,
  requestQueue: [],
  isProcessing: false,
  datetimeTimer: null,
  stationPollingTimer: null,
  myCallsign: '',

  init() {
    this.bindEvents();
    this.loadSettings();
    this.showPage('main-page');
    this.startDatetime();
    this.updateConnectionText(false);
    this.initOrientationDetection();
    this.checkFirstVisit();
  },

  bindEvents() {
    // 添加移动端触摸事件支持
    const addTouchEvent = (element, handler) => {
      if (!element) return;

      // 桌面端点击事件
      element.addEventListener('click', (e) => {
        e.preventDefault();
        handler();
      });

      // 移动端触摸事件
      element.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handler();
      }, { passive: false });
    };

    addTouchEvent(document.getElementById('back-btn'), () => {
      this.showPage('main-page');
    });

    addTouchEvent(document.getElementById('save-btn'), () => {
      this.saveSettings();
    });

    addTouchEvent(document.getElementById('settings-btn'), () => {
      this.showPage('settings-page');
      this.updateSettingsDisplay();
    });

    addTouchEvent(document.getElementById('fullscreen-btn'), () => {
      this.toggleFullscreen();
    });
  },

  showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
  },

  toggleFullscreen() {
    // 检测是否支持全屏API
    const fullscreenEnabled = document.fullscreenEnabled ||
                              document.webkitFullscreenEnabled ||
                              document.mozFullScreenEnabled ||
                              document.msFullscreenEnabled;

    if (!fullscreenEnabled) {
      // 移动端不支持全屏API时，使用CSS模拟全屏效果
      document.body.classList.toggle('fullscreen');
      return;
    }

    if (!document.fullscreenElement &&
        !document.webkitFullscreenElement &&
        !document.mozFullScreenElement &&
        !document.msFullscreenElement) {
      // 进入全屏
      const element = document.documentElement;
      if (element.requestFullscreen) {
        element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
      } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
      } else if (element.msRequestFullscreen) {
        element.msRequestFullscreen();
      }
      document.body.classList.add('fullscreen');
    } else {
      // 退出全屏
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
      document.body.classList.remove('fullscreen');
    }
  },

  startDatetime() {
    const update = () => {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const h = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const datetimeStr = `${y}/${m}/${d} ${h}:${min}`;
      document.getElementById('datetime-display').textContent = datetimeStr;
      const centerDatetime = document.getElementById('center-datetime');
      if (centerDatetime) centerDatetime.textContent = datetimeStr;
    };
    update();
    this.datetimeTimer = setInterval(update, 10000);
  },

  loadSettings() {
    const settings = localStorage.getItem('fmo-settings');
    if (settings) {
      const { ip, port, protocol } = JSON.parse(settings);
      this.protocol = protocol || 'ws';
      if (ip) {
        this.connect(ip, port || '80');
      }
    }
  },

  updateSettingsDisplay() {
    const settings = localStorage.getItem('fmo-settings');
    if (settings) {
      const { ip, port, protocol } = JSON.parse(settings);
      document.getElementById('fmo-ip').value = ip || '';
      document.getElementById('fmo-port').value = port || '';
      document.getElementById('fmo-protocol').value = protocol || 'ws';
    }
    document.getElementById('current-server-display').textContent = 
      document.getElementById('server-name').textContent;
    document.getElementById('connection-status-display').textContent = 
      this.connected ? '已连接' : '未连接';
  },

  saveSettings() {
    const ip = document.getElementById('fmo-ip').value.trim();
    const port = document.getElementById('fmo-port').value.trim() || '80';
    const protocol = document.getElementById('fmo-protocol').value;

    if (!ip) {
      this.showSaveStatus('请输入服务器地址', 'error');
      return;
    }

    this.protocol = protocol;
    localStorage.setItem('fmo-settings', JSON.stringify({ ip, port, protocol }));
    this.showSaveStatus('设置已保存', 'success');

    this.disconnect();
    setTimeout(() => {
      this.connect(ip, port);
      this.showPage('main-page');
    }, 500);
  },

  showSaveStatus(msg, type) {
    const el = document.getElementById('save-status');
    el.textContent = msg;
    el.className = `save-status ${type}`;
    if (type !== 'info') {
      setTimeout(() => el.className = 'save-status hidden', 2000);
    }
  },

  connect(ip, port) {
    this.updateStatus('connecting');
    const protocol = this.protocol;
    const host = normalizeHost(ip);
    this.connectMainWs(`${protocol}://${host}:${port}/ws`);
    this.connectEventsWs(`${protocol}://${host}:${port}/events`);
  },

  connectMainWs(url) {
    try {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.updateStatus('connected');
        this.updateConnectionText(true);
        this.fetchAllData();
        this.startStationPolling();
      };
      this.ws.onmessage = (e) => this.handleMessage(e.data);
      this.ws.onclose = () => {
        this.connected = false;
        this.updateStatus('disconnected');
        this.updateConnectionText(false);
        this.stopStationPolling();
        this.scheduleReconnect();
      };
      this.ws.onerror = (error) => {
        console.error('WebSocket连接错误:', error);
        // 移动端连接失败时显示提示
        if (this.reconnectAttempts === 0) {
          this.showConnectionError();
        }
      };
    } catch (e) {
      this.updateStatus('disconnected');
      this.showConnectionError();
    }
  },

  showConnectionError() {
    // 检测是否是移动端
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile && !this.connected) {
      const settings = localStorage.getItem('fmo-settings');
      if (!settings) {
        this.showSaveStatus('请确保手机与FMO设备在同一网络，然后点击右上角设置按钮配置服务器地址', 'info');
      }
    }
  },

  connectEventsWs(url) {
    try {
      this.eventsWs = new WebSocket(url);
      this.eventsWs.onmessage = (e) => this.handleEvent(e.data);
      this.eventsWs.onclose = () => {};
      this.eventsWs.onerror = () => {};
    } catch (e) {}
  },

  disconnect() {
    this.stopStationPolling();
    if (this.ws) { this.ws.close(); this.ws = null; }
    if (this.eventsWs) { this.eventsWs.close(); this.eventsWs = null; }
    this.connected = false;
    this.updateStatus('disconnected');
  },

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    const delay = 1000 * Math.pow(2, this.reconnectAttempts - 1);
    setTimeout(() => {
      if (!this.connected) {
        const s = localStorage.getItem('fmo-settings');
        if (s) {
          const { ip, port } = JSON.parse(s);
          if (ip) this.connect(ip, port || '80');
        }
      }
    }, delay);
  },

  updateStatus(status) {
    const dot = document.getElementById('status-dot');
    dot.className = 'status-dot ' + status;
  },

  updateConnectionText(connected) {
    const text = document.getElementById('connection-text');
    text.textContent = connected ? '已连接' : '未连接';
  },

  startStationPolling() {
    this.stopStationPolling();
    const poll = () => {
      if (this.connected) this.fetchStationName();
    };
    poll();
    this.stationPollingTimer = setInterval(poll, 15000);
  },

  stopStationPolling() {
    if (this.stationPollingTimer) {
      clearInterval(this.stationPollingTimer);
      this.stationPollingTimer = null;
    }
  },

  sendRequest(req) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.ws) { reject(new Error('未连接')); return; }
      this.requestQueue.push({ req, resolve, reject });
      this.processQueue();
    });
  },

  processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) return;
    this.isProcessing = true;
    const { req, resolve, reject } = this.requestQueue.shift();

    const timeout = setTimeout(() => {
      this.isProcessing = false;
      reject(new Error('超时'));
      this.processQueue();
    }, 10000);

    const expectedSubType = RESPONSE_ALIASES[req.type]?.[req.subType] || `${req.subType}Response`;
    
    const handler = (e) => {
      try {
        const resp = JSON.parse(e.data);
        if (resp.type === req.type && 
            (resp.subType === expectedSubType || resp.subType === req.subType)) {
          clearTimeout(timeout);
          this.ws.removeEventListener('message', handler);
          this.isProcessing = false;
          resolve(resp);
          this.processQueue();
        }
      } catch (err) {}
    };

    this.ws.addEventListener('message', handler);
    this.ws.send(JSON.stringify(req));
  },

  async fetchAllData() {
    await this.fetchUserInfo();
    await this.fetchStationName();
    await this.fetchUserPhyDeviceName();
    await this.fetchUserPhyAnt();
    await this.fetchQsoStats();
  },

  async fetchUserInfo() {
    try {
      const resp = await this.sendRequest({ type: 'user', subType: 'getInfo' });
      if (resp.code === 0 && resp.data) {
        if (resp.data.callsign) {
          this.myCallsign = resp.data.callsign;
          document.getElementById('my-callsign').textContent = this.myCallsign;
        }
        if (resp.data.wlanIP) {
          document.getElementById('my-ip').textContent = resp.data.wlanIP;
        }
      }
    } catch (e) {}
    
    try {
      const coordResp = await this.sendRequest({ type: 'config', subType: 'getCordinate' });
      if (coordResp.code === 0 && coordResp.data) {
        const lat = coordResp.data.latitude;
        const lon = coordResp.data.longitude;
        if (lat !== undefined && lon !== undefined) {
          const grid = this.latLonToGrid(lat, lon);
          document.getElementById('grid-locator').textContent = grid;
        }
      }
    } catch (e) {}
  },

  latLonToGrid(lat, lon) {
    lat = parseFloat(lat);
    lon = parseFloat(lon);
    
    const lon1 = lon + 180;
    const lat1 = lat + 90;
    
    const fieldLon = Math.floor(lon1 / 20);
    const fieldLat = Math.floor(lat1 / 10);
    
    const squareLon = Math.floor((lon1 % 20) / 2);
    const squareLat = Math.floor(lat1 % 10);
    
    const subsquareLon = Math.floor(((lon1 % 20) % 2) * 12);
    const subsquareLat = Math.floor((lat1 % 10 - squareLat) * 24);
    
    const field = String.fromCharCode(65 + fieldLon) + String.fromCharCode(65 + fieldLat);
    const square = squareLon.toString() + squareLat.toString();
    const subsquare = String.fromCharCode(97 + subsquareLon) + String.fromCharCode(97 + subsquareLat);
    
    return field + square + subsquare;
  },

  async fetchStationName() {
    try {
      const resp = await this.sendRequest({ type: 'station', subType: 'getCurrent' });
      if (resp.code === 0 && resp.data && resp.data.name) {
        document.getElementById('server-name').textContent = resp.data.name;
      }
    } catch (e) {}
  },

  async fetchUserPhyDeviceName() {
    try {
      const resp = await this.sendRequest({ type: 'config', subType: 'getUserPhyDeviceName' });
      if (resp.code === 0 && resp.data && resp.data.deviceName) {
        document.getElementById('peer-device').textContent = resp.data.deviceName;
      }
    } catch (e) {}
  },

  async fetchUserPhyAnt() {
    try {
      const resp = await this.sendRequest({ type: 'config', subType: 'getUserPhyAnt' });
      if (resp.code === 0 && resp.data && resp.data.ant) {
        document.getElementById('peer-ant').textContent = resp.data.ant;
      }
    } catch (e) {}
  },

  async fetchQsoStats() {
    try {
      const todayStart = Math.floor(new Date(new Date().setHours(0,0,0,0)).getTime() / 1000);
      let total = 0;
      let todayCount = 0;
      let page = 0;
      const maxPages = 1000;
      
      for (page = 0; page < maxPages; page++) {
        const resp = await this.sendRequest({ type: 'qso', subType: 'getList', data: { page } });
        if (resp.code === 0 && resp.data && resp.data.list) {
          const list = resp.data.list;
          if (list.length === 0) break;
          
          if (page === 0 && list[0]) {
            total = list[0].logId;
          }
          
          for (const item of list) {
            if (item.timestamp >= todayStart) {
              todayCount++;
            } else {
              document.getElementById('today-qso').textContent = todayCount;
              document.getElementById('total-qso').textContent = total;
              return;
            }
          }
          
          if (list.length < 20) break;
        } else {
          break;
        }
      }
      
      document.getElementById('today-qso').textContent = todayCount;
      document.getElementById('total-qso').textContent = total;
    } catch (e) {}
  },

  handleEvent(data) {
    try {
      const parts = data.split('}{');
      for (let i = 0; i < parts.length; i++) {
        let part = parts[i];
        if (parts.length > 1) {
          if (i === 0) part += '}';
          else if (i === parts.length - 1) part = '{' + part;
          else part = '{' + part + '}';
        }
        this.processEvent(JSON.parse(part));
      }
    } catch (e) {}
  },

  processEvent(ev) {
    if (ev.type === 'qso' && ev.subType === 'callsign') {
      const d = ev.data;
      if (d.isSpeaking && d.callsign) {
        document.getElementById('incoming-callsign').textContent = d.callsign;
        if (d.grid) {
          document.getElementById('peer-grid').textContent = d.grid;
        }
      }
    }
    if (ev.type === 'station' && ev.subType === 'update' && ev.data && ev.data.name) {
      document.getElementById('server-name').textContent = ev.data.name;
    }
  },

  handleMessage(data) {},

  checkFirstVisit() {
    const settings = localStorage.getItem('fmo-settings');
    if (!settings) {
      // 首次访问，尝试连接默认地址 fmo.local
      this.showSaveStatus('正在尝试连接默认服务器 fmo.local...', 'info');
      this.connect('fmo.local', '80');

      // 监听连接结果
      const checkConnection = setTimeout(() => {
        if (!this.connected) {
          this.showSaveStatus('无法连接到默认服务器，请手动设置', 'error');
          setTimeout(() => {
            this.showPage('settings-page');
            document.getElementById('fmo-ip').value = 'fmo.local';
          }, 1500);
        }
      }, 5000);

      // 如果连接成功，清除检查定时器
      const originalOnOpen = this.ws?.onopen;
      if (this.ws) {
        this.ws.addEventListener('open', () => {
          clearTimeout(checkConnection);
        }, { once: true });
      }
    }
  },

  initOrientationDetection() {
    // 检测横屏状态
    const checkOrientation = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      const isSmallHeight = window.innerHeight <= 500;

      if (isLandscape && isSmallHeight) {
        document.body.classList.add('landscape-mode');
        // 横屏时确保设置页面也能正常访问
        this.handleLandscapeMode();
      } else {
        document.body.classList.remove('landscape-mode');
      }
    };

    // 初始检测
    checkOrientation();

    // 监听屏幕方向变化
    window.addEventListener('orientationchange', () => {
      setTimeout(checkOrientation, 100);
    });

    // 监听窗口大小变化
    window.addEventListener('resize', () => {
      checkOrientation();
    });
  },

  handleLandscapeMode() {
    // 在横屏模式下，添加一个临时的设置按钮到主内容区域
    const mainCenter = document.querySelector('.main-center');
    if (!mainCenter) return;

    // 检查是否已经有横屏设置按钮
    let landscapeSettingsBtn = document.getElementById('landscape-settings-btn');
    if (!landscapeSettingsBtn) {
      landscapeSettingsBtn = document.createElement('button');
      landscapeSettingsBtn.id = 'landscape-settings-btn';
      landscapeSettingsBtn.className = 'landscape-settings-btn';
      landscapeSettingsBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
        </svg>
      `;
      landscapeSettingsBtn.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        background: rgba(0,0,0,0.1);
        border: none;
        border-radius: 50%;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 100;
        color: var(--black);
      `;

      // 添加触摸事件
      landscapeSettingsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.showPage('settings-page');
        this.updateSettingsDisplay();
      });

      landscapeSettingsBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.showPage('settings-page');
        this.updateSettingsDisplay();
      }, { passive: false });

      mainCenter.style.position = 'relative';
      mainCenter.appendChild(landscapeSettingsBtn);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
