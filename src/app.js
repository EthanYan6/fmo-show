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
  audioWs: null,
  connected: false,
  protocol: 'ws',
  reconnectAttempts: 0,
  maxReconnectAttempts: 10,
  requestQueue: [],
  isProcessing: false,
  datetimeTimer: null,
  stationPollingTimer: null,
  myCallsign: '',
  
  audioCtx: null,
  gainNode: null,
  audioConnected: false,
  isMuted: false,
  audioChunkQueue: [],
  audioScheduledEndTime: 0,
  qsoList: [],
  lastGridMap: {},
  inputSampleRate: 8000,
  isColorMode: false,

  init() {
    this.bindEvents();
    this.loadSettings();
    this.showPage('main-page');
    this.startDatetime();
    this.updateConnectionText(false);
    this.initOrientationDetection();
    this.checkFirstVisit();
    this.initAudio();
    this.loadMuteState();
    this.loadTheme();
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

    addTouchEvent(document.getElementById('theme-toggle'), () => {
      this.toggleTheme();
    });
    
    const speakerIcon = document.querySelector('img[alt="我的呼号"]');
    if (speakerIcon) {
      speakerIcon.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleMute();
      });
      speakerIcon.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleMute();
      }, { passive: false });
      speakerIcon.style.cursor = 'pointer';
    }

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

    // 通联日志弹窗
    addTouchEvent(document.getElementById('qso-modal-close'), () => {
      this.closeQsoLogModal();
    });

    addTouchEvent(document.getElementById('qso-modal-overlay'), () => {
      this.closeQsoLogModal();
    });

    const qsoStar = document.getElementById('today-qso').closest('.info-item');
    addTouchEvent(qsoStar, () => {
      this.openQsoLogModal();
    });

    // 请喝咖啡弹窗
    addTouchEvent(document.getElementById('coffee-modal-close'), () => {
      this.closeCoffeeModal();
    });

    addTouchEvent(document.getElementById('coffee-modal-overlay'), () => {
      this.closeCoffeeModal();
    });

    addTouchEvent(document.querySelector('.credit-text'), () => {
      this.openCoffeeModal();
    });

    // Escape 键关闭弹窗
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const serverModal = document.getElementById('server-modal');
        const qsoModal = document.getElementById('qso-modal');
        const coffeeModal = document.getElementById('coffee-modal');
        if (serverModal && !serverModal.classList.contains('hidden')) {
          this.closeServerModal();
        } else if (qsoModal && !qsoModal.classList.contains('hidden')) {
          this.closeQsoLogModal();
        } else if (coffeeModal && !coffeeModal.classList.contains('hidden')) {
          this.closeCoffeeModal();
        }
      }
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
    const fullHost = `${host}:${port}`;
    this.connectMainWs(`${protocol}://${fullHost}/ws`);
    this.connectEventsWs(`${protocol}://${fullHost}/events`);
    this.connectAudio(fullHost);
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
    this.disconnectAudio();
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
    await this.fetchStationList();
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
      }
    } catch (e) {}

    const settings = localStorage.getItem('fmo-settings');
    if (settings) {
      const { ip } = JSON.parse(settings);
      if (ip) {
        document.getElementById('my-ip').textContent = ip;
      }
    }
    
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

  // 中国地级市坐标表 [市名, 纬度, 经度, 省份]
  CITY_DB: [
    ['北京',39.9,116.4,'北京'],['天津',39.13,117.2,'天津'],['上海',31.23,121.47,'上海'],['重庆',29.56,106.55,'重庆'],
    ['石家庄',38.04,114.51,'河北'],['唐山',39.63,118.18,'河北'],['秦皇岛',39.93,119.6,'河北'],['邯郸',36.6,114.49,'河北'],
    ['邢台',37.05,114.5,'河北'],['保定',38.87,115.46,'河北'],['张家口',40.77,114.88,'河北'],['承德',40.97,117.93,'河北'],
    ['沧州',38.31,116.84,'河北'],['廊坊',39.52,116.7,'河北'],['衡水',37.74,115.67,'河北'],
    ['太原',37.87,112.55,'山西'],['大同',40.09,113.3,'山西'],['阳泉',37.87,113.58,'山西'],['长治',36.19,113.12,'山西'],
    ['晋城',35.49,112.85,'山西'],['朔州',39.33,112.43,'山西'],['晋中',37.69,112.75,'山西'],['运城',35.03,111.01,'山西'],
    ['忻州',38.42,112.73,'山西'],['临汾',36.09,111.52,'山西'],['吕梁',37.52,111.14,'山西'],
    ['呼和浩特',40.84,111.75,'内蒙古'],['包头',40.66,109.84,'内蒙古'],['乌海',39.67,106.82,'内蒙古'],
    ['赤峰',42.27,118.96,'内蒙古'],['通辽',43.62,122.27,'内蒙古'],['鄂尔多斯',39.61,109.78,'内蒙古'],
    ['呼伦贝尔',49.22,119.77,'内蒙古'],['巴彦淖尔',40.75,107.39,'内蒙古'],['乌兰察布',41.02,113.11,'内蒙古'],
    ['沈阳',41.8,123.4,'辽宁'],['大连',38.91,121.6,'辽宁'],['鞍山',41.11,122.99,'辽宁'],['抚顺',41.87,123.97,'辽宁'],
    ['本溪',41.29,123.77,'辽宁'],['丹东',40.0,124.38,'辽宁'],['锦州',41.1,121.13,'辽宁'],['营口',40.67,122.24,'辽宁'],
    ['阜新',42.01,121.66,'辽宁'],['辽阳',41.27,123.17,'辽宁'],['盘锦',41.12,122.07,'辽宁'],
    ['铁岭',42.29,123.84,'辽宁'],['朝阳',41.57,120.45,'辽宁'],['葫芦岛',40.72,120.84,'辽宁'],
    ['长春',43.88,125.35,'吉林'],['吉林市',43.84,126.55,'吉林'],['四平',43.17,124.35,'吉林'],['辽源',42.9,125.14,'吉林'],
    ['通化',41.73,125.94,'吉林'],['白山',41.94,126.42,'吉林'],['松原',45.14,124.83,'吉林'],['白城',45.62,122.84,'吉林'],
    ['哈尔滨',45.75,126.65,'黑龙江'],['齐齐哈尔',47.35,123.97,'黑龙江'],['鸡西',45.3,130.97,'黑龙江'],
    ['鹤岗',47.35,130.3,'黑龙江'],['双鸭山',46.65,131.16,'黑龙江'],['大庆',46.59,125.1,'黑龙江'],
    ['伊春',47.73,128.9,'黑龙江'],['佳木斯',46.81,130.36,'黑龙江'],['牡丹江',44.55,129.63,'黑龙江'],
    ['黑河',50.25,127.49,'黑龙江'],['绥化',46.64,126.98,'黑龙江'],
    ['南京',32.06,118.8,'江苏'],['无锡',31.57,120.3,'江苏'],['徐州',34.26,117.18,'江苏'],['常州',31.77,119.97,'江苏'],
    ['苏州',31.3,120.62,'江苏'],['南通',32.01,120.87,'江苏'],['连云港',34.6,119.22,'江苏'],['淮安',33.6,119.02,'江苏'],
    ['盐城',33.35,120.16,'江苏'],['扬州',32.39,119.43,'江苏'],['镇江',32.19,119.45,'江苏'],['泰州',32.49,119.92,'江苏'],
    ['宿迁',33.96,118.28,'江苏'],
    ['杭州',30.27,120.15,'浙江'],['宁波',29.87,121.55,'浙江'],['温州',28.0,120.67,'浙江'],['嘉兴',30.77,120.76,'浙江'],
    ['湖州',30.89,120.09,'浙江'],['绍兴',30.0,120.58,'浙江'],['金华',29.08,119.65,'浙江'],['衢州',28.94,118.87,'浙江'],
    ['舟山',30.0,122.11,'浙江'],['台州',28.68,121.42,'浙江'],['丽水',28.47,119.91,'浙江'],
    ['合肥',31.82,117.23,'安徽'],['芜湖',31.33,118.38,'安徽'],['蚌埠',32.92,117.39,'安徽'],['淮南',32.63,117.02,'安徽'],
    ['马鞍山',31.68,118.51,'安徽'],['淮北',33.97,116.8,'安徽'],['铜陵',30.93,117.82,'安徽'],['安庆',30.53,117.05,'安徽'],
    ['黄山',29.71,118.34,'安徽'],['滁州',32.3,118.32,'安徽'],['阜阳',32.89,115.81,'安徽'],['宿州',33.64,116.97,'安徽'],
    ['六安',31.74,116.51,'安徽'],['亳州',33.87,115.78,'安徽'],['池州',30.66,117.49,'安徽'],['宣城',30.95,118.76,'安徽'],
    ['福州',26.07,119.3,'福建'],['厦门',24.48,118.09,'福建'],['莆田',25.45,119.01,'福建'],['三明',26.27,117.64,'福建'],
    ['泉州',24.87,118.68,'福建'],['漳州',24.51,117.65,'福建'],['南平',26.64,118.18,'福建'],['龙岩',25.08,117.02,'福建'],
    ['宁德',26.66,119.55,'福建'],
    ['南昌',28.68,115.86,'江西'],['景德镇',29.27,117.18,'江西'],['萍乡',27.63,113.86,'江西'],['九江',29.71,116.0,'江西'],
    ['新余',27.8,114.93,'江西'],['鹰潭',28.25,117.07,'江西'],['赣州',25.83,114.93,'江西'],['吉安',27.11,114.99,'江西'],
    ['宜春',27.8,114.39,'江西'],['抚州',28.0,116.36,'江西'],['上饶',28.45,117.97,'江西'],
    ['济南',36.65,116.99,'山东'],['青岛',36.07,120.38,'山东'],['淄博',36.81,118.06,'山东'],['枣庄',34.81,117.33,'山东'],
    ['东营',37.46,118.67,'山东'],['烟台',37.46,121.45,'山东'],['潍坊',36.71,119.16,'山东'],['济宁',35.41,116.59,'山东'],
    ['泰安',36.2,117.09,'山东'],['威海',37.51,122.12,'山东'],['日照',35.38,119.53,'山东'],['临沂',35.1,118.35,'山东'],
    ['德州',37.44,116.36,'山东'],['聊城',36.45,115.97,'山东'],['滨州',37.38,117.97,'山东'],['菏泽',35.23,115.48,'山东'],
    ['郑州',34.75,113.65,'河南'],['开封',34.8,114.31,'河南'],['洛阳',34.62,112.45,'河南'],['平顶山',33.77,113.19,'河南'],
    ['安阳',36.1,114.39,'河南'],['鹤壁',35.75,114.3,'河南'],['新乡',35.3,113.87,'河南'],['焦作',35.24,113.24,'河南'],
    ['濮阳',35.76,115.03,'河南'],['许昌',34.02,113.85,'河南'],['漯河',33.58,114.02,'河南'],['三门峡',34.77,111.2,'河南'],
    ['南阳',33.01,112.53,'河南'],['商丘',34.44,115.65,'河南'],['信阳',32.15,114.09,'河南'],['周口',33.63,114.65,'河南'],
    ['驻马店',32.98,114.03,'河南'],
    ['武汉',30.59,114.31,'湖北'],['黄石',30.2,115.04,'湖北'],['十堰',32.63,110.8,'湖北'],['宜昌',30.69,111.29,'湖北'],
    ['襄阳',32.01,112.14,'湖北'],['鄂州',30.4,114.89,'湖北'],['荆门',31.04,112.2,'湖北'],['孝感',30.92,113.91,'湖北'],
    ['荆州',30.33,112.24,'湖北'],['黄冈',30.45,114.87,'湖北'],['咸宁',29.84,114.32,'湖北'],['随州',31.72,113.38,'湖北'],
    ['恩施',30.27,109.49,'湖北'],
    ['长沙',28.23,112.94,'湖南'],['株洲',27.83,113.13,'湖南'],['湘潭',27.83,112.94,'湖南'],['衡阳',26.89,112.57,'湖南'],
    ['邵阳',27.24,111.47,'湖南'],['岳阳',29.37,113.09,'湖南'],['常德',29.04,111.69,'湖南'],['张家界',29.12,110.48,'湖南'],
    ['益阳',28.55,112.33,'湖南'],['郴州',25.77,113.01,'湖南'],['永州',26.42,111.61,'湖南'],['怀化',27.55,109.98,'湖南'],
    ['娄底',27.7,112.0,'湖南'],['湘西',28.31,109.74,'湖南'],
    ['广州',23.13,113.26,'广东'],['韶关',24.81,113.6,'广东'],['深圳',22.54,114.06,'广东'],['珠海',22.27,113.58,'广东'],
    ['汕头',23.35,116.68,'广东'],['佛山',23.02,113.12,'广东'],['江门',22.58,113.08,'广东'],['湛江',21.27,110.36,'广东'],
    ['茂名',21.66,110.92,'广东'],['肇庆',23.05,112.47,'广东'],['惠州',23.11,114.42,'广东'],['梅州',24.29,116.12,'广东'],
    ['汕尾',22.79,115.37,'广东'],['河源',23.74,114.7,'广东'],['阳江',21.86,111.98,'广东'],['清远',23.68,113.06,'广东'],
    ['东莞',23.02,113.75,'广东'],['中山',22.52,113.38,'广东'],['潮州',23.67,116.62,'广东'],['揭阳',23.55,116.37,'广东'],
    ['云浮',22.92,112.04,'广东'],
    ['南宁',22.82,108.32,'广西'],['柳州',24.33,109.41,'广西'],['桂林',25.27,110.29,'广西'],['梧州',23.48,111.28,'广西'],
    ['北海',21.48,109.12,'广西'],['防城港',21.61,108.35,'广西'],['钦州',21.98,108.62,'广西'],['贵港',23.1,109.6,'广西'],
    ['玉林',22.63,110.15,'广西'],['百色',23.9,106.62,'广西'],['贺州',24.4,111.56,'广西'],['河池',24.69,108.09,'广西'],
    ['来宾',23.73,109.23,'广西'],['崇左',22.38,107.36,'广西'],
    ['海口',20.02,110.35,'海南'],['三亚',18.25,109.5,'海南'],
    ['成都',30.57,104.07,'四川'],['自贡',29.35,104.78,'四川'],['攀枝花',26.58,101.72,'四川'],['泸州',28.87,105.44,'四川'],
    ['德阳',31.13,104.4,'四川'],['绵阳',31.47,104.73,'四川'],['广元',32.44,105.84,'四川'],['遂宁',30.53,105.57,'四川'],
    ['内江',29.58,105.06,'四川'],['乐山',29.56,103.77,'四川'],['南充',30.84,106.11,'四川'],['眉山',30.08,103.85,'四川'],
    ['宜宾',28.77,104.63,'四川'],['广安',30.47,106.63,'四川'],['达州',31.21,107.47,'四川'],['雅安',30.01,103.04,'四川'],
    ['巴中',31.87,106.75,'四川'],['资阳',30.13,104.65,'四川'],['阿坝',31.9,102.22,'四川'],['甘孜',31.62,99.99,'四川'],
    ['凉山',27.89,102.27,'四川'],
    ['贵阳',26.65,106.71,'贵州'],['六盘水',26.59,104.83,'贵州'],['遵义',27.73,106.93,'贵州'],['安顺',26.25,105.95,'贵州'],
    ['毕节',27.3,105.29,'贵州'],['铜仁',27.72,109.19,'贵州'],
    ['昆明',25.04,102.68,'云南'],['曲靖',25.49,103.8,'云南'],['玉溪',24.35,102.55,'云南'],['保山',25.11,99.17,'云南'],
    ['昭通',27.34,103.72,'云南'],['丽江',26.87,100.23,'云南'],['普洱',22.78,100.97,'云南'],['临沧',23.88,100.09,'云南'],
    ['大理',25.59,100.23,'云南'],
    ['拉萨',29.65,91.17,'西藏'],['日喀则',29.25,88.88,'西藏'],['昌都',31.14,97.17,'西藏'],['林芝',29.65,94.36,'西藏'],
    ['山南',29.24,91.77,'西藏'],['那曲',31.48,92.05,'西藏'],
    ['西安',34.26,108.94,'陕西'],['铜川',35.08,108.97,'陕西'],['宝鸡',34.36,107.24,'陕西'],['咸阳',34.33,108.72,'陕西'],
    ['渭南',34.5,109.51,'陕西'],['延安',36.59,109.49,'陕西'],['汉中',33.07,107.03,'陕西'],['榆林',38.29,109.73,'陕西'],
    ['安康',32.69,109.03,'陕西'],['商洛',33.87,109.93,'陕西'],
    ['兰州',36.06,103.83,'甘肃'],['嘉峪关',39.81,98.23,'甘肃'],['金昌',38.52,102.19,'甘肃'],['白银',36.55,104.14,'甘肃'],
    ['天水',34.58,105.72,'甘肃'],['武威',37.93,102.64,'甘肃'],['张掖',38.93,100.45,'甘肃'],['平凉',35.55,106.67,'甘肃'],
    ['酒泉',39.74,98.51,'甘肃'],['庆阳',35.73,107.64,'甘肃'],['定西',35.58,104.63,'甘肃'],['陇南',33.4,104.92,'甘肃'],
    ['西宁',36.62,101.78,'青海'],['海东',36.5,102.1,'青海'],
    ['银川',38.49,106.23,'宁夏'],['石嘴山',38.99,106.38,'宁夏'],['吴忠',37.99,106.2,'宁夏'],['固原',36.02,106.24,'宁夏'],
    ['中卫',37.51,105.19,'宁夏'],
    ['乌鲁木齐',43.83,87.62,'新疆'],['克拉玛依',45.59,84.87,'新疆'],['吐鲁番',42.95,89.17,'新疆'],['哈密',42.83,93.51,'新疆'],
    ['昌吉',44.02,87.31,'新疆'],['博乐',44.9,82.07,'新疆'],['库尔勒',41.76,86.15,'新疆'],['阿克苏',41.17,80.26,'新疆'],
    ['喀什',39.47,75.99,'新疆'],['伊宁',43.92,81.33,'新疆'],['塔城',46.75,82.98,'新疆'],['阿勒泰',47.85,88.14,'新疆'],
    ['香港',22.32,114.17,'香港'],['澳门',22.2,113.55,'澳门'],
  ],

  DISTRICT_DB: {
    '北京':[['东城',39.93,116.42],['西城',39.91,116.37],['朝阳',39.92,116.48],['海淀',39.96,116.31],['丰台',39.86,116.28],['石景山',39.91,116.19],['通州',39.88,116.66],['顺义',40.13,116.65],['昌平',40.22,116.23],['大兴',39.73,116.34],['房山',39.75,116.14],['门头沟',39.94,116.11],['平谷',40.17,117.12],['怀柔',40.32,116.63],['密云',40.38,116.84],['延庆',40.45,115.97]],
    '天津':[['和平',39.12,117.21],['河东',39.13,117.25],['河西',39.11,117.22],['南开',39.14,117.15],['河北',39.15,117.18],['红桥',39.17,117.15],['东丽',39.09,117.31],['西青',39.03,117.01],['津南',38.99,117.39],['北辰',39.22,117.13],['武清',39.38,117.04],['宝坻',39.72,117.31],['滨海',39.03,117.71],['宁河',39.33,117.83],['静海',38.93,116.92],['蓟州',40.05,117.41]],
    '上海':[['黄浦',31.23,121.48],['徐汇',31.19,121.44],['长宁',31.22,121.42],['静安',31.23,121.45],['普陀',31.25,121.4],['虹口',31.26,121.5],['杨浦',31.26,121.53],['闵行',31.12,121.38],['宝山',31.4,121.49],['嘉定',31.39,121.27],['浦东',31.22,121.54],['金山',30.74,121.34],['松江',31.03,121.23],['青浦',31.15,121.12],['奉贤',30.92,121.47],['崇明',31.63,121.4]],
    '重庆':[['渝中',29.56,106.57],['江北',29.61,106.57],['南岸',29.52,106.66],['沙坪坝',29.54,106.46],['九龙坡',29.5,106.51],['大渡口',29.49,106.48],['渝北',29.72,106.63],['巴南',29.38,106.54],['北碚',29.8,106.4],['万州',30.81,108.41],['涪陵',29.7,107.39],['黔江',29.53,108.77],['长寿',29.86,107.08],['江津',29.29,106.26],['合川',30.0,106.27],['永川',29.36,105.93]],
  },

  gridToLocation(grid) {
    if (!grid || grid.length < 4) return grid || '';
    var g = grid.toUpperCase();
    var fl = g.charCodeAt(0) - 65;
    var fa = g.charCodeAt(1) - 65;
    var sl = parseInt(g.charAt(2));
    var sa = parseInt(g.charAt(3));
    var ssl = 0, ssa = 0;
    if (grid.length >= 6) {
      ssl = grid.charCodeAt(4) - 97;
      ssa = grid.charCodeAt(5) - 97;
    }
    var lat = -90 + fa * 10 + sa + ssa / 24 + 1 / 48;
    var lon = -180 + fl * 20 + sl * 2 + ssl / 12 + 1 / 24;
    var minDist = 1e9, bestCity = null;
    for (var i = 0; i < this.CITY_DB.length; i++) {
      var c = this.CITY_DB[i];
      var d = (c[1] - lat) * (c[1] - lat) + (c[2] - lon) * (c[2] - lon);
      if (d < minDist) { minDist = d; bestCity = c; }
    }
    if (!bestCity) return grid;
    var cityName = bestCity[0];
    var province = bestCity[3];
    // 直辖市显示到区
    var dists = this.DISTRICT_DB[cityName];
    if (dists) {
      var minD = 1e9, bestDist = cityName;
      for (var j = 0; j < dists.length; j++) {
        var dd = (dists[j][1] - lat) * (dists[j][1] - lat) + (dists[j][2] - lon) * (dists[j][2] - lon);
        if (dd < minD) { minD = dd; bestDist = dists[j][0]; }
      }
      return cityName + bestDist;
    }
    return province + cityName;
  },

  autoShrinkText(el) {
    if (!el) return;
    el.style.fontSize = '';
    // 用 .info-item 自身宽度作为约束
    var item = el.closest('.info-item');
    if (!item) return;
    var maxW = item.clientWidth;
    // 扣除同级元素(图标等)占用的空间
    for (var i = 0; i < item.children.length; i++) {
      if (item.children[i] !== el) maxW -= item.children[i].offsetWidth;
    }
    var fs = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollWidth > maxW && fs > 10) {
      fs -= 1;
      el.style.fontSize = fs + 'px';
    }
  },

  autoShrinkCallsign() {
    var el = document.getElementById('incoming-callsign');
    if (!el) return;
    el.style.fontSize = '';
    var group = el.closest('.callsign-group');
    if (!group) return;
    var badge = document.getElementById('callsign-badge');
    var maxW = group.clientWidth;
    if (badge && badge.classList.contains('visible')) {
      maxW -= badge.offsetWidth + 6;
    }
    var fs = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollWidth > maxW && fs > 16) {
      fs -= 1;
      el.style.fontSize = fs + 'px';
    }
  },

  autoShrinkServer() {
    var el = document.getElementById('server-name');
    if (!el) return;
    el.style.fontSize = '';
    var maxW = el.clientWidth;
    var fs = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollWidth > maxW && fs > 12) {
      fs -= 1;
      el.style.fontSize = fs + 'px';
    }
  },

  async fetchStationName() {
    try {
      const resp = await this.sendRequest({ type: 'station', subType: 'getCurrent' });
      if (resp.code === 0 && resp.data && resp.data.name) {
        document.getElementById('server-name').textContent = resp.data.name;
        this.autoShrinkServer();
      }
    } catch (e) {}
  },

  async openServerModal() {
    const modal = document.getElementById('server-modal');
    const container = document.getElementById('server-list-container');
    container.innerHTML = '';
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'server-list-empty';
    loadingDiv.textContent = '加载中...';
    container.appendChild(loadingDiv);
    modal.classList.remove('hidden');
    await this.fetchStationList();
  },

  closeServerModal() {
    const modal = document.getElementById('server-modal');
    modal.classList.add('hidden');
  },

  async fetchStationList() {
    try {
      const pageSize = 8;
      let allList = [];
      let start = 0;
      while (true) {
        const resp = await this.sendRequest({ type: 'station', subType: 'getListRange', data: { start, count: pageSize } });
        const page = resp.data?.list || [];
        allList = allList.concat(page);
        if (page.length < pageSize) break;
        start += pageSize;
      }
      const currentResp = await this.sendRequest({ type: 'station', subType: 'getCurrent' });
      const currentUid = currentResp.data?.uid || 0;
      this.renderStationList(allList, currentUid);
    } catch (e) {
      console.error('获取服务器列表失败:', e);
      const container = document.getElementById('server-list-container');
      container.innerHTML = '';
      const errorDiv = document.createElement('div');
      errorDiv.className = 'server-list-empty';
      errorDiv.textContent = '获取服务器列表失败，请重试';
      container.appendChild(errorDiv);
    }
  },

  renderStationList(list, currentUid) {
    const container = document.getElementById('server-list-container');
    container.innerHTML = '';

    if (list.length === 0) {
      container.innerHTML = '<div class="server-list-empty">暂无可用服务器</div>';
      return;
    }

    list.forEach(station => {
      const item = document.createElement('div');
      item.className = 'server-item' + (station.uid === currentUid ? ' active' : '');

      const nameSpan = document.createElement('span');
      nameSpan.className = 'server-item-name';
      nameSpan.textContent = station.name || '未命名';
      item.appendChild(nameSpan);

      if (station.uid === currentUid) {
        const checkSpan = document.createElement('span');
        checkSpan.className = 'server-item-check';
        checkSpan.textContent = '✓';
        item.appendChild(checkSpan);
      }

      item.addEventListener('click', () => this.switchStation(station.uid));
      container.appendChild(item);
    });
  },

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

  async openQsoLogModal() {
    const modal = document.getElementById('qso-modal');
    modal.classList.remove('hidden');
    this.renderQsoLog(this.qsoList);
  },

  closeQsoLogModal() {
    document.getElementById('qso-modal').classList.add('hidden');
  },

  openCoffeeModal() {
    document.getElementById('coffee-modal').classList.remove('hidden');
  },

  closeCoffeeModal() {
    document.getElementById('coffee-modal').classList.add('hidden');
  },

  renderQsoLog(list) {
    const container = document.getElementById('qso-log-container');
    container.innerHTML = '';
    if (list.length === 0) {
      container.innerHTML = '<div class="server-list-empty">暂无通联记录</div>';
      return;
    }
    list.forEach(item => {
      const el = document.createElement('div');
      el.className = 'qso-item';

      const logId = document.createElement('span');
      logId.className = 'qso-item-logid';
      logId.textContent = '#' + (item.logId || '--');
      el.appendChild(logId);

      const callsign = document.createElement('span');
      callsign.className = 'qso-item-callsign';
      callsign.textContent = item.toCallsign || '--';
      el.appendChild(callsign);

      const grid = document.createElement('span');
      grid.className = 'qso-item-grid';
      grid.textContent = item.grid ? this.gridToLocation(item.grid) : '--';
      el.appendChild(grid);

      const time = document.createElement('span');
      time.className = 'qso-item-time';
      if (item.timestamp) {
        const d = new Date(item.timestamp * 1000);
        const pad = n => String(n).padStart(2, '0');
        time.textContent = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      } else {
        time.textContent = '--';
      }
      el.appendChild(time);

      container.appendChild(el);
    });
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
      var myGrid = document.getElementById('grid-locator').textContent;
      if (myGrid && myGrid !== '------') {
        document.getElementById('peer-ant').textContent = this.gridToLocation(myGrid);
      }
    } catch (e) {}
  },

  async fetchQsoStats() {
    try {
      const todayStart = Math.floor(new Date(new Date().setHours(0,0,0,0)).getTime() / 1000);
      let total = 0;
      let todayCount = 0;
      let page = 0;
      const allList = [];

      while (true) {
        const resp = await this.sendRequest({ type: 'qso', subType: 'getList', data: { page } });
        if (resp.code === 0 && resp.data && resp.data.list) {
          const list = resp.data.list;
          if (list.length === 0) break;

          if (page === 0 && list[0]) {
            total = list[0].logId;
          }

          for (const item of list) {
            allList.push(item);
            if (item.timestamp >= todayStart) {
              todayCount++;
            }
          }

          if (list.length < 20) break;
          page++;
        } else {
          break;
        }
      }

      this.qsoList = allList;
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
      // 本人呼号直接说话时不显示
      if (d.isSpeaking && d.callsign && d.callsign === this.myCallsign) return;
      // 缓存有grid的事件
      if (d.callsign && d.grid) {
        const cacheKey = d.callsign.replace(/^RE>/, '');
        this.lastGridMap[cacheKey] = d.grid;
      }
      if (d.isSpeaking && d.callsign) {
        document.getElementById('incoming-callsign').textContent = d.callsign;
        this.updateCallsignBadge(d.callsign);
        this.autoShrinkCallsign();
      }
      if (d.isSpeaking && d.callsign) {
        let grid = d.grid;
        const lookupCallsign = d.callsign.replace(/^RE>/, '');
        // 事件没有grid时, 依次从缓存、通联记录、自己网格里查
        if (!grid) grid = this.lastGridMap[lookupCallsign];
        if (!grid) {
          const record = this.qsoList.find(item => item.toCallsign === lookupCallsign && item.grid);
          if (record) grid = record.grid;
        }
        // 回声测试等场景, 用自己网格兜底
        if (!grid && lookupCallsign === this.myCallsign) {
          const myGrid = document.getElementById('grid-locator').textContent;
          if (myGrid && myGrid !== '------') grid = myGrid;
        }
        if (grid) {
          var peerGridEl = document.getElementById('peer-grid');
          peerGridEl.textContent = this.gridToLocation(grid);
          this.autoShrinkText(peerGridEl);
        }
      }
    }
    if (ev.type === 'station' && ev.subType === 'update' && ev.data && ev.data.name) {
      document.getElementById('server-name').textContent = ev.data.name;
      this.autoShrinkServer();
    }
  },

  updateCallsignBadge(callsign) {
    const badge = document.getElementById('callsign-badge');
    if (!callsign || callsign === '------') {
      badge.classList.remove('visible');
      return;
    }
    if (this.myCallsign && callsign === 'RE>' + this.myCallsign) {
      badge.textContent = '本人';
    } else {
      const count = this.qsoList.filter(item => item.toCallsign === callsign).length;
      badge.textContent = count > 0 ? count : '新';
    }
    badge.classList.add('visible');
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
  },

  initAudio() {
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = 1.0;
      this.gainNode.connect(this.audioCtx.destination);
    } catch (e) {
      console.error('Failed to initialize audio context:', e);
    }
  },

  loadMuteState() {
    const savedMute = localStorage.getItem('fmo-muted');
    this.isMuted = savedMute === 'true';
    this.updateMuteIcon();
  },

  loadTheme() {
    const saved = localStorage.getItem('fmo-color-mode');
    this.isColorMode = saved === 'true';
    this.applyTheme();
  },

  toggleTheme() {
    this.isColorMode = !this.isColorMode;
    localStorage.setItem('fmo-color-mode', this.isColorMode.toString());
    this.applyTheme();
  },

  applyTheme() {
    const toggle = document.getElementById('theme-toggle');
    if (this.isColorMode) {
      document.body.classList.add('color-mode');
      toggle.classList.add('color-mode');
    } else {
      document.body.classList.remove('color-mode');
      toggle.classList.remove('color-mode');
    }
    this.updateMuteIcon();
  },

  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('fmo-muted', this.isMuted.toString());
    
    if (!this.audioCtx) {
      this.initAudio();
    }
    
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().then(() => {
        console.log('AudioContext resumed on user interaction');
      }).catch(e => console.error('AudioContext resume failed:', e));
    }
    
    if (this.gainNode) {
      this.gainNode.gain.value = this.isMuted ? 0 : 1.0;
    }
    
    this.updateMuteIcon();
    
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  },

  updateMuteIcon() {
    const speakerIcon = document.querySelector('img[alt="我的呼号"]');
    if (!speakerIcon) return;

    if (this.isMuted) {
      speakerIcon.style.opacity = '0.3';
      speakerIcon.style.filter = this.isColorMode ? 'invert(1) grayscale(100%)' : 'grayscale(100%)';
    } else {
      speakerIcon.style.opacity = '1';
      speakerIcon.style.filter = this.isColorMode ? 'invert(1)' : 'none';
    }
  },

  connectAudio(host) {
    if (this.audioWs && (this.audioConnected || this.audioWs.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (!this.audioCtx) {
      this.initAudio();
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const protocol = this.protocol;
    const url = `${protocol}://${host}/audio`;

    try {
      this.audioWs = new WebSocket(url);
      this.audioWs.binaryType = 'arraybuffer';

      this.audioWs.onopen = () => {
        this.audioConnected = true;
        console.log('Audio WebSocket connected');
      };

      this.audioWs.onclose = () => {
        this.audioConnected = false;
        console.log('Audio WebSocket disconnected');
      };

      this.audioWs.onerror = (e) => {
        console.error('Audio WebSocket error:', e);
        this.audioConnected = false;
      };

      this.audioWs.onmessage = (evt) => {
        if (this.isMuted) return;
        const buf = evt.data;
        if (!(buf instanceof ArrayBuffer)) return;
        this.processAudioData(buf);
      };
    } catch (e) {
      console.error('Failed to connect audio WebSocket:', e);
    }
  },

  disconnectAudio() {
    if (this.audioWs) {
      try {
        this.audioWs.close();
      } catch (e) {}
      this.audioWs = null;
    }
    this.audioConnected = false;
    this.audioChunkQueue = [];
    this.audioScheduledEndTime = 0;
  },

  processAudioData(arrayBuffer) {
    if (!this.audioCtx || !this.gainNode) return;

    const view = new Int16Array(arrayBuffer);
    const f32 = new Float32Array(view.length);
    for (let i = 0; i < view.length; i++) {
      f32[i] = view[i] / 32768;
    }

    this.audioChunkQueue.push(f32);
    this.scheduleAudioPlayback();
  },

  scheduleAudioPlayback() {
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    if (this.audioScheduledEndTime < now) {
      this.audioScheduledEndTime = now;
    }

    while (this.audioChunkQueue.length > 0) {
      const chunk = this.audioChunkQueue.shift();
      
      const buffer = this.audioCtx.createBuffer(1, chunk.length, this.inputSampleRate);
      buffer.copyToChannel(chunk, 0, 0);

      const src = this.audioCtx.createBufferSource();
      src.buffer = buffer;
      src.connect(this.gainNode);

      const duration = chunk.length / this.inputSampleRate;
      src.start(this.audioScheduledEndTime);
      this.audioScheduledEndTime += duration;
    }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
