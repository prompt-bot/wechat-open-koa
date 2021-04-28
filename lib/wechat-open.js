const fs = require('fs');
const EventEmitter = require('events');
const WechatEncrypt = require('wechat-encrypt');
const _ = require('lodash');

const { buildObject, parseXMLSync } = require('./util');
const msgTemplate = require('./msg.json');

const htlmTemplate = fs.readFileSync(__dirname + '/jump.html', 'utf8'); // html模板

const BaseCache = require('./stores/Base');
const MemoryCache = require('./stores/memory');

const {
  getComponentAccessToken,
  getPreAuthCode,
  getAuthorizationUrl,
  getAuthorizerList,

  getOAuthUrl,
  getAccessToken,
  refreshAccessToken,
  getJsApiTicket,
  send,
} = require('./common');

const {
  DELAY_UPPER_LIMIT,
  REFRESH_INTERVAL,
  RETRY_TIMEOUT,
  TIPS_TIMEOUT,
  WARN_TIPS,

  EVENT_COMPONENT_VERIFY_TICKET,
  EVENT_AUTHORIZED,
  EVENT_UPDATE_AUTHORIZED,
  EVENT_UNAUTHORIZED,
  EVENT_COMPONENT_ACCESS_TOKEN,
  EVENT_AUTHORIZER_ACCESS_TOKEN,
  EVENT_AUTHORIZER_JSAPI_TICKET, 
  AUTO_TEST_MP_NAME,
  AUTO_TEST_MINI_PROGRAM_NAME,
  AUTO_TEST_TEXT_CONTENT,
  AUTO_TEST_REPLY_TEXT,

  PAGE_SIZE,
  PAGE_STYLE_PC,
  AUTH_TYPE_BOTH,
  OAUTH_TYPE_BASE,
} = require('./constant');

class WechatOpen extends EventEmitter {
  /**
   * 
   * @param {*} opts {list: [{componentAppId: '', componentAppSecret: '', token: '', encodingAESKey: ''}], cache: [instanceof BaseCache], log: [console]} 
   */
  constructor (opts) {
    super(opts);
    // list: [{
    //     componentAppId: _.get(el, 'component_app_id'), // 微信第三方平台 appId
    //     componentAppSecret: _.get(el, 'component_app_secret'), // 微信第三方平台 appSecret
    //     token: _.get(el, 'token'), // 消息校验Token
    //     encodingAESKey: _.get(el, 'encoding_aes_Key'), // 消息加解密 key
    // }]

    // cache: Class instance of BaseCache
    const { list, cache, log = console } = opts;

    // 第三方平台账号信息列表，支持多个
    this.list = list;

    // 日志工具
    this.log = log;

    this.autoTestOpenIdList = [..._.map(AUTO_TEST_MP_NAME, el => el.Username), ..._.map(AUTO_TEST_MINI_PROGRAM_NAME, el => el.Username)];

    // 定时器列表
    this.timers = {
      componentApp: {
        // 分页获取全部已授权账号的定时器
        fetchTimer: {},
        // 刷新 component_access_token 的定时器
        Timer: {},
      },
      authorizerApp: {
        // 刷新 access token 的定时器ID
        tokenTimer: {},
        // 刷新 JsApi Ticket 的定时器ID
        ticketTimer: {},
      },
    };

    if (!cache){
      this.cache = new MemoryCache();
    } else {
      this.cache = cache;
    }
    if (!(this.cache instanceof BaseCache)){
      throw new Error('cache instance is not implement of BaseCache.');
    }
    if (process.env.NODE_ENV === 'production' && (this.cache instanceof MemoryCache)) {
      this.log.warn('[wechat-open-koa] You should not use memory cache in production environment!');
    }

    // 事件绑定
    this.on(EVENT_COMPONENT_VERIFY_TICKET, this.onReceiveComponentVerifyTicket.bind(this));
    this.on(EVENT_COMPONENT_ACCESS_TOKEN, this.onRefreshComponentAccessToken.bind(this));
    this.on(EVENT_AUTHORIZED, this.onAuthorized.bind(this));
    this.on(EVENT_UNAUTHORIZED, this.onUnauthorized.bind(this));
    this.on(EVENT_UPDATE_AUTHORIZED, this.onEventUpdateAuthorized.bind(this));
    this.on(EVENT_AUTHORIZER_ACCESS_TOKEN, this.onRefreshAuthorizerAccessToken.bind(this));
    this.on(EVENT_AUTHORIZER_JSAPI_TICKET, this.onRefreshAuthorizerJsApiTicket.bind(this));
    this.on('error', this.errorCatch.bind(this));
    // 启动后没有使用历史存档的信息初始化ticket，提示
    this.Timer = setTimeout(() => this.log.warn(WARN_TIPS), TIPS_TIMEOUT);
  }

