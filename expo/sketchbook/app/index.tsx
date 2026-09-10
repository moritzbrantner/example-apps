import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import {
  appendStroke,
  clearSketch,
  createSketch,
  createStroke,
  deserializeSketchCollection,
  emptySketchCollection,
  removeLastStroke,
  type Sketch,
  type SketchCollection,
  type SketchPoint,
  type SketchStroke,
} from '../lib/sketches';

const STORAGE_KEY = '@example-apps/sketchbook/collection-v1';
const COLORS = ['#1f2320', '#7c3028', '#315d87', '#4f7047', '#8a6631'] as const;
const WIDTHS = [2, 5, 10] as const;

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function strokePath(stroke: SketchStroke, width: number, height: number): string {
  const points = stroke.points.map((point) => ({ x: point.x * width, y: point.y * height }));
  const first = points[0];
  if (!first) return '';
  if (points.length === 1) return `M ${first.x} ${first.y} L ${first.x + 0.01} ${first.y + 0.01}`;
  return [`M ${first.x} ${first.y}`, ...points.slice(1).map((point) => `L ${point.x} ${point.y}`)].join(' ');
}

function DrawingCanvas({
  sketch,
  color,
  brushWidth,
  onStroke,
}: {
  sketch: Sketch;
  color: string;
  brushWidth: number;
  onStroke: (stroke: SketchStroke) => void;
}) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [draft, setDraft] = useState<SketchStroke | null>(null);
  const draftRef = useRef<SketchStroke | null>(null);

  const pointFromEvent = (event: GestureResponderEvent): SketchPoint => ({
    x: Math.max(0, Math.min(1, event.nativeEvent.locationX / Math.max(1, size.width))),
    y: Math.max(0, Math.min(1, event.nativeEvent.locationY / Math.max(1, size.height))),
  });

  const begin = (event: GestureResponderEvent) => {
    const stroke = createStroke({
      id: makeId('stroke'),
      color,
      width: brushWidth,
      points: [pointFromEvent(event)],
    });
    draftRef.current = stroke;
    setDraft(stroke);
  };

  const move = (event: GestureResponderEvent) => {
    const current = draftRef.current;
    if (!current) return;
    const point = pointFromEvent(event);
    const previous = current.points.at(-1);
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 0.0015) return;
    const next = { ...current, points: [...current.points, point] };
    draftRef.current = next;
    setDraft(next);
  };

  const finish = () => {
    const current = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    if (current) onStroke(current);
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: begin,
        onPanResponderMove: move,
        onPanResponderRelease: finish,
        onPanResponderTerminate: finish,
      }),
    [brushWidth, color, size.height, size.width],
  );

  return (
    <View
      {...responder.panHandlers}
      onLayout={(event) => setSize(event.nativeEvent.layout)}
      style={styles.canvas}>
      <Svg height="100%" pointerEvents="none" width="100%">
        {[...sketch.strokes, ...(draft ? [draft] : [])].map((stroke) => (
          <Path
            d={strokePath(stroke, size.width, size.height)}
            fill="none"
            key={stroke.id}
            stroke={stroke.color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={stroke.width}
          />
        ))}
      </Svg>
    </View>
  );
}

