import { render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { createHistoryContentLoader } from '../../history/content/loader';
import { HistoryContentProvider } from '../../history/content/store';
import { eventIndexSchema } from '../../history/content/schema';
import { EventRelationships } from './EventRelationships';

const events = eventIndexSchema.array().parse(JSON.parse(readFileSync('public/history-content/generated/indexes/events.compact.json', 'utf8')));

it.each([
  ['two-tax-to-single-whip', 'two-tax', '一条鞭法推向全国'],
  ['two-tax-to-single-whip', 'single-whip-national-push', '两税法'],
  ['single-whip-to-tanding', 'single-whip-national-push', '摊丁入亩推广'],
  ['single-whip-to-tanding', 'tanding-rumu', '一条鞭法推向全国']
])('labels the production fiscal comparison %s from %s truthfully in full and quick relationships', async (relationId, eventId, targetTitle) => {
  const loader = createHistoryContentLoader({ baseUrl: '/content/', fetchImpl: async input => new Response(readFileSync(`public/history-content/generated/${String(input).replace('/content/', '')}`, 'utf8')) });
  const event = { ...events.find(event => event.id === eventId)!, parentId: null, childIds: [], relationIds: [relationId] };
  render(<HistoryContentProvider loader={loader}>
    <EventRelationships event={event} />
    <EventRelationships event={event} quick />
  </HistoryContentProvider>);
  for (const name of ['事件关系', '相关事件列表']) {
    const list = screen.getByRole('list', { name });
    expect(await within(list).findByText('对照事件')).toBeInTheDocument();
    expect(await within(list).findByRole('link', { name: targetTitle })).toBeInTheDocument();
    expect(within(list).queryByText('同时期事件')).not.toBeInTheDocument();
  }
});