  errorCatch (error) {
    this.log.error(error);
    console.error(error);
  }

  /**
   * 初始化动作，还原现有的componmen信息，例如 componment ticket 微信每十分钟发送一次，保证启动后服务即可用
   */
  async initialize () {
    for (let index = 0; index < this.list.length; index++) {
      let { componentAppId, componentAppSecret, token, encodingAESKey } = this.list[index];
      const storeData = await this.cache.getComponentAppById(componentAppId) || {};
      const data = {
        componentAppId,
        componentAppSecret,
        token,
        encodingAESKey,
        ...storeData,
      };
      await this.cache.setComponentApp(componentAppId, data);
      if (storeData && storeData.ComponentVerifyTicket) {
        clearTimeout(this.Timer);
        this.log.debug(`[wechat-open-koa] reset componentAppId [${componentAppId}] info: ${JSON.stringify(data)}`);
        this.emit(EVENT_COMPONENT_VERIFY_TICKET, data);
      } else {
        this.log.warn(`[wechat-open-koa] 第三方平台[${componentAppId}]服务将暂时不可用【原因: component_verify_ticket not exists, before call by tencent, service not be ready.`);
      }
    }
  }

  /**
   * 收到微信方发送的ticket验证
   * @param {Object} data 
   */
  /* {
    AppId: "wx304925fbea25bcbe",
    CreateTime: "1562424829"
    InfoType: "component_verify_ticket",
    ComponentVerifyTicket: 'ticket@@@lEHjsBEi_TPDey0IZxw4Zbb7JRYLOtEf9ksvDpSwzkwog3R6xEpdaK0yIee7JOyOXM0V7cp0dpM58GKmb8FSKA'
  } */
  async onReceiveComponentVerifyTicket (data) {
    // 清除超时提示
    clearTimeout(this.Timer);
    this.log.debug(`[event] [${EVENT_COMPONENT_VERIFY_TICKET}]: ${JSON.stringify(data)}`);

    let { AppId: componentAppId } = data;
    await this.cache.setComponentApp(componentAppId, data);
    if (this.timers.componentApp.Timer[componentAppId]) {
      clearTimeout(this.timers.componentApp.Timer[componentAppId]);
    }
    // 只启动一次
    this.startComponentAccessTokenTimer(componentAppId); // 定时刷新第三方平台 access token
  }

