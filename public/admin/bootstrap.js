(function () {
  var cms = window.CMS;
  var turbo = cms && cms.getBackend('turbo-github');

  if (!turbo || typeof turbo.BackendClass !== 'function') {
    throw new Error('Decap Turbo backend is unavailable; cannot protect Chinese drafts.');
  }

  var TurboBackend = turbo.BackendClass;

  class ChineseSourceBackend extends TurboBackend {
    async unpublishedEntry(options) {
      var draft = await super.unpublishedEntry(options);
      if (!draft || !Array.isArray(draft.diffs)) {
        return draft;
      }

      return {
        ...draft,
        diffs: draft.diffs.filter(function (diff) {
          return !diff.path.startsWith('content/en/');
        })
      };
    }
  }

  cms.registerBackend('turbo-github-chinese-source', ChineseSourceBackend);
  cms.init({
    config: {
      backend: { name: 'turbo-github-chinese-source' },
      locale: 'zh_Hans'
    }
  });
})();
