const _ = require('lodash');

const Base = require('./Base');


async function promise(res) {
  return new Promise((resolve, reject) => {
    if(!res) {
      reject(res);
    }
    resolve(res);
  });
}

class Cache extends Base {
  constructor (...props) {
    super(...props);
  }

  async getComponentAppById (componentAppId, key) {
    if (key) {
      return _.get(this.componentAppList, [componentAppId, key], undefined);  
    }
    return promise(this.componentAppList[componentAppId] || {});
  }

  async setComponentApp(componentAppId, options) {
    if (!this.componentAppList[componentAppId]) {
      this.componentAppList[componentAppId] = {};
    }
    _.forEach(options|| {}, (val,key) => {
      this.componentAppList[componentAppId][key] = val;
    });
    return promise(this.getComponentAppById(componentAppId));
  }


  async getAuthorizerAppById (authorizerAppId, key) {
    if (key) {
      return _.get(this.authorizerAppList, [authorizerAppId, key], undefined);  
    }
    return promise(this.authorizerAppList[authorizerAppId] || {});
  }

  async setAuthorizerApp (authorizerAppId, options) {
    if (!_.get(this.authorizerAppList,[ authorizerAppId ])) {
      this.authorizerAppList[authorizerAppId] = {};
      
    }
    _.forEach(options|| {}, (val,key) => {
      this.authorizerAppList[authorizerAppId][key] = val;
    });
    if (!options.componentAppId) {
      console.error('componentAppId must by set for authorizerApp');
    }
    return promise(this.getComponentAppById(authorizerAppId));
  }

  async delAuthorizerApp(authorizerAppId) {
    delete this.authorizerAppList[authorizerAppId];
    return promise(authorizerAppId);
  }
}

module.exports = Cache;
