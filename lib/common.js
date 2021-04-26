const querystring = require('querystring');
const crypto = require('crypto');

const request = require('./request');
const {
  PAGE_STYLE_PC,
  PAGE_STYLE_MOBILE,
  PAGE_SIZE= 500,
} = require('./constant');


const urls = {
  getOAuthUrl: 'https://open.weixin.qq.com/connect/oauth2/authorize',
  authorizationUrlPc: 'https://mp.weixin.qq.com/cgi-bin/componentloginpage',
  authorizationUrlMobile: 'https://mp.weixin.qq.com/safe/bindcomponent',
  clearQuota: '/cgi-bin/component/clear_quota',
  getComponentAccessToken: '/cgi-bin/component/api_component_token',
  getPreAuthCode: '/cgi-bin/component/api_create_preauthcode',
  getAuthorizerList: '/cgi-bin/component/api_get_authorizer_list',
  getAccessToken: '/cgi-bin/component/api_query_auth',
  getJsApiTicket: '/cgi-bin/ticket/getticket',
  getAuthorizerInfo: '/cgi-bin/component/api_get_authorizer_info',
  getAuthorizerOptionInfo: '/cgi-bin/component/api_get_authorizer_option',
  setAuthorizerOption: '/cgi-bin/component/api_set_authorizer_option',
  createOpenAccount: '/cgi-bin/open/create',
  bindOpenAccount: '/cgi-bin/open/bind',
  unbindOpenAccount: '/cgi-bin/open/unbind',
  getOpenAccount: '/cgi-bin/open/get',
  getOauthAccessToken: '/sns/oauth2/component/access_token',
  getUserInfo: '/sns/userinfo',
  refreshAccessToken: '/cgi-bin/component/api_authorizer_token',
  send: '/cgi-bin/message/custom/send',
};

/**
 * 第三方平台对其所有API调用次数清零
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAccessToken 第三方平台access token
 */
async function clearQuota(componentAppId, componentAccessToken) {
  let url = urls.clearQuota;
  let query = { component_access_token: componentAccessToken };
  let body = { component_appid: componentAppId };
  url += '?' + querystring.stringify(query);

  return request.post(url, body);
}

/**
 * 获取第三方平台的access token
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAppSecret 第三方平台APP SECRET
 * @param {string} componentVerifyTicket 第三方平台verify ticket
 */
async function getComponentAccessToken(
  componentAppId,
  componentAppSecret,
  componentVerifyTicket
) {
  let url = urls.getComponentAccessToken;
  let body = {
    component_appid: componentAppId,
    component_appsecret: componentAppSecret,
    component_verify_ticket: componentVerifyTicket,
  };
  return request.post(url, body);
}

/**
 * 获取第三方平台预授权码
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAccessToken 第三方平台access token
 */
async function getPreAuthCode(componentAppId, componentAccessToken) {
  let url = urls.getPreAuthCode;
  let query = { component_access_token: componentAccessToken };
  let body = { component_appid: componentAppId };
  url += '?' + querystring.stringify(query);

  return request.post(url, body);
}

/**
 * 获取第三方平台授权URL
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} preAuthCode 第三方平台预授权码
 * @param {string} redirectUrl 授权后的重定向地址
 * @param {number|string} authType 授权类型；bizAppId 指定授权方APPID
 * @param {number} pageStyle 页面风格
 */
function getAuthorizationUrl(
  componentAppId,
  preAuthCode,
  redirectUrl,
  authType,
  pageStyle
) {
  let url = {
    [PAGE_STYLE_PC]: urls.authorizationUrlPc,
    [PAGE_STYLE_MOBILE]: urls.authorizationUrlMobile,
  }[pageStyle];

  let query = {
    component_appid: componentAppId,
    pre_auth_code: preAuthCode,
    redirect_uri: redirectUrl,
  };

  if (typeof authType === 'number') {
    Object.assign(query, { auth_type: authType });
  } else if (typeof authType === 'string') {
    Object.assign(query, { biz_appid: authType });
  }

  if (pageStyle === PAGE_STYLE_MOBILE) {
    Object.assign(query, { action: 'bindcomponent', no_scan: 1 });
    url += '?' + querystring.stringify(query) + '#wechat_redirect';
  } else if (pageStyle === PAGE_STYLE_PC) {
    url += '?' + querystring.stringify(query);
  }

  return url;
}

/**
 * 获取第三方平台的授权方列表
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAccessToken 第三方平台access token
 */