  /**
   * 定时刷新第三方平台 access token
   * @param {string} componentAppId 第三方平台APPID
   */
    async startComponentAccessTokenTimer (componentAppId) {
    let { componentAppSecret, component_access_token, ComponentVerifyTicket, retryTimes = 0, expires_at = Math.ceil(Date.now() / 1000) } = await this.cache.getComponentAppById(componentAppId);
    let timeout = 0;
  
    try {
      // 即将过期就获取新的第三方平台 access token
      // 暂时回每次收到新的ticket消息都去更新token，并更新管理的公众号和小程序list
      // if (!component_access_token || expires_at <= Math.ceil(Date.now() / 1000)) {
      this.log.debug(`[wechat-open-koa] getComponentAccessToken componentAppId: ${componentAppId}, componentAppSecret: ${componentAppSecret}, ComponentVerifyTicket: ${ComponentVerifyTicket}`);
      let ret = await getComponentAccessToken(componentAppId, componentAppSecret, ComponentVerifyTicket);
      Object.assign(ret, { componentAppId, expires_at: Math.ceil(Date.now() / 1000) + ret.expires_in - 60 * 20  }); // 提前十分钟
      // 如果成功调用，则重试次数和间隔时长回到初始值
      ret.retryTimes = 0;
      this.emit(EVENT_COMPONENT_ACCESS_TOKEN, ret); // 触发第三方平台access token更新事件
      timeout = REFRESH_INTERVAL;
      // } else {
      //   timeout = expires_at * 1000 - Date.now();
      // }
    } catch (err) {
      this.emit('error', err);
      timeout = Math.min(RETRY_TIMEOUT * Math.pow(2, retryTimes), DELAY_UPPER_LIMIT);
      await this.cache.setComponentApp(componentAppId, {retryTimes: retryTimes + 1});
    }
  
    // 清理旧的定时器
    if (this.timers.componentApp.Timer[componentAppId]) {
      clearTimeout(this.timers.componentApp.Timer[componentAppId]);
    }
    this.log.info(`[wechat-open-koa] [setTimeout] run this.startComponentAccessTokenTimer(${componentAppId}) after ${timeout / 1000} seconds`);
    this.timers.componentApp.Timer[componentAppId] = setTimeout(
      this.startComponentAccessTokenTimer.bind(this, componentAppId), timeout);
  }

  /* {
    component_access_token: 'M5CvflZyL5fkV29gU6MhQIoNsvzPEGBjYgmgA7yxnI_l8sblqm0QUULiMHoWY3gXPOnenZs3-42x_EenE1DEAg2F1K3X_fOI44h_eqxrV_7b0K7yc3pEGf_qTZl8HOlyCTSiAHAVML',
    expires_in: 7200,
    componentAppId: 'componentAppId'
  } */
  /**
   * 
   * @param {Event} EVENT_COMPONENT_ACCESS_TOKEN 
   */
  async onRefreshComponentAccessToken (data) {
    let { componentAppId } = data;
    this.log.debug(`[wechat-open-koa] [event] [${EVENT_COMPONENT_ACCESS_TOKEN}]: ${JSON.stringify(data)}`);
    await this.cache.setComponentApp(componentAppId, data);
    if (this.timers.componentApp.fetchTimer[componentAppId]) {
      clearTimeout(this.timers.componentApp.fetchTimer[componentAppId]);
    }
    this.startFetchAuthorizerListTimer(componentAppId);
  }

  /**
   * 获取第三方平台下已授权的全部授权方账号
   * @param {string} componentAppId 第三方平台APPID
   */
   async startFetchAuthorizerListTimer (componentAppId) {
    this.log.debug(`[wechat-open-koa] run this.startFetchAuthorizerListTimer(${componentAppId})`);
    let { component_access_token, fetchRetryTimes = 0 } = await this.cache.getComponentAppById(componentAppId);
    let timeout = 0;
  
    try {
      // 获取第三方平台下已授权的授权方列表
      let list = await this.getAuthorizedAppList(componentAppId, component_access_token, 0);
      this.log.debug(`[wechat-open-koa] getAuthorizedAppList list: ${JSON.stringify(list)}`);
      for (let index = 0; index < list.length; index++) {
        let item = list[index];
        item.componentAppId = componentAppId;
        await this.cache.setAuthorizerApp(item.authorizer_appid, item);
        await this.startAuthorizerAccessTokenTimer(
          componentAppId,
          item.authorizer_appid
        );
      }
    } catch (err) {
      this.emit('error', err);
      timeout = Math.min(RETRY_TIMEOUT * Math.pow(2, fetchRetryTimes), DELAY_UPPER_LIMIT);
      await this.cache.setComponentApp(componentAppId, { fetchRetryTimes: fetchRetryTimes + 1 });
    }
  
    if (timeout > 0) {
      this.timers.componentApp.fetchTimer[componentAppId] && clearTimeout(this.timers.componentApp.fetchTimer[componentAppId]); // 清理旧的定时器
      this.log.info(`[wechat-open-koa] [setTimeout] 失败重试试 run this.startFetchAuthorizerListTimer(${componentAppId}) after ${timeout / 1000} seconds`);
      this.timers.componentApp.fetchTimer[componentAppId] = setTimeout(
        this.startFetchAuthorizerListTimer.bind(this, componentAppId),
        timeout
      );
    }
  }

