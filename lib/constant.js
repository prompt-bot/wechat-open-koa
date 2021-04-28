module.exports = {
  WECHAT_API: 'https://api.weixin.qq.com',

  HTTP_STATUS_CODE_OK: 200,

  // 第三方平台授权类型列表
  AUTH_TYPE_MP: 1, // 授权方手机端只展示公众号列表
  AUTH_TYPE_MINI_PROGRAM: 2, // 授权方手机端只展示小程序列表
  AUTH_TYPE_BOTH: 3, // 授权方手机端展示公众号和小程序列表

  // 第三方平台授权页样式
  PAGE_STYLE_PC: 1, // 适用于PC的页面样式
  PAGE_STYLE_MOBILE: 2, // 适用于移动设备的页面样式

  // 获取第三方平台已授权账号列表的分页大小
  PAGE_SIZE: 500,

  DELAY_UPPER_LIMIT: Math.pow(2, 31) - 1, // setTimeout 的延时上限值
  REFRESH_INTERVAL: 1000 * 60 * 100, // 刷新间隔，单位: 毫秒。1小时50分钟
  RETRY_TIMEOUT: 1000, // 重试的超时时间，单位: 毫秒。
  TIPS_TIMEOUT: 1000 * 5, // 超时则提示 component_verity_ticket 未就绪，单位: 毫秒
  WARN_TIPS: '第三方平台服务将暂时不可用【原因: 未收到微信服务器推送 component_verify_ticket】',

  // 事件列表
  EVENT_COMPONENT_VERIFY_TICKET: 'component_verify_ticket', // 当微信服务器向第三方服务器推送 ticket 时触发
  EVENT_AUTHORIZED: 'authorized', // 当有新的公众号授权给第三方平台时触发
  EVENT_UPDATE_AUTHORIZED: 'updateauthorized', // 当已授权公众号的授权权限更新时触发
  EVENT_UNAUTHORIZED: 'unauthorized', // 当已授权公众号取消授权时触发
  EVENT_COMPONENT_ACCESS_TOKEN: 'component_access_token', // 当component_access_token刷新时触发
  EVENT_AUTHORIZER_ACCESS_TOKEN: 'authorizer_access_token', // 当授权方access token更新时触发
  EVENT_AUTHORIZER_JSAPI_TICKET: 'authorizer_jsapi_ticket', // 当授权方 Js Api Ticket 更新时触发

  // 全网发布自动化测试的账号
  // AUTO_TEST_MP_APPID: 'wx570bc396a51b8ff8', // 测试公众号APPID
  // 测试公众号名称
  AUTO_TEST_MP_NAME: [
    {
      appid: 'wx570bc396a51b8ff8',
      Username: 'gh_3c884a361561',
    },
    {
      appid: 'wx9252c5e0bb1836fc',
      Username: 'gh_c0f28a78b318',
    },
    {
      appid: 'wx8e1097c5bc82cde9',
      Username: 'gh_3f222ed8d140',
    },
    {
      appid: 'wx14550af28c71a144',
      Username: 'gh_26128078e9ab',
    },
    {
      appid: 'wxa35b9c23cfe664eb',
      Username: 'gh_2b3713f184a6',
    },
  ],
  // AUTO_TEST_MINI_PROGRAM_APPID: 'wxd101a85aa106f53e', // 测试小程序APPID
  // 测试小程序名称
  AUTO_TEST_MINI_PROGRAM_NAME: [
    {
      appid: 'wxd101a85aa106f53e',
      Username: 'gh_8dad206e9538',
    },
    {
      appid: 'wxc39235c15087f6f3',
      Username: 'gh_905ae9d01059',
    },
    {
      appid: 'wx7720d01d4b2a4500',
      Username: 'gh_393666f1fdf4',
    },
    {
      appid: 'wx05d483572dcd5d8b',
      Username: 'gh_39abb5d4e1b7',
    },
    {
      appid: 'wx5910277cae6fd970',
      Username: 'gh_7818dcb60240',
    },
  ],

  AUTO_TEST_TEXT_CONTENT: 'TESTCOMPONENT_MSG_TYPE_TEXT',
  AUTO_TEST_REPLY_TEXT: 'TESTCOMPONENT_MSG_TYPE_TEXT_callback',

  // authorzied
  // 授权方网页授权类型
  OAUTH_TYPE_BASE: 'snsapi_base', // 基本授权可以得到用户openId
  OAUTH_TYPE_USERINFO: 'snsapi_userinfo', // 用户信息授权可以得到用户openId、unionId、头像和昵称

  // 客服消息类型列表
  MSG_TYPE_TEXT: 'text',
  MSG_TYPE_IMAGE: 'image',
  MSG_TYPE_VOICE: 'voice',
  MSG_TYPE_VIDEO: 'video',
  MSG_TYPE_MUSIC: 'music',
  MSG_TYPE_NEWS: 'news', // 图文消息（点击跳转到外链）
  MSG_TYPE_MP_NEWS: 'mpnews', // 图文消息（点击跳转到图文消息页面）
  MSG_TYPE_MSG_MENU: 'msgmenu', // 菜单消息
  MSG_TYPE_WX_CARD: 'wxcard', // 卡券
  MSG_TYPE_MINI_PROGRAM_PAGE: 'miniprogrampage', // 小程序卡片
};
