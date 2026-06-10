const favorites = require('../../utils/favorites.js');
const format = require('../../utils/format.js');

Page({
  data: {
    favorites: [],
    isEmpty: true
  },
  onShow() {
    const favoriteRecipes = favorites.getFavorites().map(format.recipeSummary);
    this.setData({
      favorites: favoriteRecipes,
      isEmpty: favoriteRecipes.length === 0
    });
  },
  openDetail(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },
  removeFavorite(event) {
    favorites.removeFavorite(event.currentTarget.dataset.id);
    const favoriteRecipes = favorites.getFavorites().map(format.recipeSummary);
    this.setData({
      favorites: favoriteRecipes,
      isEmpty: favoriteRecipes.length === 0
    });
  }
});