async function getAuthorizerList(componentAppId, componentAccessToken, offset, count = PAGE_SIZE) {
  let url = urls.getAuthorizerList;
  let query = { component_access_token: componentAccessToken };
  let body = { component_appid: componentAppId, offset, count };
  url += '?' + querystring.stringify(query);

  return request.post(url, body);
}


/**
 * 获取授权方的access token
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAccessToken 第三方平台access token
 * @param {string} authorizationCode 授权码。公众号或小程序授权给第三方平台时得到
 */
async function getAccessToken(
  componentAppId,
  componentAccessToken,
  authorizationCode
) {
  let url = urls.getAccessToken;
  let query = { component_access_token: componentAccessToken };
  const body = {
    component_appid: componentAppId,
    authorization_code: authorizationCode,
  };
  url += '?' + querystring.stringify(query);

  return request.post(url, body);
  
}

/**
 * 获取授权方的js api ticket
 * @param {string} authorizerAccessToken 授权方的access token
 */
async function getJsApiTicket(authorizerAccessToken) {
  let url = urls.getJsApiTicket;
  let query = { access_token: authorizerAccessToken, type: 'jsapi' };
  url += '?' + querystring.stringify(query);
  return request.get(url);

  
}

/**
 * 获取授权方的账号基本信息
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAccessToken 第三方平台 access token
 * @param {string} authorizerAppId 授权方APPID
 */
async function getAuthorizerInfo(
  componentAppId,
  componentAccessToken,
  authorizerAppId
) {
  let url = urls.getAuthorizerInfo;
  let query = { component_access_token: componentAccessToken };
  let body = {
    component_appid: componentAppId,
    authorizer_appid: authorizerAppId,
  };
  url += '?' + querystring.stringify(query);

  return request.post(url, body);
  
}

/**
 * 获取授权方的选项设置信息
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAccessToken 第三方平台 access token
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} optionName 选项名
 */
async function getAuthorizerOptionInfo(
  componentAppId,
  componentAccessToken,
  authorizerAppId,
  optionName
) {
  let url = urls.getAuthorizerOptionInfo;
  let query = { component_access_token: componentAccessToken };
  let body = {
    component_appid: componentAppId,
    authorizer_appid: authorizerAppId,
    option_name: optionName,
  };
  url += '?' + querystring.stringify(query);

  return request.post(url, body);

  
}

/**
 * 设置授权方选项信息
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAccessToken 第三方平台 access token
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} optionName 选项名
 * @param {number} optionValue 选项值
 */
async function setAuthorizerOption(
  componentAppId,
  componentAccessToken,
  authorizerAppId,
  optionName,
  optionValue
) {
  let url = urls.setAuthorizerOption;
  let query = { component_access_token: componentAccessToken };
  let body = {
    component_appid: componentAppId,
    authorizer_appid: authorizerAppId,
    option_name: optionName,
    option_value: optionValue.toString(),
  };
  url += '?' + querystring.stringify(query);

  return request.post(url, body);
  
}

/**
 * 创建开放平台帐号并绑定公众号/小程序
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} authorizerAccessToken 授权方 access token
 */
async function createOpenAccount(authorizerAppId, authorizerAccessToken) {
  let url = urls.createOpenAccount;
  let query = { access_token: authorizerAccessToken };
  let body = { appid: authorizerAppId };
  url += '?' + querystring.stringify(query);

  return request.post(url, body);
  
}

/**
 * 将公众号/小程序绑定到开放平台帐号下
 * @param {string} openAppId 开放平台账号appid
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} authorizerAccessToken 授权方 access token
 */
async function bindOpenAccount(openAppId, authorizerAppId, authorizerAccessToken) {
  let url = urls.bindOpenAccount;
  let query = { access_token: authorizerAccessToken };
  let body = { appid: authorizerAppId, open_appid: openAppId };
  url += '?' + querystring.stringify(query);

  return request.post(url, body);
  
}

/**
 * 将公众号/小程序从开放平台帐号下解绑
 * @param {string} openAppId 开放平台账号appid
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} authorizerAccessToken 授权方 access token
 */
async function unbindOpenAccount(openAppId, authorizerAppId, authorizerAccessToken) {
  let url = urls.unbindOpenAccount;
  let query = { access_token: authorizerAccessToken };
  let body = { appid: authorizerAppId, open_appid: openAppId };
  url += '?' + querystring.stringify(query);

  return request.post(url, body);
  
}

/**
 * 获取公众号/小程序所绑定的开放平台帐号
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} authorizerAccessToken 授权方access token
 */
async function getOpenAccount(authorizerAppId, authorizerAccessToken) {
  let url = urls.getOpenAccount;
  let query = { access_token: authorizerAccessToken };
  let body = { appid: authorizerAppId };
  url += '?' + querystring.stringify(query);

  return request.post(url, body);
  
}