  /**
   * 定时刷新授权方 access token
   * @param {string} componentAppId 第三方平台APPID
   * @param {string} authorizerAppId 授权方APPID
   */
  async startAuthorizerAccessTokenTimer (componentAppId, authorizerAppId) {
    let { component_access_token } = await this.cache.getComponentAppById(componentAppId);
    let { authorizer_refresh_token, authorizer_access_token, refresh_token, retryTokenTimes = 0, expires_at = Math.ceil(Date.now() / 1000) } = await this.cache.getAuthorizerAppById(authorizerAppId);
    let timeout = 0;
  
    try {
      // 刷新授权方的access token
      if (component_access_token && authorizer_access_token && expires_at <= Math.ceil(Date.now() / 1000)) {
        this.log.debug(`[wechat-open-koa] start refresh access_token for componentAppId: ${componentAppId}, authorizerAppId: ${authorizerAppId}`);
        let ret = await refreshAccessToken(componentAppId, component_access_token, authorizerAppId, authorizer_refresh_token || refresh_token);
        ret.componentAppId = componentAppId;
        ret.authorizer_appid = authorizerAppId;
        ret.expires_at = Math.ceil(Date.now() / 1000) + ret.expires_in - 60 * 20;// 提前十分钟

        // 触发授权方access token更新事件
        this.emit(EVENT_AUTHORIZER_ACCESS_TOKEN, ret);
        // 默认刷新周期
        timeout = REFRESH_INTERVAL;
      } else {
        timeout = expires_at * 1000 - Date.now();
      }


      retryTokenTimes = 0;
      await this.cache.setAuthorizerApp(authorizerAppId, { retryTokenTimes });
    } catch (err) {
      this.emit('error', err);
      timeout = Math.min(RETRY_TIMEOUT * Math.pow(2, retryTokenTimes), DELAY_UPPER_LIMIT);
      this.cache.setAuthorizerApp(authorizerAppId, { retryTokenTimes: retryTokenTimes + 1 });
    }

    if (this.timers.authorizerApp.tokenTimer[authorizerAppId]) {
      clearTimeout(this.timers.authorizerApp.tokenTimer[authorizerAppId]);
    }
    this.log.info(`[wechat-open-koa] [setTimeout] run this.startAuthorizerAccessTokenTimer(${componentAppId}, ${authorizerAppId}) after ${timeout / 1000} seconds`);
    this.timers.authorizerApp.tokenTimer[authorizerAppId] = setTimeout(
      this.startAuthorizerAccessTokenTimer.bind(this, componentAppId, authorizerAppId),
      timeout
    );
  }

