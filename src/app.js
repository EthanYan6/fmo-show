const RESPONSE_ALIASES = {
  station: { getListRange: 'getListResponse' }
};

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
      if (ip) this.connect(ip, port || '80');
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
    setTimeout(() => el.className = 'save-status hidden', 2000);
  },

  connect(ip, port) {
    this.updateStatus('connecting');
    const protocol = this.protocol;
    this.connectMainWs(`${protocol}://${ip}:${port}/ws`);
    this.connectEventsWs(`${protocol}://${ip}:${port}/events`);
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
      this.ws.onerror = () => {};
    } catch (e) {
      this.updateStatus('disconnected');
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

  handleMessage(data) {}
};

document.addEventListener('DOMContentLoaded', () => App.init());
