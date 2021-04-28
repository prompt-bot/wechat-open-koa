'use strict';

const _ = require('lodash');
const { AUTH_TYPE_BOTH, PAGE_STYLE_PC, OAUTH_TYPE_USERINFO } = require('../index');

const service = require('./service');

module.exports = {
  index: async ctx => {
    ctx.body = 'Example for wechat-open-koa';
  },
  refresh: async ctx => {
    await service.refresh()
    ctx.body = { status: 'success' };
  },
  events: async (ctx, next) => {
    const toolkit = await service.init();
    await toolkit.events()(ctx, next);
  },
  authCode: async (ctx) => {
    const { auth_code, expires_in } = ctx.query;
    ctx.body = await service.authorizerCode({ auth_code, expires_in });
  },
  oauthCode: async (ctx) => {
    const { code, appid: authorizerAppId, state } = ctx.query;
    const componentAppId = Buffer.from(state, 'base64').toString('ascii');
    ctx.body = await service.oauthorizerCode({ componentAppId, authorizerAppId, code });
  },
  auth: async (ctx, next) => {
    const { componentAppId } = ctx.params;
    const { pageStyle = PAGE_STYLE_PC } = ctx.query;

    const toolkit = await service.init();
    let authMiddleware = toolkit.auth(componentAppId, `${ctx.request.origin}/api/wechat/open/authcode`, AUTH_TYPE_BOTH, _.toNumber(pageStyle)); // 第三方平台网页授权中间件
    return authMiddleware(ctx, next);
  },
  sendMsg: async (ctx) => {
    const { openid, component_appid, appid, msgType, text } = ctx.query;
    if (msgType === 'text') {
      const wechatApi = await service.getCoApi(appid, component_appid);
      ctx.body = await wechatApi.sendText(openid, text);
    }
  },
  message: async (ctx) => {
    const { componentAppId } = ctx.params;
    const toolkit = await service.init();
    let msgMiddleware = toolkit.message(componentAppId); // 授权方用户消息接收中间件
    let autoTestMiddleware = toolkit.autoTest(componentAppId); // 第三方平台全网发布测试中间件
    await msgMiddleware(ctx);
    await autoTestMiddleware(ctx);
    let func = ctx.state.text || function () { return 'success'; };
    ctx.body = func(_.get(ctx, 'state.wechat.Content', '').replace('吗', '').replace('?', '!').replace('？', '！'));
  },
  oauth: async (ctx, next) => {
    const { componentAppId, authorizerAppId } = ctx.params;
    const toolkit = await service.init();
    let state = Buffer.from(componentAppId).toString('base64');
    let oauthMiddleware = toolkit.oauth(componentAppId, authorizerAppId, `${ctx.request.origin}/api/wechat/open/oauthcode`, OAUTH_TYPE_USERINFO, state); // 授权方网页授权中间件
    return oauthMiddleware(ctx, next);
  },
};