export default function SketchbookApp() {
  const [collection, setCollection] = useState<SketchCollection>(emptySketchCollection());
  const [hydrated, setHydrated] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [color, setColor] = useState<string>(COLORS[0]);
  const [brushWidth, setBrushWidth] = useState<number>(WIDTHS[1]);
  const [redoBySketch, setRedoBySketch] = useState<Record<string, SketchStroke[]>>({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!active) return;
        setCollection(deserializeSketchCollection(stored));
        setHydrated(true);
      })
      .catch(() => {
        if (active) {
          setMessage('Sketches could not be read. Changes will not be persisted until the app is reopened successfully.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
    }, 150);
    return () => clearTimeout(timer);
  }, [collection, hydrated]);

  const selectedSketch = useMemo(
    () => collection.sketches.find((sketch) => sketch.id === collection.selectedSketchId) ?? null,
    [collection],
  );

  const replaceSketch = (replacement: Sketch) => {
    setCollection((current) => ({
      ...current,
      sketches: current.sketches.map((sketch) => sketch.id === replacement.id ? replacement : sketch),
    }));
  };

  const addSketch = () => {
    if (!newTitle.trim()) return;
    try {
      const sketch = createSketch({ id: makeId('sketch'), title: newTitle });
      setCollection((current) => ({ sketches: [...current.sketches, sketch], selectedSketchId: sketch.id }));
      setNewTitle('');
      setMessage('Sketch created.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create sketch.');
    }
  };

  const commitStroke = (stroke: SketchStroke) => {
    if (!selectedSketch) return;
    replaceSketch(appendStroke(selectedSketch, stroke));
    setRedoBySketch((current) => ({ ...current, [selectedSketch.id]: [] }));
  };

  const undo = () => {
    if (!selectedSketch) return;
    const result = removeLastStroke(selectedSketch);
    if (!result.removed) return;
    replaceSketch(result.sketch);
    setRedoBySketch((current) => ({
      ...current,
      [selectedSketch.id]: [...(current[selectedSketch.id] ?? []), result.removed!],
    }));
  };

  const redo = () => {
    if (!selectedSketch) return;
    const stack = redoBySketch[selectedSketch.id] ?? [];
    const stroke = stack.at(-1);
    if (!stroke) return;
    replaceSketch(appendStroke(selectedSketch, stroke));
    setRedoBySketch((current) => ({ ...current, [selectedSketch.id]: stack.slice(0, -1) }));
  };

  const clear = () => {
    if (!selectedSketch) return;
    replaceSketch(clearSketch(selectedSketch));
    setRedoBySketch((current) => ({ ...current, [selectedSketch.id]: [] }));
  };

  const removeSketch = () => {
    if (!selectedSketch) return;
    const remaining = collection.sketches.filter((sketch) => sketch.id !== selectedSketch.id);
    setCollection({ sketches: remaining, selectedSketchId: remaining[0]?.id ?? null });
    setRedoBySketch((current) => {
      const next = { ...current };
      delete next[selectedSketch.id];
      return next;
    });
    setMessage('Sketch removed.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>SKETCHBOOK</Text>
        <Text style={styles.heading}>Draw first. Decide what it needs later.</Text>
        <Text style={styles.subheading}>
          A small vector sketchbook for gesture, composition, value, and ordinary drawing studies.
        </Text>

        <View style={styles.createRow}>
          <TextInput
            accessibilityLabel="New sketch title"
            onChangeText={setNewTitle}
            onSubmitEditing={addSketch}
            placeholder="New sketch title"
            placeholderTextColor="#75756f"
            style={styles.titleInput}
            value={newTitle}
          />
          <Pressable disabled={!newTitle.trim()} onPress={addSketch} style={[styles.addButton, !newTitle.trim() && styles.disabled]}>
            <Text style={styles.addButtonText}>Create</Text>
          </Pressable>
        </View>

        {collection.sketches.length > 0 ? (
          <ScrollView contentContainerStyle={styles.sketchTabs} horizontal showsHorizontalScrollIndicator={false}>
            {collection.sketches.map((sketch) => (
              <Pressable
                accessibilityState={{ selected: collection.selectedSketchId === sketch.id }}
                key={sketch.id}
                onPress={() => setCollection((current) => ({ ...current, selectedSketchId: sketch.id }))}
                style={[styles.sketchTab, collection.selectedSketchId === sketch.id && styles.sketchTabSelected]}>
                <Text style={[styles.sketchTabText, collection.selectedSketchId === sketch.id && styles.sketchTabTextSelected]}>{sketch.title}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {message ? <Text style={styles.message}>{message}</Text> : null}

        {selectedSketch ? (
          <>
            <View style={styles.toolbar}>
              <View style={styles.toolGroup}>
                <Text style={styles.toolLabel}>Ink</Text>
                <View style={styles.choiceRow}>
                  {COLORS.map((candidate) => (
                    <Pressable
                      accessibilityLabel={`Brush color ${candidate}`}
                      accessibilityState={{ selected: color === candidate }}
                      key={candidate}
                      onPress={() => setColor(candidate)}
                      style={[styles.colorChoice, { backgroundColor: candidate }, color === candidate && styles.colorChoiceSelected]}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.toolGroup}>
                <Text style={styles.toolLabel}>Width</Text>
                <View style={styles.choiceRow}>
                  {WIDTHS.map((candidate) => (
                    <Pressable
                      accessibilityState={{ selected: brushWidth === candidate }}
                      key={candidate}
                      onPress={() => setBrushWidth(candidate)}
                      style={[styles.widthChoice, brushWidth === candidate && styles.widthChoiceSelected]}>
                      <View style={{ backgroundColor: color, borderRadius: candidate / 2, height: candidate, width: Math.max(18, candidate * 2) }} />
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.actionRow}>
                <Pressable disabled={selectedSketch.strokes.length === 0} onPress={undo} style={styles.textButton}>
                  <Text style={styles.textButtonText}>Undo</Text>
                </Pressable>
                <Pressable disabled={(redoBySketch[selectedSketch.id] ?? []).length === 0} onPress={redo} style={styles.textButton}>
                  <Text style={styles.textButtonText}>Redo</Text>
                </Pressable>
                <Pressable disabled={selectedSketch.strokes.length === 0} onPress={clear} style={styles.textButton}>
                  <Text style={styles.textButtonText}>Clear</Text>
                </Pressable>
                <Pressable onPress={removeSketch} style={styles.textButton}>
                  <Text style={styles.deleteText}>Delete sketch</Text>
                </Pressable>
              </View>
            </View>

            <DrawingCanvas brushWidth={brushWidth} color={color} onStroke={commitStroke} sketch={selectedSketch} />
            <Text style={styles.canvasHint}>Draw directly on the page. Strokes are stored as normalized vector points.</Text>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Create a sketch to begin.</Text>
            <Text style={styles.emptyText}>The first requirement is intentionally just drawing.</Text>
          </View>
        )}

        <Text style={styles.footer}>
          This MVP does not yet claim pressure sensitivity, layers, reference images, or production-grade image/vector export.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f1efe9' },
  content: { width: '100%', maxWidth: 980, alignSelf: 'center', padding: 20, paddingBottom: 48 },
  eyebrow: { color: '#6a6963', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  heading: { color: '#20211f', fontSize: 36, fontWeight: '800', lineHeight: 42, letterSpacing: -1.2, marginTop: 8 },
  subheading: { color: '#6c6b65', fontSize: 15, lineHeight: 22, marginTop: 8 },
  createRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginTop: 22 },
  titleInput: { backgroundColor: '#fff', borderColor: '#d1cec5', borderRadius: 12, borderWidth: 1, color: '#20211f', flex: 1, fontSize: 15, paddingHorizontal: 13, paddingVertical: 11 },
  addButton: { backgroundColor: '#292b28', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  addButtonText: { color: '#fff', fontWeight: '800' },
  disabled: { opacity: 0.35 },
  sketchTabs: { gap: 8, paddingVertical: 15 },
  sketchTab: { borderColor: '#c8c5bd', borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 8 },
  sketchTabSelected: { backgroundColor: '#292b28', borderColor: '#292b28' },
  sketchTabText: { color: '#66655f', fontSize: 12, fontWeight: '700' },
  sketchTabTextSelected: { color: '#fff' },
  message: { color: '#5f625b', fontSize: 13, lineHeight: 19, marginBottom: 10 },
  toolbar: { borderBottomColor: '#d3d0c8', borderBottomWidth: 1, borderTopColor: '#d3d0c8', borderTopWidth: 1, gap: 15, paddingVertical: 13 },
  toolGroup: { gap: 7 },
  toolLabel: { color: '#77756e', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  choiceRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorChoice: { borderColor: '#f1efe9', borderRadius: 18, borderWidth: 3, height: 32, width: 32 },
  colorChoiceSelected: { outlineColor: '#2d302c', outlineStyle: 'solid', outlineWidth: 2 },
  widthChoice: { alignItems: 'center', borderColor: '#cbc8c0', borderRadius: 9, borderWidth: 1, height: 34, justifyContent: 'center', minWidth: 48, paddingHorizontal: 8 },
  widthChoiceSelected: { backgroundColor: '#e1ded5', borderColor: '#77766f' },
  actionRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 13 },
  textButton: { paddingVertical: 5 },
  textButtonText: { color: '#454b44', fontSize: 12, fontWeight: '800' },
  deleteText: { color: '#8b4c43', fontSize: 12, fontWeight: '800' },
  canvas: { backgroundColor: '#fffdfa', borderColor: '#cbc8c0', borderRadius: 3, borderWidth: 1, height: 560, marginTop: 16, overflow: 'hidden', width: '100%' },
  canvasHint: { color: '#85837d', fontSize: 11, marginTop: 7 },
  emptyState: { alignItems: 'center', borderColor: '#d3d0c8', borderRadius: 16, borderWidth: 1, marginTop: 20, padding: 34 },
  emptyTitle: { color: '#31322f', fontSize: 16, fontWeight: '800' },
  emptyText: { color: '#77756e', fontSize: 13, marginTop: 6, textAlign: 'center' },
  footer: { color: '#85837d', fontSize: 12, lineHeight: 18, marginTop: 24 },
});
