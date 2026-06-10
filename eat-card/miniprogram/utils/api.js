const env = require('../env.js');

function request(path, data = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${env.API_BASE_URL}${path}`,
      method: 'GET',
      data,
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data);
        } else {
          const data = response.data || {};
          reject(new Error(data.error || '请求失败'));
        }
      },
      fail() {
        reject(new Error('网络连接失败'));
      }
    });
  });
}

function getRandomRecipe(filters) {
  return request('/recipes-random', filters);
}

function getRecipeDetail(id) {
  return request('/recipes-detail', { id });
}

function getTags() {
  return request('/tags');
}

module.exports = {
  getRandomRecipe,
  getRecipeDetail,
  getTags
};