  /* {
    AppId: 'wx304925fbea25bcbe',
    CreateTime: '1562428385',
    InfoType: 'authorized',
    AuthorizerAppid: 'wxc736b9251b3c6c41',
    AuthorizationCode: 'queryauthcode@@@SozCwT_ve8WQI6Poum-qdGrrBrnQoX2rApglrUIMF0e308IQY7w_tCfAkndxzUth_YwHDto8DUsIeNrX4atetA',
    AuthorizationCodeExpiredTime: '1562431985',
    PreAuthCode: 'preauthcode@@@c4Uh5vOCS3wu9Bbx4tJWxplzkn5swwVHQc9xGtF57C1lfk_UeW50INZsh2flrwxh'
  } */
  async onAuthorized (data) {
    this.log.debug(`[wechat-open-koa] [event] [${EVENT_AUTHORIZED}]: ${JSON.stringify(data)}`);
  
    try {
      let { AppId, AuthorizerAppid, AuthorizationCode } = data;
      let { component_access_token } = await this.cache.getComponentAppById(AppId);
      await this.cache.setAuthorizerApp(AuthorizerAppid, data);

      // 获取授权方的access token
      let { authorization_info } = await getAccessToken(AppId, component_access_token, AuthorizationCode);
      authorization_info.AppId = AppId;
      authorization_info.expires_at = Math.ceil(Date.now() / 1000) + authorization_info.expires_in - 60 * 20;
      this.emit(EVENT_AUTHORIZER_ACCESS_TOKEN, authorization_info); // 触发授权方access token更新事件

      // 启动定时刷新授权方access token的功能
      this.log.info(`[wechat-open-koa] [setTimeout] run this.startAuthorizerAccessTokenTimer(${AppId}, ${AuthorizerAppid}) after ${REFRESH_INTERVAL / 1000} seconds`);
      this.timers.authorizerApp.tokenTimer[AuthorizerAppid] = setTimeout(
        this.startAuthorizerAccessTokenTimer.bind(this, AppId, AuthorizerAppid),
        REFRESH_INTERVAL
      );
    } catch (err) {
      this.emit('error', err);
    }
  }

  /* {
    AppId: 'wx304925fbea25bcbe',
    CreateTime: '1562426956',
    InfoType: 'updateauthorized',
    AuthorizerAppid: 'wxc736b9251b3c6c41',
    AuthorizationCode: 'queryauthcode@@@SozCwT_ve8WQI6Poum-qdG_rFKaepJCyhL-zx1OkvsxmmJkbZadF78t3U9lh20IaWFqb2DcLne7MGVICr5eRfQ',
    AuthorizationCodeExpiredTime: '1562430556',
    PreAuthCode: 'preauthcode@@@ivkKNYhiXXsDFLBmH2ccOCg6doXsD_RdQOS7Cxw5GoILrdQktfx_glIzmhWQrMyT'
  } */
  async onEventUpdateAuthorized(data) {
    this.log.debug(`[wechat-open-koa] [event] [${EVENT_UPDATE_AUTHORIZED}]: ${JSON.stringify(data)}`);
  }
  
  // 当授权方取消授权时触发
  async onUnauthorized (data) {
    this.log.debug(`[wechat-open-koa] [event] [${EVENT_UNAUTHORIZED}]: ${JSON.stringify(data)}`);
    let { AuthorizerAppid } = data;
    let tokenTimer = this.timers.authorizerApp.tokenTimer[AuthorizerAppid];
    let ticketTimer = this.timers.authorizerApp.ticketTimer[AuthorizerAppid];
    // 清理定时器
    tokenTimer && clearTimeout(tokenTimer);
    ticketTimer && clearTimeout(ticketTimer);
    await this.cache.setAuthorizerApp(AuthorizerAppid, {});
  }
  
  // 当授权方access token更新时触发
  /* {
    AppId: 'wx304925fbea25bcbe',
    authorizer_appid: 'wxc736b9251b3c6c41',
    authorizer_access_token: 'j7mR_dvcCAmUq5Iw-MuzE4sBT0unN-ukg7LR8EqZEQ1wZ7oyw0rs1Idk40d7uxriOubE3795JiFa3e5jDGdofRpTemXd2HLLV6p_i_Uwy7m2Rp-qv1k1ld-T9iCCDcVeQONdALDFDC',
    authorizer_refresh_token: 'refreshtoken@@@6Esz0GgFsth_vRPtqjQd_aIQcCBcJ4iuzQFf3akLwgg',
    expires_in: 7200
  } */
  async onRefreshAuthorizerAccessToken (data) {
    this.log.debug(`[wechat-open-koa] [event] [${EVENT_AUTHORIZER_ACCESS_TOKEN}]: ${JSON.stringify(data)}`);
    let { AppId, authorizer_appid, expires_in = 7200 } = data;
    await this.cache.setAuthorizerApp(authorizer_appid, data); //提前10分钟

    if (this.timers.authorizerApp.ticketTimer[authorizer_appid]) {
      clearTimeout(this.timers.authorizerApp.ticketTimer[authorizer_appid]);
      this.startAuthorizerJsApiTicketTimer(AppId, authorizer_appid);
    }
  }
  
