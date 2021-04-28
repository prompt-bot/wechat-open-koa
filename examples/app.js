
var Koa = require('koa');
var router = require('koa-router')();
const koaBody = require('koa-body');
const _ = require('lodash');

const route = require('./route.json');
const wechat = require('./wechat');
const { init } = require('./service');

const app = new Koa();

_.forEach(route, el => {
    console.log(`Route ${el.method}:${el.path}\t${el.config.description}`)
    router[el.method.toLowerCase()](el.path, wechat[el.handler]);
})

init();
app.use(koaBody()).use(router.routes()).use(router.allowedMethods());

console.log('Server is listening on : http://0.0.0.0:8001')
app.listen(8001);