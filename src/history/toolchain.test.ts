import packageJson from '../../package.json';

it('declares the history content toolchain and build hooks', () => {
  expect(packageJson.dependencies).toMatchObject({
    zod: expect.any(String),
    'gray-matter': expect.any(String),
    minisearch: expect.any(String),
    'd3-quadtree': expect.any(String)
  });
  expect(packageJson.devDependencies).toMatchObject({ tsx: expect.any(String) });
  expect(packageJson.scripts).toMatchObject({
    'history:compile': 'tsx scripts/history-content.ts compile',
    'history:check': 'tsx scripts/history-content.ts check',
    predev: 'npm run history:compile',
    prebuild: 'npm run history:compile',
    pretest: 'npm run history:compile'
  });
});
