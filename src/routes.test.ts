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
