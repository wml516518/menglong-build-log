import { Children, isValidElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ScreenCluster } from '../history/clustering/protocol';
import { ClusterField } from './ClusterField';

const cluster: ScreenCluster = { id: 'c1', memberIds: ['a', 'b'], count: 2, semanticGroups: ['唐/文化'], center: { x: 100, y: 100 }, bounds: { minX: 60, maxX: 140, minY: 80, maxY: 120 }, focusTarget: { x: 100, y: 100, width: 80, height: 40 } };
const positions = new Map<string, readonly [number, number, number]>([['a', [0, 2, 0]], ['b', [4, 0, 2]]]);

it('offers a keyboard accessible fixed-size glyph that focuses the exact cluster and member location', () => {
  const focusBounds = vi.fn();
  const tree = ClusterField({ clusters: [cluster], positions, focusBounds });
  const glyphs = Children.toArray(tree?.props.children).filter(isValidElement);
  expect(glyphs).toHaveLength(1);
  expect(glyphs[0].props.position).toEqual([2, 1, 1]);
  render(glyphs[0].props.children);
  const button = screen.getByRole('button', { name: '聚焦 2 个历史事件' });
  expect(button).toHaveStyle({ width: '48px', height: '48px', boxSizing: 'border-box' });
  fireEvent.click(button);
  expect(focusBounds).toHaveBeenCalledTimes(1);
  expect(focusBounds.mock.calls[0][0]).toBe(cluster);
});

it('keeps cluster dimensions stable for large counts and long semantic labels', () => {
  const large = { ...cluster, count: 12000, semanticGroups: ['很长的分类'.repeat(40)] };
  const tree = ClusterField({ clusters: [large], positions, focusBounds: vi.fn() });
  const glyph = Children.toArray(tree?.props.children).find(isValidElement);
  expect(glyph).toBeDefined();
  render(glyph!.props.children);
  expect(screen.getByRole('button', { name: '聚焦 12000 个历史事件' })).toHaveStyle({ width: '48px', height: '48px', overflow: 'hidden' });
  expect(screen.getByText('999+')).toBeInTheDocument();
});
