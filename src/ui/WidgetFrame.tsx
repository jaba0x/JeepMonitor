import { useMemo, useRef, useState, type ReactNode } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { colors } from './theme';
import { ScaleContext } from './widgets';

export type Preview = { kind: 'move'; dx: number; dy: number } | { kind: 'resize'; span: number; rows: number } | null;

export interface FrameProps {
  id: string;
  /** Pixel position inside the grid and resolved size. */
  x: number;
  y: number;
  width: number;
  height: number;
  editing: boolean;
  spanToWidth: (span: number) => number;
  rowsToHeight: (rows: number) => number;
  /** Largest span that still fits to the right of this widget, and snapping to what the screen allows. */
  fitSpan: (raw: number, col: number) => number;
  col: number;
  span: number;
  rows: number;
  colW: number;
  gap: number;
  unit: number;
  onMove: (id: string, dx: number, dy: number) => void;
  onResize: (id: string, span: number, rows: number) => void;
  onPreview: (p: Preview) => void;
  onDragState: (dragging: boolean) => void;
  onOpen: () => void;
  /** Receives the unscaled content height. */
  children: (cellHeight?: number) => ReactNode;
}

/** Width the widget content is laid out at before being scaled to the frame. */
export const BASE_W = 360;

/**
 * Wraps a dashboard widget. While the dashboard is unlocked it can be dragged by its grip to any free grid cell
 * and resized by its corner handle, snapping to the grid like an Android home-screen widget.
 */
export function WidgetFrame(props: FrameProps) {
  const p = useRef(props);
  p.current = props;
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [live, setLive] = useState<{ span: number; rows: number } | null>(null);

  const mover = useMemo(() => {
    const finish = (dx: number, dy: number) => {
      p.current.onPreview(null);
      setOffset({ x: 0, y: 0 });
      setDragging(false);
      p.current.onDragState(false);
      p.current.onMove(p.current.id, dx, dy);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        setDragging(true);
        p.current.onDragState(true);
      },
      onPanResponderMove: (_, g) => {
        setOffset({ x: g.dx, y: g.dy });
        p.current.onPreview({ kind: 'move', dx: g.dx, dy: g.dy });
      },
      onPanResponderRelease: (_, g) => finish(g.dx, g.dy),
      onPanResponderTerminate: (_, g) => finish(g.dx, g.dy),
    });
  }, []);

  const resizer = useMemo(() => {
    let startW = 0;
    let startH = 0;
    const compute = (dx: number, dy: number) => {
      const q = p.current;
      const span = q.fitSpan(Math.round((startW + dx + q.gap) / (q.colW + q.gap)), q.col);
      const rows = Math.max(1, Math.round((startH + dy + q.gap) / (q.unit + q.gap)));
      return { span, rows };
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        startW = p.current.width;
        startH = p.current.height;
        p.current.onDragState(true);
        setLive({ span: p.current.span, rows: p.current.rows });
      },
      onPanResponderMove: (_, g) => {
        const r = compute(g.dx, g.dy);
        setLive(r);
        p.current.onPreview({ kind: 'resize', ...r });
      },
      onPanResponderRelease: (_, g) => {
        const r = compute(g.dx, g.dy);
        setLive(null);
        p.current.onPreview(null);
        p.current.onDragState(false);
        p.current.onResize(p.current.id, r.span, r.rows);
      },
      onPanResponderTerminate: () => {
        setLive(null);
        p.current.onPreview(null);
        p.current.onDragState(false);
      },
    });
  }, []);

  const width = live ? props.spanToWidth(live.span) : props.width;
  const height = live ? props.rowsToHeight(live.rows) : props.height;
  const scale = width / BASE_W;
  const innerH = height / scale;

  return (
    <View
      style={[
        { position: 'absolute', left: props.x, top: props.y, width, height, overflow: 'hidden' },
        dragging && { zIndex: 10, opacity: 0.85, transform: [{ translateX: offset.x }, { translateY: offset.y }, { scale: 1.02 }] },
        live && { zIndex: 10 },
      ]}
    >
      <View
        style={{ position: 'absolute', top: 0, left: 0, width: BASE_W, height: innerH, transform: [{ scale }], transformOrigin: '0% 0%' }}
        pointerEvents={props.editing ? 'none' : 'auto'}
      >
        <ScaleContext.Provider value={scale}>{props.children(innerH)}</ScaleContext.Provider>
      </View>
      {props.editing ? (
        <>
          <Pressable style={styles.edge} onPress={props.onOpen} />
          <View style={styles.grip} {...mover.panHandlers}>
            {[0, 1, 2].map((r) => (
              <View key={r} style={styles.dotRow}>
                <View style={styles.dot} />
                <View style={styles.dot} />
              </View>
            ))}
          </View>
          <View style={styles.corner} {...resizer.panHandlers}>
            <View style={styles.cornerMark} />
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.info,
    borderRadius: 16,
    backgroundColor: 'rgba(56,189,248,0.05)',
  },
  grip: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.info,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  dotRow: { flexDirection: 'row', gap: 4 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#06121F' },
  corner: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.info,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerMark: { width: 16, height: 16, borderRightWidth: 4, borderBottomWidth: 4, borderColor: '#06121F', borderBottomRightRadius: 4 },
});
