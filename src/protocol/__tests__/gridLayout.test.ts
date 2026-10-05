import { describe, expect, it } from 'vitest';
import { placeAll } from '../../ui/gridLayout';

describe('placeAll', () => {
  it('puts two half-width widgets side by side', () => {
    const p = placeAll([{ id: 'a', w: 3, h: 2 }, { id: 'b', w: 3, h: 2 }], 6);
    expect(p.a).toEqual({ col: 0, row: 0 });
    expect(p.b).toEqual({ col: 3, row: 0 });
  });
  it('fills a free gap beside a tall widget', () => {
    const p = placeAll([{ id: 'a', w: 2, h: 4 }, { id: 'b', w: 4, h: 2 }, { id: 'c', w: 4, h: 2 }], 6);
    expect(p.b).toEqual({ col: 2, row: 0 });
    expect(p.c).toEqual({ col: 2, row: 2 });
  });
  it('pushes colliding widgets down and keeps the moved one', () => {
    const p = placeAll([{ id: 'a', col: 0, row: 0, w: 3, h: 2 }, { id: 'b', col: 0, row: 0, w: 3, h: 2 }], 6, 'b');
    expect(p.b).toEqual({ col: 0, row: 0 });
    expect(p.a).toEqual({ col: 0, row: 2 });
  });
  it('clamps to the grid width', () => {
    expect(placeAll([{ id: 'a', col: 5, row: 1, w: 3, h: 1 }], 6).a).toEqual({ col: 3, row: 1 });
  });
});