  // 当授权方 Js Api Ticket 更新时触发
  /* {
    errcode: 0,
    errmsg: 'ok',
    ticket: 'Zqqmael1_O_ddyFwCE14BtflzySMrtVpp086SHhK3P07xXnhjii2MTmKAGQHBwPOg8GsEtR9HG_dHUngs22ayQ',
    expires_in: 7200,
    componentAppId: 'wx304925fbea25bcbe',
    authorizerAppId: 'wxc736b9251b3c6c41'
  } */
  async onRefreshAuthorizerJsApiTicket (data) {
    this.log.debug(`[wechat-open-koa] [event] [${EVENT_AUTHORIZER_JSAPI_TICKET}]: ${JSON.stringify(data)}`);
    let { authorizerAppId } = data;
    await this.cache.setAuthorizerApp(authorizerAppId, data);
  }

  async getAuthorizedAppList (componentAppId, component_access_token, offset = 0, count = PAGE_SIZE) {
    let data = [];
    let ret = await getAuthorizerList(componentAppId, component_access_token, offset, count);
    let { list = [], total_count } = ret;
    if (list.length === 0 || (list.length + offset * count >= total_count)) {
      return _.concat(data, list);
    }
    return _.concat(data, await this.getAuthorizedAppList(componentAppId, component_access_token, list.length + offset * count, count));
  }
  
  /**
   * 定时刷新授权方 Js Api Ticket
   * @param {string} componentAppId 第三方平台APPID
   * @param {string} authorizerAppId 授权方APPID
   */
  async startAuthorizerJsApiTicketTimer (componentAppId, authorizerAppId) {
    let { authorizer_access_token, retryTicketTimes = 0 } = await this.cache.getAuthorizerAppById(authorizerAppId);
    let timeout = 0;
  
    try {
      this.log.debug(`[wechat-open-koa] 定时刷新授权方 Js Api Ticket: ${authorizerAppId}`);
      let ret = await getJsApiTicket(authorizer_access_token);
      Object.assign(ret, { componentAppId, authorizerAppId });
      this.emit(EVENT_AUTHORIZER_JSAPI_TICKET, ret);
      timeout = REFRESH_INTERVAL;
      await this.cache.setAuthorizerApp(authorizerAppId, { retryTicketTimes: 0 });
    } catch (err) {
      this.emit('error', err);
      timeout = Math.min(RETRY_TIMEOUT * Math.pow(2, retryTicketTimes),DELAY_UPPER_LIMIT); // 重试的间隔时长按指数级增长，且不大于 setTimeout 的上限值
      await this.cache.setAuthorizerApp(authorizerAppId, { retryTicketTimes: retryTicketTimes + 1 });
    }
  
    if (this.timers.authorizerApp.ticketTimer[authorizerAppId]) {
      clearTimeout(this.timers.authorizerApp.ticketTimer[authorizerAppId]);
    }
    this.log.info(`[wechat-open-koa] [setTimeout] run this.startAuthorizerJsApiTicketTimer(${componentAppId}, ${authorizerAppId}) after ${timeout / 1000} seconds`);
    this.timers.authorizerApp.ticketTimer[authorizerAppId] = setTimeout(
      this.startAuthorizerJsApiTicketTimer.bind(this, componentAppId, authorizerAppId),
      timeout
    );
  }
  
