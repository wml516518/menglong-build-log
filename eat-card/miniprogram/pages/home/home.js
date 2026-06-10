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
    servingsOptions: [
      { label: '不限', value: '' },
      { label: '1人', value: '1' },
      { label: '2人', value: '2' },
      { label: '3人', value: '3' },
      { label: '4人', value: '4' }
    ],
    selectedBudgetIndex: 0,
    selectedTimeIndex: 0,
    selectedServingsIndex: 0,
    selectedBudgetLabel: '不限',
    selectedTimeLabel: '不限',
    selectedServingsLabel: '不限',
    tagOptions: [],
    selectedTags: [],
    tagsLoading: false,
    tagsError: '',
    recipe: null,
    loading: false,
    error: '',
    isNoMatch: false,
    retryText: '重试'
  },
  onLoad() {
    this.loadTags();
  },
  async loadTags() {
    this.setData({ tagsLoading: true, tagsError: '' });
    try {
      const data = await api.getTags();
      const tagOptions = (data.tags || []).map((tag) => ({
        name: tag.name,
        selected: this.data.selectedTags.indexOf(tag.name) !== -1,
        className: this.data.selectedTags.indexOf(tag.name) !== -1 ? 'tag-option tag-option-selected' : 'tag-option'
      }));
      this.setData({ tagOptions });
    } catch (error) {
      this.setData({ tagsError: '标签加载失败，可直接抽卡' });
    } finally {
      this.setData({ tagsLoading: false });
    }
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
  toggleTag(event) {
    const name = event.currentTarget.dataset.name;
    if (!name) return;
    const selectedTags = this.data.selectedTags.indexOf(name) === -1
      ? this.data.selectedTags.concat(name)
      : this.data.selectedTags.filter((tag) => tag !== name);
    const tagOptions = this.data.tagOptions.map((tag) => ({
      name: tag.name,
      selected: selectedTags.indexOf(tag.name) !== -1,
      className: selectedTags.indexOf(tag.name) !== -1 ? 'tag-option tag-option-selected' : 'tag-option'
    }));
    this.setData({ selectedTags, tagOptions });
  },
  async drawRecipe() {
    const budget = this.data.budgetOptions[this.data.selectedBudgetIndex].value;
    const time = this.data.timeOptions[this.data.selectedTimeIndex].value;
    const servings = this.data.servingsOptions[this.data.selectedServingsIndex].value;
    const tags = this.data.selectedTags.join(',');
    this.setData({ loading: true, error: '', isNoMatch: false });
    try {
      const data = await api.getRandomRecipe({
        maxBudgetCents: budget,
        maxCookMinutes: time,
        servings,
        tags
      });
      this.setData({ recipe: format.recipeSummary(data.recipe) });
    } catch (error) {
      const message = error.message || '';
      const isNoMatch = message.indexOf('No matching recipe') !== -1 || message.indexOf('没有匹配') !== -1;
      this.setData({
        error: isNoMatch ? '没有匹配菜谱，试试放宽筛选' : '抽卡失败，请稍后重试',
        isNoMatch,
        recipe: null
      });
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
