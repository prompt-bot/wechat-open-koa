# wechat-open-koa 微信开放平台工具套件

**Node.js 微信第三方服务平台。**

## 示例代码

```bash
yarn add wechat-open-koa
```

```javascript
const Koa = require('koa')
const app = new Koa()
const { WechatOpen, Request, Constant } = require('wechat-open-koa')
const _ = require('lodash')

// 微信第三方平台列表信息
// 请先申请公众平台账号，在创建服务平台应用，获取一下信息
let list = [
    {
        componentAppId: '', // 微信第三方平台 appId
        componentAppSecret: '', // 微信第三方平台 appSecret
        token: '', // 消息校验 Token
        encodingAESKey: '' // 消息加解密 key
    }
]
class Cache extends BaseCache {
    // TODO
}

let toolkit = new Request({ list, log: console, cache: new Cache() })


// 第三方平台事件接收中间件
app.use('/wechat/events', toolkit.events())

// 授权第三方平台接管公众号或者小程序管理权限
app.get(`/wechat/auth/:componentAppId`, (ctx, next) => {
    const { componentAppId } = ctx.params;
    const { pageStyle = Constant.PAGE_STYLE_PC } = ctx.query;

    let authMiddleware = toolkit.auth(componentAppId, `${ctx.request.origin}/api/wechat/open/authcode`, AUTH_TYPE_BOTH, _.toNumber(pageStyle)); // 第三方平台网页授权中间件
    return authMiddleware(ctx, next);
})

// 公众号消息接收URL,处理全网发布
app.post('/wechat/open/message/:componentAppId/:authorizerAppId', async (ctx) => {
    const { componentAppId } = ctx.params;
    let msgMiddleware = toolkit.message(componentAppId); // 授权方用户消息接收中间件
    let autoTestMiddleware = toolkit.autoTest(componentAppId); // 第三方平台全网发布测试中间件

    await msgMiddleware(ctx);
    await autoTestMiddleware(ctx);
    let func = ctx.state.text || function () { return 'success'; };
    ctx.res.end(func(_.get(ctx, 'state.wechat.Content', '').replace('吗', '').replace('?', '!').replace('？', '！')));
})

// 通过微信登陆获取用户信息
app.get('/wechat/open/oauth/:componentAppId/:authorizerAppId', async (ctx, next) => {
    const { componentAppId, authorizerAppId } = ctx.params;
    let state = Buffer.from(componentAppId).toString('base64');
    let oauthMiddleware = toolkit.oauth(componentAppId, authorizerAppId, `${ctx.request.origin}/api/wechat/open/oauthcode`, Constant.OAUTH_TYPE_USERINFO, state); // 授权方网页授权中间件
    return oauthMiddleware(ctx, next);
})
// 处理微信dengue回调
app.ge('/wechat/open/oauthcode', async (ctx) => {
    const { code, appid: authorizerAppId, state } = ctx.query;
    const componentAppId = Buffer.from(state, 'base64').toString('ascii');
    let { component_access_token } = await toolkit.cache.getComponentAppById(componentAppId);
    let { openid, access_token: accessToken } = await toolkit.cache.getOauthAccessToken(componentAppId, component_access_token, authorizerAppId, code);
    ctx.body = await Request.getUserInfo(accessToken, openid);
})

app.listen(3000)
console.log('server start at 3000')
```


### 接入 co-wechat-api 示例代码

```javascript
const CoWechatApi = require('co-wechat-api')

let store = {} // 缓存数据

let componentAppId = 'test app id'
let authorizerAppId = 'test app id'

let coApi = new CoWechatApi('', '', async () => {
    const { authorizer_access_token: accessToken, expires_at: expireTime } = await toolkit.cache.getAuthorizerAppById(authorizerAppId) || {};
    let coApi = new CoWechatApi('', '', async () => {
      const token = {
        accessToken,
        expireTime: expireTime * 1000,
      };
    return token;
}, true /* tokenFromCustom = true */)


// 该功能需等到 access token 首次更新后，才能调用 日志: [wechat-open-koa] [setTimeout] run this.startAuthorizerAccessTokenTimer...
await coApi.sendText()
///
```

**示例代码仅供参考，根据实际情况调整。**

### 微信第三方平台要求配置2个URL，分别推送第三方平台事件和公众号事件，列表整理如下：

- **授权事件接收URL**
  - **component_verity_ticket 当微信服务器推送 component_verity_ticket 时触发**
  - **authorized 当有新的公众号授权给第三方平台时触发**
  - **updateauthorized 当已授权公众号修改授权给第三方平台的权限时触发**
  - **unauthorized 当已授权公众号取消授权时触发**
