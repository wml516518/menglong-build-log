const api = require('../../utils/api.js');
const format = require('../../utils/format.js');

Page({
  data: {
    budgetOptions: [
      { label: '不限', value: '' },
      { label: '20元以内', value: '2000' },
      { label: '40元以内', value: '4000' }
    ],
    timeOptions: [
      { label: '不限', value: '' },
      { label: '15分钟', value: '15' },
      { label: '30分钟', value: '30' }
    ],
    selectedBudgetIndex: 0,
    selectedTimeIndex: 0,
    selectedBudgetLabel: '不限',
    selectedTimeLabel: '不限',
    recipe: null,
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
  async drawRecipe() {
    const budget = this.data.budgetOptions[this.data.selectedBudgetIndex].value;
    const time = this.data.timeOptions[this.data.selectedTimeIndex].value;
    this.setData({ loading: true, error: '' });
    try {
      const data = await api.getRandomRecipe({
        maxBudgetCents: budget,
        maxCookMinutes: time
      });
      this.setData({ recipe: format.recipeSummary(data.recipe) });
    } catch (error) {
      this.setData({ error: error.message || '抽卡失败，请稍后重试' });
    } finally {
      this.setData({ loading: false });
    }
  },
  openDetail() {
    if (!this.data.recipe) return;
    wx.navigateTo({ url: `/pages/detail/detail?id=${this.data.recipe.id}` });
  },
  onShareAppMessage() {
    return {
      title: this.data.recipe ? `今天吃：${this.data.recipe.title}` : '今天吃什么卡',
      path: '/pages/home/home'
    };
  }
});
