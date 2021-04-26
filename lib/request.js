// eslint-disable-next-line no-restricted-modules
const axios = require('axios');
const { HttpError, WechatOpenToolkitError } = require('./error');

const { WECHAT_API: baseURL, HTTP_STATUS_CODE_OK } = require('./constant');

let request = axios.create({
  baseURL,
});

request.interceptors.response.use(function (response) {
  let { status, data } = response;
  let { errcode, errmsg } = data;
  if (status === HTTP_STATUS_CODE_OK) {
    if (errcode) {
      throw new WechatOpenToolkitError(errmsg, errcode);
    } else {
      return data;
    }
  } else {
    throw new HttpError(data, status);
  }
},
function (error) {
  throw new HttpError(error.response.data, error.response.status);
}
);

module.exports = request;
