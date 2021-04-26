'use strict';

/**
 * componentMap 的字段列表
 * {
 *     [componentAppId]: {
 *          componentAppId 第三方平台APPID
 *          componentAppSecret 第三方平台app secret
 *          token 消息校验token
 *          encodingAESKey 消息加解密Key
 *          retryTimes 重试次数
 *          fetchRetryTimes 分页获取的重试次数
 *          offset 分页获取的偏移值
 *          ComponentVerifyTicket 第三方平台 verify ticket
 *          component_access_token 第三方平台 access token
 *     },
 *     [authorizerAppId]: {
 *          componentAppId  所属的第三方平台appId
 *          authorizer_appid 授权方APPID
 *          authorizer_access_token 授权方access token
 *          authorizer_refresh_token 授权方 refresh token
 *          refresh_token 授权方 refresh token
 *          ticket 授权方 Js Api Ticket
 *          retryTokenTimes 重试 token 的次数
 *          retryTicketTimes 重试 ticket 的次数
 *     }
 * }
 */
class BaseCache {
  constructor () {
    this.componentAppList = {};
    this.authorizerAppList = {};
  }

  // eslint-disable-next-line no-unused-vars
  async getComponentAppById (componentAppId, key) {
    throw new Error('Method Must Be Overridden');
  }

  // eslint-disable-next-line no-unused-vars
  async setComponentApp(componentAppId, options) {
    throw new Error('Method Must Be Overridden');
  }


  // eslint-disable-next-line no-unused-vars
  async getAuthorizerAppById (authorizerAppId, key) {
    throw new Error('Method Must Be Overridden');
  }

  // eslint-disable-next-line no-unused-vars
  async setAuthorizerApp (authorizerAppId, options) {
    throw new Error('Method Must Be Overridden');
  }

  // eslint-disable-next-line no-unused-vars
  async delAuthorizerApp(authorizerAppId) {
    throw new Error('Method Must Be Overridden');
  }
}

module.exports = BaseCache;
