const mockRecipe = {
  id: 'mock-1',
  title: '番茄肥牛饭',
  description: '15分钟的一人食下饭菜',
  budgetCents: 2200,
  budgetText: '22元',
  cookMinutes: 15,
  cookTimeText: '15分钟',
  servings: 1,
  servingsText: '1人',
  difficulty: 'easy',
  tags: ['一人食', '下饭'],
  tips: '肥牛可以换成鸡蛋'
};

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
    recipe: mockRecipe,
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
  drawRecipe() {
    this.setData({ recipe: mockRecipe, error: '' });
  },
  openDetail() {
    wx.navigateTo({ url: `/pages/detail/detail?id=${this.data.recipe.id}` });
  }
});
