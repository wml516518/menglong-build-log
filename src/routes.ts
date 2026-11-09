export type Route =
  | { view: 'home' }
  | { view: 'history-galaxy' }
  | { view: 'posts' }
  | { view: 'post'; slug: string };

const postPrefix = '#/build-log/';
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseHash(hash: string): Route {
  if (hash === '#/history-galaxy') {
    return { view: 'history-galaxy' };
  }

  if (hash === '#/build-log' || hash === postPrefix) {
    return { view: 'posts' };
  }

  if (!hash.startsWith(postPrefix)) {
    return { view: 'home' };
  }

  try {
    const slug = decodeURIComponent(hash.slice(postPrefix.length));
    return slugPattern.test(slug) ? { view: 'post', slug } : { view: 'posts' };
  } catch {
    return { view: 'posts' };
  }
}
