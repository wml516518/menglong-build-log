const api = require('../../utils/api.js');
const favorites = require('../../utils/favorites.js');
const format = require('../../utils/format.js');

Page({
  data: {
    id: '',
    recipe: null,
    loading: true,
    error: '',
    favorite: false,
    favoriteText: '收藏'
  },
  async onLoad(options) {
    const id = options && options.id ? options.id : '';
    this.setData({ id, loading: true, error: '' });
    try {
      const data = await api.getRecipeDetail(id);
      const favorite = favorites.isFavorite(id);
      this.setData({
        recipe: format.recipeDetail(data.recipe),
        favorite,
        favoriteText: favorite ? '取消收藏' : '收藏'
      });
    } catch (error) {
      this.setData({ error: error.message || '加载失败' });
    } finally {
      this.setData({ loading: false });
    }
  },
  toggleFavorite() {
    if (!this.data.recipe) return;
    if (this.data.favorite) {
      favorites.removeFavorite(this.data.recipe.id);
      this.setData({ favorite: false, favoriteText: '收藏' });
    } else {
      favorites.addFavorite(this.data.recipe);
      this.setData({ favorite: true, favoriteText: '取消收藏' });
    }
  },
  drawAgain() {
    wx.reLaunch({ url: '/pages/home/home' });
  },
  onShareAppMessage() {
    return {
      title: this.data.recipe ? `今天吃：${this.data.recipe.title}` : '今天吃什么卡',
      path: this.data.recipe ? `/pages/detail/detail?id=${this.data.recipe.id}` : '/pages/home/home'
    };
  }
});
