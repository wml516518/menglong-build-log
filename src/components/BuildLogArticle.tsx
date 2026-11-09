import ReactMarkdown from 'react-markdown';
import type { BuildLogPost } from '../posts';

type BuildLogArticleProps = {
  post?: BuildLogPost;
  backLabel: string;
  notFoundLabel: string;
  tagsLabel: string;
};

export function BuildLogArticle({
  post,
  backLabel,
  notFoundLabel,
  tagsLabel
}: BuildLogArticleProps) {
  if (!post) {
    return (
      <section className="build-log-page post-not-found">
        <h1>{notFoundLabel}</h1>
        <a className="text-link" href="#/build-log">
          {backLabel}
        </a>
      </section>
    );
  }

  return (
    <article className="build-log-page post-article">
      <a className="post-back" href="#/build-log">
        {backLabel}
      </a>
      <header>
        <div className="post-meta">
          <time dateTime={post.date}>{post.date}</time>
          <span>{post.relatedProject}</span>
        </div>
        <h1>{post.title}</h1>
        <p className="post-summary">{post.summary}</p>
        <ul className="post-tags" aria-label={tagsLabel}>
          {post.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      </header>
      <div className="post-body">
        <ReactMarkdown
          components={{
            a: ({ href, children, ...props }) => {
              const external = href?.startsWith('http');
              return (
                <a
                  {...props}
                  href={href}
                  target={external ? '_blank' : undefined}
                  rel={external ? 'noreferrer' : undefined}
                >
                  {children}
                </a>
              );
            }
          }}
        >
          {post.body}
        </ReactMarkdown>
      </div>
    </article>
  );
}