- **公众号消息接收URL**
  - **推送用户与公众号的消息**
  - **用户点击底部菜单、关注、取消关注、扫码事件**

### 微信开放平台 和 微信第三方平台

微信开放平台账号需要在 [微信开放平台](https://open.weixin.qq.com/) 注册，注册后得到账号和密码。(注册时提供的邮箱之前未注册过公众号和小程序)

一个微信开放平台账号可以创建多个第三方平台，创建后得到第三方平台的 **appId** 和 **appSecret**。也就是代码中使用的**componentAppId**、**componentAppSecret** 。(第三方平台的数量有上限，定制化开发服务商类型上限是**5个**、平台型服务商类型上限是**5个**)



### 实例方法 `class WechatOpen`：

- **auth(componentAppId, redirectUrl [, authType])** [返回第三方平台授权中间件](#auth)

- **events()** [返回第三方平台授权事件处理中间件](#events)

- **message(componentAppId)** [返回授权方消息处理中间件](#message)

- **autoTest(componentAppId)** [返回全网发布测试用例的中间件](#autoTest)

- **oauth(componentAppId, authorizerAppId, redirectUrl [, scope [, state]])** [返回授权方网页授权中间件](#oauth)
#### auth

返回第三方平台授权中间件。

- **componentAppId** \<string\> 第三方平台APPID
- **redirectUrl** \<string\> 授权成功后重定向的URL
- **authType** \<number|string\> 授权的类型
- **pageStyle** \<number\> 页面样式

**redirectUrl** 该链接的域名必须和当前服务的域名相同，而且和微信第三方平台配置的域名相同。

**authType** 指定授权时显示的可选项。**1** 表示仅展示公众号、**2** 表示仅展示小程序、**3** 表示展示公众号和小程序。默认为 **3** 。也可以传入授权方 APPID，指定授权方。

**pageStyle** 指定授权页面的样式。**1** 表示PC扫码授权；**2** 表示微信浏览器打开。默认值为 **1**。

```javascript
const { Constand: { AUTH_TYPE_BOTH, PAGE_STYLE_PC } } = require('wechat-open-koa')
let componentAppId = 'wx52ffab2939ad'
let redirectUrl = 'https://domain.com/authorized'
let authMiddleware = toolkit.auth(componentAppId, redirectUrl, AUTH_TYPE_BOTH, PAGE_STYLE_PC)

// 浏览器打开该路由即可扫码授权
app.get(`/wechat/auth/${componentAppId}`, authMiddleware)
```

#### events

返回第三方平台授权事件处理中间件。

```javascript
app.use('/wechat/events', toolkit.events())
```

#### message

返回授权方消息处理中间件

- **componentAppId** \<string\> 第三方平台appId

```javascript
const componentAppId = 'wx52ffab2939ad'
let msgMiddleware = toolkit.message(componentAppId) // 用户消息中间件

app.post(`/wechat/message/${componentAppId}/:authorizerAppId`, msgMiddleware, (ctx, next) => {
    console.log(ctx.state.wechat)
    /**
    {
        ToUserName: 'gh_2a33e5f5a9b0',
        FromUserName: 'oVtjJv5NEub-fbE7E6_P2_jCLMXo',
        CreateTime: '1508406464',
        MsgType: 'text',
        Content: 'hello world',
        MsgId: '6478556432393017916'
    }
    */
})
```

#### 被动回复消息功能

当第三方平台收到授权方用户消息时，可以使用被动回复功能回复消息。

- **ctx.state.text(content)** 回复文本消息
- **ctx.state.image(mediaId)** 回复图片
- **ctx.state.voice(mediaId)** 回复语音
- **ctx.state.video(mediaId [, title [, description]])** 回复视频
- **ctx.state.music(thumbMediaId [, HQMusicUrl [, musicUrl [, title [, description]]]])** 回复音乐
- **ctx.state.news(articles)** 回复图文
  - **Title** 标题
  - **Description** 描述
  - **Url** 跳转链接
  - **PicUrl** 缩略图链接

```javascript
let componentAppId = 'wx52ffab2939ad' // 第三方平台APPID
let msgMiddleware = toolkit.message(componentAppId) // 用户消息中间件

app.post(`/wechat/message/${componentAppId}/:authorizerAppId`, msgMiddleware, (ctx, next) => {
    let { MsgType, Content, MediaId, Label, Title, Description, Url} = ctx.state.wechat
    switch (MsgType) {
        case 'text':
            ctx.state.text(Content) // 被动回复文本消息
            break;
        case 'image':
            ctx.state.image(MediaId) // 被动回复图片消息
            break;
        case 'voice':
            ctx.state.voice(MediaId) // 被动回复语音消息
            break;
        case 'video':
            ctx.state.video(MediaId) // 被动回复视频消息
            break;
        case 'location':
            ctx.state.text(Label)
            break;
        case 'link':
            ctx.state.news([{ Title, Description, Url }])
    }
})
```

#### autoTest

返回全网发布测试用例的中间件。该中间件需要放置在 [message](#message) 中间件后面，以及其他中间件前面。

- **componentAppId** \<string\> 第三方平台APPID

```javascript
let componentAppId = 'wx52ffab2939ad'
let msgMiddleware = toolkit.message(componentAppId) // 用户消息中间件
let testMiddleware = toolkit.autoTest(componentAppId) // 全网发布测试中间件

app.post(`/wechat/message/${componentAppId}/:authorizerAppId`, msgMiddleware, testMiddleware, (ctx, next) => {
    ctx.body = 'success'; // 响应微信服务器
    console.log(ctx.state.wechat)
})
```

#### oauth

返回第三方平台代理微信公众号网页授权中间件。

- **componentAppId** \<string\> 第三方平台APPID
- **authorizerAppId** \<string\> 授权方APPID
- **redirectUrl** \<string\> 授权成功后的重定向URL
- **scope** \<string\> 网页授权的类型。可选
- **state** \<string\> 授权的附带值。可选

**scope 为授权作用域。可能的值为：snsapi_base 和 snsapi_userinfo。默认为：snsapi_base**

```javascript
const { Constant } = require('wechat-open-koa')
let componentAppId = 'wx304925fbea25bcbe'
let authorizerAppId = 'wxc736b9251b3c6c41'
let redirectUrl = 'https://domain.com/authorized'
let oauthMiddleware = toolkit.oauth(componentAppId, authorizerAppId, redirectUrl, Constant.OAUTH_TYPE_USERINFO)

app.get(`/wechat/oauth/${componentAppId}/${authorizerAppId}`, oauthMiddleware)
```


### 类方法 `Request`：

- **getAuthorizerInfo(componentAppId, componentAccessToken, authorizerAppId)** [获取授权方的账号基本信息](#getauthorizerinfo)

- **clearQuota(componentAppId, componentAccessToken)** [第三方平台对其所有API调用次数清零](#clearquota)

- **getJsApiConfig(authorizerAppId, authorizerJsApiTicket, url)** [获取授权方 js sdk 配置](#getjsapiconfig)

- **getOauthAccessToken(componentAppId, componentAccessToken, authorizerAppId, code)** [获取授权方网页授权 access token](#getoauthaccesstoken)

- **getUserInfo(authorizerAccessToken, openId)** [获取授权方微信用户基本信息](#getuserinfo)

- **send(authorizerAccessToken, openId, type, content)** [发送客服消息](#send)

- **getAuthorizerOptionInfo(componentAppId, componentAccessToken, authorizerAppId, optionName)** [获取授权方的选项设置信息](#getauthorizeroptioninfo)

- **setAuthorizerOption(componentAppId, componentAccessToken, authorizerAppId, optionName, optionValue)** [设置授权方选项信息](#setauthorizeroption)

- **createOpenAccount(authorizerAppId, authorizerAccessToken)** [创建开放平台帐号并绑定公众号/小程序](#createopenaccount)

- **bindOpenAccount(openAppId, authorizerAppId, authorizerAccessToken)** [将公众号/小程序绑定到开放平台帐号下](#bindopenaccount)

- **unbindOpenAccount(openAppId, authorizerAppId, authorizerAccessToken)** [将公众号/小程序从开放平台帐号下解绑](#unbindopenaccount)

- **getOpenAccount(authorizerAppId, authorizerAccessToken)** [获取公众号/小程序所绑定的开放平台帐号](#getopenaccount)


#### getAuthorizerInfo

获取授权方的账号基本信息

```javascript
let ret = await Request.getAuthorizerInfo(componentAppId, componentAccessToken, authorizerAppId)
```

#### getJsApiConfig

获取授权方的 js sdk 配置对象

- **authorizerAppId** \<string\> 授权方APPID
- **authorizerJsApiTicket** \<string\> 授权方 JsApi Ticket
- **url** \<string\> 要配置的网页链接

```javascript
let conf = Request.getJsApiConfig(authorizerAppId, authorizerJsApiTicket, url)
/**
{
    appId: '',
    timestamp: 158923408,
    nonceStr: '292jslk30dk',
    signature: '20kjafj20dfhl2j0sjhk2h3f0afjasd2'
}
*/
```

#### getOauthAccessToken

获取授权方的网页授权 access token

- **componentAppId** \<string\> 第三方平台APPID
- **componentAccessToken** \<string\>
- **authorizerAppId** \<string\> 授权方APPID
- **code** \<string\> 网页授权后得到的临时 code

```javascript
let ret = await Request.getOauthAccessToken(componentAppId, componentAccessToken, authorizerAppId, code)
```

#### getUserInfo

获取授权方微信用户的基本信息

- **authorizerAccessToken** \<string\> 授权方网页授权得到的 access token
- **openId** \<string\> 授权方微信用户的openId

```javascript
let ret = await Request.getUserInfo(authorizerAccessToken, openId)
```

#### send

发送客服消息

- **authorizerAccessToken** \<string\> 授权方 access token
- **openId** \<string\> 微信用户 openId
- **type** \<string\> 消息类型
- **content** \<string\> 消息主体

```javascript
await Request.send(authorizerAccessToken, openId, 'text', { content: '消息内容' }) // 发送文本消息
await Request.send(authorizerAccessToken, openId, 'image', { media_id: 'MEDIA_ID' }) // 发送图片消息
await Request.send(authorizerAccessToken, openId, 'voice', { media_id: 'MEDIA_ID' }) // 发送语音消息

await Request.send(authorizerAccessToken, openId, 'video', {
    media_id: 'MEDIA_ID',
    thumb_media_id: 'MEDIA_ID',
    title: 'TITLE',
    description: 'DESCRIPTION'
}) // 发送视频消息

await Request.send(authorizerAccessToken, openId, 'music', {
    title: 'TITLE',
    description: 'DESCRIPTION',
    musicurl: 'MUSIC_URL',
    hqmusicurl: 'HQ_MUSIC_URL',
    thumb_media_id: 'MEDIA_ID'
}) // 发送音乐消息

await Request.send(authorizerAccessToken, openId, 'news', {
    articles: [{
        title: 'TITLE',
        description: 'DESCRIPTION',
        url: 'URL',
        picurl: 'PIC_URL'
    }]
}) // 发送图文消息

await Request.send(authorizerAccessToken, openId, 'mpnews', { media_id: 'MEDIA_ID' }) // 发送图文消息
```

#### getAuthorizerOptionInfo

该API用于获取授权方的公众号或小程序的选项设置信息，如：地理位置上报，语音识别开关，多客服开关。

- **componentAppId**
- **componentAccessToken**
- **authorizerAppId**
- **optionName**

```javascript
let ret = await Request.getAuthorizerOptionInfo(componentAppId, componentAccessToken, authorizerAppId, optionName)
```

#### setAuthorizerOption

设置授权方选项

- **componentAppId** \<string\> 第三方平台APPID
- **componentAccessToken** \<string\>
- **authorizerAppId** \<string\> 授权方平台APPID
- **optionName** \<string\>
- **optionValue** \<number\>

**该API用于设置授权方的公众号或小程序的选项信息，如：地理位置上报，语音识别开关，多客服开关。**

```javascript
await Request.setAuthorizerOption(componentAppId, componentAccessToken, authorizerAppId, optionName, optionValue)
```

#### clearQuota

第三方平台对其所有API调用次数清零

- **componentAppId** \<string\> 第三方平台APPID
- **componentAccessToken** \<string\>

```javascript
await Request.clearQuota(componentAppId, componentAccessToken)
```

#### createOpenAccount

创建开放平台帐号并绑定公众号/小程序

- **authorizerAppId** \<string\> 授权方APPID
- **authorizerAccessToken** \<string\>

```javascript
let ret = await Request.createOpenAccount(authorizerAppId, authorizerAccessToken)
```

#### bindOpenAccount

将公众号/小程序绑定到开放平台帐号下

- **openAppId** \<string\>
- **authorizerAppId** \<string\>
- **authorizerAccessToken** \<string\>

```javascript
await Request.bindOpenAccount(openAppId, authorizerAppId, authorizerAccessToken)
```

#### unbindOpenAccount

将公众号/小程序从开放平台帐号下解绑

- **openAppId** \<string\>
- **authorizerAppId** \<string\>
- **authorizerAccessToken** \<string\>

```javascript
await Request.unbindOpenAccount(openAppId, authorizerAppId, authorizerAccessToken)
```

#### getOpenAccount

获取公众号/小程序所绑定的开放平台帐号

- **authorizerAppId** \<string\>
- **authorizerAccessToken** \<string\>

```javascript
let ret = await Request.getOpenAccount(authorizerAppId, authorizerAccessToken)
```

## 致谢

[pengng/wechat-open-toolkit](https://github.com/pengng/wechat-open-toolkit)