/**
 * 获取授权方的Js API config
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} authorizerJsApiTicket 授权方 js api ticket
 * @param {string} url 要配置的url
 */
function getJsApiConfig(authorizerAppId, authorizerJsApiTicket, url) {
  let noncestr = Math.random().toString(36).slice(2); // 随机字符串
  let timestamp = Math.ceil(Date.now() / 1000); // 时间戳
  url = url.split('#')[0];

  let params = { noncestr, timestamp, url, jsapi_ticket: authorizerJsApiTicket }; // 待签名参数
  let keyList = Object.keys(params); // 取全部字段名

  keyList.sort(); // 将字段名按 ASCII 排序
  let rawStr = keyList.map((key) => `${key}=${params[key]}`).join('&'); // 将全部键值对拼接成字符串

  let signature = crypto.createHash('sha1').update(rawStr).digest('hex'); // 生成签名

  return { appId: authorizerAppId, timestamp, nonceStr: noncestr, signature };
}

/**
 * 获取授权方网页授权URL
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} redirectUrl 授权后的重定向URL
 * @param {string} scope 授权类型
 * @param {string} state 授权附带值
 */
function getOAuthUrl(componentAppId, authorizerAppId, redirectUrl, scope = 'snsapi_base', state = '') {
  const url = urls.getOAuthUrl;
  const query = {
    appid: authorizerAppId,
    redirect_uri: encodeURIComponent(redirectUrl),
    response_type: 'code',
    scope,
    state,
    component_appid: componentAppId,
  };
  const keys = [
    'appid',
    'redirect_uri',
    'response_type',
    'scope',
    'state',
    'component_appid',
  ];
  const iteration = function (item) {
    return item + '=' + query[item];
  };
  const querystr = keys.map(iteration).join('&');
  const newUrl = url + '?' + querystr + '#wechat_redirect';
  return newUrl;
}

/**
 * 获取授权方的网页授权access token
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAccessToken 第三方平台access token
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} code 网页授权code
 */
async function getOauthAccessToken(
  componentAppId,
  componentAccessToken,
  authorizerAppId,
  code
) {
  let url = urls.getOauthAccessToken;
  let query = {
    appid: authorizerAppId,
    code,
    grant_type: 'authorization_code',
    component_appid: componentAppId,
    component_access_token: componentAccessToken,
  };
  url += '?' + querystring.stringify(query);
  return request.get(url);
  
}

/**
 * 获取微信用户信息
 * @param {string} authorizerAccessToken 授权方access token
 * @param {string} openId 微信用户openId
 */
async function getUserInfo(authorizerAccessToken, openId) {
  let url = urls.getUserInfo;
  let query = {
    access_token: authorizerAccessToken,
    openid: openId,
    lang: 'zh_CN',
  };
  url += '?' + querystring.stringify(query);
  return request.get(url);
  
}

/**
 * 刷新授权方的 access token
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAccessToken 第三方平台access token
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} authorizerRefreshToken 授权方 refresh token
 */
async function refreshAccessToken(componentAppId, componentAccessToken, authorizerAppId, authorizerRefreshToken) {
  let url = urls.refreshAccessToken;
  let query = { component_access_token: componentAccessToken };
  let body = {
    component_appid: componentAppId,
    authorizer_appid: authorizerAppId,
    authorizer_refresh_token: authorizerRefreshToken,
  };
  url += '?' + querystring.stringify(query);

  return request.post(url, body);
  
}

/**
 * 发送客服消息
 * @param {string} authorizerAccessToken 授权方access token
 * @param {string} openId 微信用户openId
 * @param {string} type 消息类型
 * @param {Object} content 消息主体
 */
async function send(authorizerAccessToken, openId, type, content) {
  let url = urls.send;
  let query = {
    access_token: authorizerAccessToken,
  };
  let body = {
    touser: openId,
    msgtype: type,
    [type]: content,
  };
  url += '?' + querystring.stringify(query);

  return request.post(url, body);
  
}

module.exports = {
  getAccessToken,
  getJsApiTicket,
  getAuthorizerInfo,
  getAuthorizerOptionInfo,
  setAuthorizerOption,
  createOpenAccount,
  bindOpenAccount,
  unbindOpenAccount,
  getOpenAccount,
  getJsApiConfig,
  getOAuthUrl,
  getOauthAccessToken,
  getUserInfo,
  refreshAccessToken,
  send,
  clearQuota,
  getComponentAccessToken,
  getPreAuthCode,
  getAuthorizationUrl,
  getAuthorizerList,

};
