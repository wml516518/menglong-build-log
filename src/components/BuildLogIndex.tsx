import type { BuildLogPost } from '../posts';

type BuildLogIndexProps = {
  posts: BuildLogPost[];
  title: string;
  eyebrow: string;
  readArticleLabel: string;
  tagsLabel: string;
};

export function BuildLogIndex({
  posts,
  title,
  eyebrow,
  readArticleLabel,
  tagsLabel
}: BuildLogIndexProps) {
  return (
    <section className="build-log-page">
      <div className="page-intro">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      <div className="post-list">
        {posts.map((post) => (
          <article className="post-list-item" key={post.slug}>
            <div className="post-meta">
              <time dateTime={post.date}>{post.date}</time>
              <span>{post.relatedProject}</span>
            </div>
            <div>
              {post.coverImage && (
                <div className="post-cover">
                  <img src={post.coverImage} alt={post.title} width="1600" height="900" loading="lazy" />
                </div>
              )}
              <h2>
                <a href={`#/build-log/${post.slug}`}>{post.title}</a>
              </h2>
              <p>{post.summary}</p>
              <ul className="post-tags" aria-label={tagsLabel}>
                {post.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            </div>
            <a className="text-link" href={`#/build-log/${post.slug}`}>
              {readArticleLabel}
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
