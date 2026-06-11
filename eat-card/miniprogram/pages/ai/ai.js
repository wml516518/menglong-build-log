const api = require('../../utils/api.js');
const favorites = require('../../utils/favorites.js');
const format = require('../../utils/format.js');

Page({
  data: {
    budgetOptions: [
      { label: '不限', value: 0 },
      { label: '20元以内', value: 2000 },
      { label: '40元以内', value: 4000 }
    ],
    timeOptions: [
      { label: '不限', value: 0 },
      { label: '15分钟', value: 15 },
      { label: '30分钟', value: 30 }
    ],
    servingsOptions: [
      { label: '1人', value: 1 },
      { label: '2人', value: 2 },
      { label: '3人', value: 3 }
    ],
    selectedBudgetIndex: 1,
    selectedTimeIndex: 1,
    selectedServingsIndex: 0,
    selectedBudgetLabel: '20元以内',
    selectedTimeLabel: '15分钟',
    selectedServingsLabel: '1人',
    preferences: '清淡、下饭',
    ingredients: '',
    restrictions: '',
    meal: null,
    loading: false,
    error: ''
  },
  onBudgetChange(event) {
    const selectedBudgetIndex = Number(event.detail.value);
    this.setData({
      selectedBudgetIndex,
      selectedBudgetLabel: this.data.budgetOptions[selectedBudgetIndex].label
    });
  },
  onTimeChange(event) {
    const selectedTimeIndex = Number(event.detail.value);
    this.setData({
      selectedTimeIndex,
      selectedTimeLabel: this.data.timeOptions[selectedTimeIndex].label
    });
  },
  onServingsChange(event) {
    const selectedServingsIndex = Number(event.detail.value);
    this.setData({
      selectedServingsIndex,
      selectedServingsLabel: this.data.servingsOptions[selectedServingsIndex].label
    });
  },
  onPreferencesInput(event) {
    this.setData({ preferences: event.detail.value });
  },
  onIngredientsInput(event) {
    this.setData({ ingredients: event.detail.value });
  },
  onRestrictionsInput(event) {
    this.setData({ restrictions: event.detail.value });
  },
  async generateMeal() {
    const budget = this.data.budgetOptions[this.data.selectedBudgetIndex].value;
    const time = this.data.timeOptions[this.data.selectedTimeIndex].value;
    const servings = this.data.servingsOptions[this.data.selectedServingsIndex].value;
    const preferences = this.data.preferences
      .split(/[，,、\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    this.setData({ loading: true, error: '' });
    try {
      const data = await api.generateAiMeal({
        budgetCents: budget,
        cookMinutes: time,
        servings,
        preferences,
        ingredients: this.data.ingredients,
        restrictions: this.data.restrictions
      });
      this.setData({
        meal: format.recipeDetail({
          ...data.meal,
          id: `ai-${Date.now()}`,
          description: data.meal.reason || 'AI 生成的吃什么灵感'
        })
      });
    } catch (error) {
      this.setData({ error: error.message || 'AI 生成失败，请稍后重试' });
    } finally {
      this.setData({ loading: false });
    }
  },
  saveMeal() {
    if (!this.data.meal) return;
    favorites.addFavorite(this.data.meal);
    wx.showToast({ title: '已收藏', icon: 'success' });
  },
  onShareAppMessage() {
    return {
      title: this.data.meal ? `AI 推荐：${this.data.meal.title}` : 'AI 帮我想吃什么',
      path: '/pages/ai/ai'
    };
  }
});