  // 返回第三方平台授权事件的中间件
  events () {
    return async (ctx) => {
      try {
        ctx.res.end('success'); // 接收完请求主体后，返回 success
        let bodyRaw = ctx.request.body;
        let xml = await parseXMLSync(bodyRaw); // 解析XML数据成JS对象
  
        let { timestamp, nonce, msg_signature } = ctx.query;
        let { AppId, Encrypt } = xml;
        let { encodingAESKey, token } = await this.cache.getComponentAppById(AppId);
  
        let wechatEncrypt = new WechatEncrypt({ appId: AppId, encodingAESKey, token });
        let signature = wechatEncrypt.genSign({ timestamp, nonce, encrypt: Encrypt }); // 生成签名

        if (signature === msg_signature) {
          let str = wechatEncrypt.decode(Encrypt); // 解密数据
          let xml = await parseXMLSync(str); // 解析XML数据成JS对象
          let { InfoType } = xml;
          this.log.debug(`[wechat-open-koa] tigger event [${InfoType}]: ${JSON.stringify(xml)}`);
          this.emit(InfoType, xml); // 触发相应事件
        } else {
          this.log.warn('[wechat-open-koa] 消息签名不正确，已忽略该消息');
        }
      } catch (err) {
        this.emit('error', err);
      }
    };
  }
  
  /**
   * 返回授权方消息处理的中间件
   * @param {string} componentAppId 第三方平台APPID
   */
  message (componentAppId) {
    return async (ctx, next) => {
      try {
        let bodyRaw = ctx.request.body;
        let xml = await parseXMLSync(bodyRaw); // 解析XML数据
  
        let { timestamp, nonce, msg_signature } = ctx.query; // 解析URL参数
        let { Encrypt } = xml;
        let { encodingAESKey, token } = await this.cache.getComponentAppById(componentAppId);
  
        let wechatEncrypt = new WechatEncrypt({ appId: componentAppId, encodingAESKey, token });
        let signature = wechatEncrypt.genSign({ timestamp, nonce, encrypt: Encrypt }); // 生成签名

        if (signature === msg_signature) {
          let str = wechatEncrypt.decode(Encrypt); // 解密数据
          let xml = await parseXMLSync(str); // 解析XML数据成JS对象
          let { FromUserName, MsgType, ToUserName } = xml;
          ctx.state.wechat = xml;

          // 忽略location上报消息
          if (MsgType === 'location') {
            ctx.res.end('success');
            return;
          }
          Object.entries(msgTemplate).forEach(([key, val]) => {
            ctx.state[key] = this.genReplyFunc(componentAppId, encodingAESKey, token, ToUserName, FromUserName, key, JSON.stringify(val));
          });
          /* 回复图文消息 [[ */
          // let news = ctx.state.news;
          // ctx.state.news = (list) => news.call(ctx, { item: list }, list.length);
          // ctx.res.end(ctx.state.text(xml.Content.replace('吗', '').replace('?', '!').replace('？', '！')));
          /* 回复图文消息 ]] */
          next && await next();
        } else {
          this.log.warn('[wechat-open-koa] 消息签名不正确，已忽略该消息');
          ctx.body = 'success';
        }
      } catch (err) {
        ctx.body = 'success'; // 当发生错误时，正常响应微信服务器
        this.emit('error', err); // 如果有错误，触发错误事件
      }
    };
  }
  
  // 返回全网发布测试的中间件
  autoTest (componentAppId) {
    return async (ctx, next) => {
      let { Content = '', FromUserName, ToUserName } = ctx.state.wechat;
      if (this.autoTestOpenIdList.includes(ToUserName)) {
        try {
        // 如果接收消息的授权方是测试公众号或测试小程序，则执行预设的测试用例
          this.log.info(`[wechat-open-koa] [autoTest] [全网发布测试], 消息主体: ${JSON.stringify(ctx.state.wechat)}`);

          if (Content === AUTO_TEST_TEXT_CONTENT) {
            ctx.res.end(ctx.state.text(AUTO_TEST_REPLY_TEXT));
            this.log.info(`[wechat-open-koa] [autoTest] [测试公众号处理用户消息], 状态: 已回复; 回复内容: ${AUTO_TEST_REPLY_TEXT}(${JSON.stringify(ctx.state.text(AUTO_TEST_REPLY_TEXT))})`);
            return;
          } else if (Content.split(':')[0] === 'QUERY_AUTH_CODE') {
            this.log.info(`[wechat-open-koa] [autoTest] [测试公众号使用客服消息接口处理用户消息]`)
            let strList = Content.split(':');
            ctx.res.end('');
            let { component_access_token } = await this.cache.getComponentAppById(componentAppId);
            let { authorization_info: { authorizer_access_token } } = await getAccessToken(componentAppId, component_access_token, strList[1]);
            let content = `${strList[1]}_from_api`;
            let ret = await send(authorizer_access_token, FromUserName, 'text', { content });
            this.log.info(`[wechat-open-koa] [autoTest] [主动发送客服消息]；响应结果: ${JSON.stringify(ret)}；发送内容: ${content}`
            );
          }
        } catch (err) {
          this.emit('error', err);
        }
      } else {
        next && await next();
      }
    };
  }
  
