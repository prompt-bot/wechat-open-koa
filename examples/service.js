
const _ = require('lodash');
const { WechatOpen, Request, BaseCache } = require('../index');
const CoWechatApi = require('co-wechat-api');


let toolkit = null;

const list = [{
  componentAppId: _.get(process.env, 'COMPONENT_APP_ID'), // 微信第三方平台 appId
  componentAppSecret: _.get(process.env, 'COMPONENT_APP_SECRET'), // 微信第三方平台 appSecret
  token: _.get(process.env, 'COMPONENT_TOKEN'), // 消息校验 Token
  encodingAESKey: _.get([process.env, 'COMPONENT_AES_KEY']), // 消息加解密 key
}];

module.exports = {
  init: async () => {
      if (toolkit) return toolkit;
      toolkit = new WechatOpen({ list });
      toolkit.on('error', (err) => {
          console.error(err);
        });
      await toolkit.initialize();
      return toolkit;
    },
  refresh: async () => {
    toolkit = null;
    await this.init();
  },
  getCoApi: async (authorizerAppId) => {
    const { authorizer_access_token: accessToken, expires_at: expireTime } = await toolkit.cache.getAuthorizerAppById(authorizerAppId) || {};
    let coApi = new CoWechatApi('', '', async () => {
      const token = {
        accessToken,
        expireTime: expireTime * 1000,
      };
      return token;
    }, true);
    return coApi;
  },
  authorizerCode: async (params) => {
    return { status: 'success' };
  },
  oauthorizerCode: async ({ componentAppId, authorizerAppId, code }) => {
    if (toolkit) {
      const { component_access_token } = await toolkit.cache.getComponentAppById(componentAppId);
      const authorizerAccessToken = await Request.getOauthAccessToken(componentAppId, component_access_token, authorizerAppId, code);
      const { openid, access_token: accessToken } = authorizerAccessToken;
      return Request.getUserInfo(accessToken, openid);
    }
    return {};
  }
}