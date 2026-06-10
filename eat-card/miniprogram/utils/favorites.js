const KEY = 'eat-card:favorites';

function getFavorites() {
  try {
    const favorites = wx.getStorageSync(KEY);
    return Array.isArray(favorites) ? favorites : [];
  } catch (error) {
    return [];
  }
}

function saveFavorites(favorites) {
  if (!Array.isArray(favorites)) {
    return false;
  }

  try {
    wx.setStorageSync(KEY, favorites);
    return true;
  } catch (error) {
    return false;
  }
}

function isFavorite(id) {
  return getFavorites().some((item) => item.id === id);
}

function addFavorite(recipe) {
  const favorites = getFavorites().filter((item) => item.id !== recipe.id);
  favorites.unshift({
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    budgetCents: recipe.budgetCents,
    budgetText: recipe.budgetText,
    cookMinutes: recipe.cookMinutes,
    cookTimeText: recipe.cookTimeText,
    servings: recipe.servings,
    servingsText: recipe.servingsText,
    tags: recipe.tags || []
  });
  saveFavorites(favorites);
}

function removeFavorite(id) {
  saveFavorites(getFavorites().filter((item) => item.id !== id));
}

module.exports = {
  getFavorites,
  isFavorite,
  addFavorite,
  removeFavorite
};