  // 返回第三方授权处理的中间件
  auth (componentAppId, redirectUrl, authType = AUTH_TYPE_BOTH, pageStyle = PAGE_STYLE_PC) {
    return async (ctx) => {
      let { component_access_token } = await this.cache.getComponentAppById(componentAppId);
      try {
        let { pre_auth_code } = await getPreAuthCode(
          componentAppId,
          component_access_token
        );
        let url = getAuthorizationUrl(
          componentAppId,
          pre_auth_code,
          redirectUrl,
          authType,
          pageStyle
        );
        ctx.set('Content-Type', 'text/html; charset=UTF-8');
        ctx.body = htlmTemplate.replace('{url}', url);
      } catch (err) {
        this.emit('error', err);
        ctx.status = 500;
        ctx.body = err.stack;
      }
    };
  }
  
  // 返回授权方网页授权的中间件
  oauth (componentAppId, authorizerAppId, redirectUrl, scope = OAUTH_TYPE_BASE, state = '') {
    return function (ctx) {
      let url = getOAuthUrl(
        componentAppId,
        authorizerAppId,
        redirectUrl,
        scope,
        state
      );
      ctx.redirect(url);
    };
  }
  
  /**
   * 获取当前conponmentAppId的 token
   * @param {*} componentAppId 
   * @returns 
   */
  async getComponentAccessToken (componentAppId) {
    return this.cache.getComponentAppById(componentAppId);
  }
  
  async getAuthorizerAccessToken (componentAppId, authorizerAppId) {
    return this.cache.getAuthorizerAppById(authorizerAppId);
  }
  
  /**
   * 生成被动回复消息的函数
   * @param {string} componentAppId 第三方平台APPID
   * @param {string} encodingAESKey 消息加解密Key
   * @param {string} token 消息加密token
   * @param {string} fromUserName 消息发送者
   * @param {string} toUserName 消息接收者
   * @param {string} type 消息类型
   * @param {string} tpl 消息模板
   */
  genReplyFunc(componentAppId, encodingAESKey, token, fromUserName, toUserName, type, tpl) {
    return function () {
      let args = Array.prototype.slice.call(arguments);
      let timestamp = parseInt(Date.now() / 1000).toString();
      let data = {
        ToUserName: toUserName,
        FromUserName: fromUserName,
        CreateTime: timestamp,
        MsgType: type,
      };
      let json = JSON.parse(tpl, (key, val) =>
        key && typeof val === 'number' ? args[val] : val
      ); // 为JSON模板填充数据
      Object.assign(data, json); // 混合数据
  
      let wechatEncrypt = new WechatEncrypt({
        appId: componentAppId,
        encodingAESKey,
        token,
      });
      let xml = buildObject(data); // js 对象转 xml 字符串
  
      let Encrypt = wechatEncrypt.encode(xml); // 加密内容
      let TimeStamp = Date.now(); // 时间戳
      let Nonce = Math.random().toString(36).slice(2, 18); // 随机字符串
      let MsgSignature = wechatEncrypt.genSign({
        timestamp: TimeStamp,
        nonce: Nonce,
        encrypt: Encrypt,
      }); // 签名
      return buildObject({ Encrypt, TimeStamp, Nonce, MsgSignature });
    };
  }
}

module.exports = WechatOpen;
