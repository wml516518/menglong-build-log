import { parseHash } from './routes';

describe('parseHash', () => {
  it('uses the homepage for ordinary section hashes', () => {
    expect(parseHash('')).toEqual({ view: 'home' });
    expect(parseHash('#projects')).toEqual({ view: 'home' });
  });

  it('recognizes the build log index', () => {
    expect(parseHash('#/build-log')).toEqual({ view: 'posts' });
    expect(parseHash('#/build-log/')).toEqual({ view: 'posts' });
  });

  it('recognizes the History Galaxy experience', () => {
    expect(parseHash('#/history-galaxy')).toEqual({ view: 'history-galaxy' });
  });

  it('does not treat near-matching History Galaxy hashes as the experience', () => {
    expect(parseHash('#/history-galaxy/')).toEqual({ view: 'home' });
    expect(parseHash('#/history-galaxy-extra')).toEqual({ view: 'home' });
  });

  it('recognizes a valid article slug', () => {
    expect(parseHash('#/build-log/ai-chat-playground')).toEqual({
      view: 'post',
      slug: 'ai-chat-playground'
    });
  });

  it('falls back to the index for invalid article hashes', () => {
    expect(parseHash('#/build-log/Bad%20Slug')).toEqual({ view: 'posts' });
    expect(parseHash('#/build-log/%E0%A4%A')).toEqual({ view: 'posts' });
  });
});


describe('shareable history routes', () => {
  it.each([['event', 'zhenguan', 'history-event'], ['person', 'person-li-shimin', 'history-person'], ['theme', 'silk-road', 'history-theme']])('parses %s with decoded ID and query', (kind, id, view) => {
    expect(parseHash(`#/history-galaxy/${kind}/${id}?q=唐&era=tang`)).toEqual({ view, id, query: '?q=唐&era=tang' });
    expect(parseHash(`#/history-galaxy/${kind}/%61bc`)).toEqual({ view, id: 'abc', query: '' });
  });
  it.each(['', 'UPPER', '../tang', '%2e%2e%2ftang', '%E0%A4%A', 'a/b', 'a--b', '%2561bc'])('rejects unsafe ID %s', id => {
    for (const kind of ['event', 'person', 'theme']) expect(parseHash(`#/history-galaxy/${kind}/${id}`)).toEqual({ view: 'home' });
  });
  it('recognizes the galaxy with filter query', () => {
    expect(parseHash('#/history-galaxy?era=tang&q=唐')).toEqual({ view: 'history-galaxy' });
  });
});
