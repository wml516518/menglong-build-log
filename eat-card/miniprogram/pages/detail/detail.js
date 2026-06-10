Page({
  data: {
    id: '',
    recipe: {
      title: '番茄肥牛饭',
      ingredients: ['肥牛卷150g', '番茄1个', '米饭1碗'],
      steps: [
        { orderText: '1.', text: '番茄切块炒软' },
        { orderText: '2.', text: '放入肥牛煮熟' },
        { orderText: '3.', text: '淋在米饭上' }
      ],
      tips: '肥牛可以换成鸡蛋'
    }
  },
  onLoad(options) {
    this.setData({ id: options && options.id ? options.id : '' });
  },
  onShareAppMessage() {
    return {
      title: this.data.recipe.title,
      path: '/pages/home/home'
    };
  }
});
