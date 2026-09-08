/* 网格占用图（P1/C1，2026-09-07 16:30 新增）—— 6×10 盘面的 O(1) 占用查询。
 * 语义（PRD 2.0 §5.1）：
 *   - 动物/岩石各占一整格，同格不重叠；
 *   - 越界格（col/row 超出 [0,COLS)×[0,ROWS)）视为空——"边界格朝向场外视为空（可走出）"。
 * 纯数据结构，不含规则（遮挡判定在 Board.ts），不消耗随机流，禁止 import 'cc'。
 * 用法：查询密集场景（unlockedSet/hasBlockCycle 等）先 Grid.build(herd) 一次、
 *   后续 O(1)/格；单点查询可直接 Board.blockerOf（内部自建，n≤60 开销可忽略）。 */
import type { Animal } from './Types';
import { GRID_COLS, GRID_ROWS } from './Constants';

export class Grid {
  private cells: (Animal | null)[];

  private constructor() {
    this.cells = new Array<Animal | null>(GRID_COLS * GRID_ROWS).fill(null);
  }

  /** 从 herd（动物+岩石）构建占用快照。越界/重复格防御性忽略后到者不覆盖（首到者占格）。 */
  static build(herd: readonly Animal[]): Grid {
    const g = new Grid();
    for (const a of herd) {
      if (a.col < 0 || a.col >= GRID_COLS || a.row < 0 || a.row >= GRID_ROWS) continue;
      const idx = a.row * GRID_COLS + a.col;
      if (g.cells[idx] === null) g.cells[idx] = a;
    }
    return g;
  }

  /** 查询 (col,row) 格的占用者；越界返回 null（场外视为空）。 */
  occupant(col: number, row: number): Animal | null {
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null;
    return this.cells[row * GRID_COLS + col];
  }

  /** (col,row) 是否越界（场外）。 */
  static outOfBounds(col: number, row: number): boolean {
    return col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS;
  }
}
