import type { BuildLogPost } from '../posts';

type BuildLogPreviewProps = {
  posts: BuildLogPost[];
  title: string;
  allPostsLabel: string;
  readArticleLabel: string;
};

export function BuildLogPreview({
  posts,
  title,
  allPostsLabel,
  readArticleLabel
}: BuildLogPreviewProps) {
  return (
    <section id="build-log" className="section-block">
      <div className="section-heading">
        <h2>{title}</h2>
        <a href="#/build-log">{allPostsLabel}</a>
      </div>
      <div className="log-grid">
        {posts.slice(0, 3).map((post, index) => (
          <article className="log-item" key={post.slug}>
            <p>
              {String(index + 1).padStart(2, '0')} / {post.date}
            </p>
            <h3>
              <a href={`#/build-log/${post.slug}`}>{post.title}</a>
            </h3>
            <span>{post.relatedProject}</span>
            <a className="text-link" href={`#/build-log/${post.slug}`}>
              {readArticleLabel}
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
