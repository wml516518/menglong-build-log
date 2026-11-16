import { legacyHistoryLocation, historySiteRoute } from './siteLocations';

it('moves legacy history links to the independent site without losing archive IDs or filters', () => {
  expect(legacyHistoryLocation('#/history-galaxy/event/zhenguan?q=唐&era=tang', '?lang=zh'))
    .toBe('/apps/history-galaxy/?lang=zh#/history-galaxy/event/zhenguan?q=唐&era=tang');
  expect(legacyHistoryLocation('#/history-galaxy?view=1')).toBe('/apps/history-galaxy/#/history-galaxy?view=1');
  expect(legacyHistoryLocation('#/build-log/history')).toBeNull();
  expect(legacyHistoryLocation('#/history-galaxy/event/../secret')).toBeNull();
});

it('keeps a filtered legacy galaxy query inside the destination fragment', () => {
  expect(legacyHistoryLocation('#/history-galaxy?era=tang&q=唐'))
    .toBe('/apps/history-galaxy/#/history-galaxy?era=tang&q=唐');
});

it('opens the galaxy at its site root and keeps archive routes inside that site', () => {
  expect(historySiteRoute('')).toEqual({ view: 'history-galaxy' });
  expect(historySiteRoute('#home')).toEqual({ view: 'history-galaxy' });
  expect(historySiteRoute('#/history-galaxy/person/person-li-shimin?q=唐'))
    .toEqual({ view: 'history-person', id: 'person-li-shimin', query: '?q=唐' });
});
