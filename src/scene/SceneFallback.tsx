export function SceneFallback() {
  return (
    <div className="scene-fallback" role="status">
      <div className="fallback-orbit" aria-hidden="true"><i /><i /><i /></div>
      <p>当前环境无法开启三维星河</p>
      <span>仍可通过时代导航和事件列表浏览全部历史故事</span>
    </div>
  );
}
