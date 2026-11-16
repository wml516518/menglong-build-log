export const historyMetadata = {
  title: '历史星河｜中国历史3D交互时间轴',
  description: '历史星河是一条从唐朝延伸至1949年的3D交互式中国历史时间轴，可自由航行、拖拽事件星点并探索人物故事。',
  themeColor: '#05070a'
};

export function applyHistoryMetadata(): void {
  document.title = historyMetadata.title;
  document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', historyMetadata.description);
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', historyMetadata.themeColor);
  document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.remove();
}
