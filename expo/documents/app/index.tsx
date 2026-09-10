import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createDocumentRecord,
  deserializeDocuments,
  parseDocumentAddHandoff,
  type DocumentSource,
  type HouseholdDocument,
} from '../lib/documents';

const STORAGE_KEY = '@example-apps/documents/list-v1';
const CATEGORIES = ['Receipt', 'Warranty', 'Manual', 'Contract', 'Other'] as const;

function makeId(): string {
  return `document-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultTitle(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '').trim();
  return withoutExtension || fileName;
}

function safeFileName(fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
  return safe || 'document';
}

function formatSize(size: number | null): string {
  if (size === null) return 'Size unknown';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsApp() {
  const [documents, setDocuments] = useState<HouseholdDocument[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Other');
  const [notes, setNotes] = useState('');
  const [source, setSource] = useState<DocumentSource | null>(null);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!active) return;
        setDocuments(deserializeDocuments(stored));
        setHydrated(true);
      })
      .catch(() => {
        if (active) {
          setMessage(
            'Document metadata could not be read. Changes will not be persisted until the app is reopened successfully.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
    }, 150);
    return () => clearTimeout(timer);
  }, [documents, hydrated]);

  useEffect(() => {
    const handleUrl = (url: string) => {
      const nextSource = parseDocumentAddHandoff(url);
      if (!nextSource) return;
      setSource(nextSource);
      setTitle((current) => current || `${nextSource.label} document`);
      setMessage(`Ready to attach a document to ${nextSource.label}.`);
    };

    void Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, []);

  const visibleDocuments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const sorted = [...documents].sort((left, right) => right.addedAt.localeCompare(left.addedAt));
    if (!normalized) return sorted;
    return sorted.filter((document) =>
      [
        document.title,
        document.category,
        document.originalName,
        document.notes,
        document.source?.label ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    );
  }, [documents, query]);

  const importDocument = async () => {
    setMessage('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: '*/*',
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) return;
      const id = makeId();
      let storedUri = asset.uri;
      let managedFile = false;

      if (Platform.OS !== 'web') {
        const directory = new Directory(Paths.document, 'household-documents');
        directory.create({ idempotent: true, intermediates: true });
        const destination = new File(directory, `${id}-${safeFileName(asset.name)}`);
        new File(asset.uri).copy(destination);
        storedUri = destination.uri;
        managedFile = true;
      }

      const record = createDocumentRecord({
        id,
        title: title.trim() || defaultTitle(asset.name),
        category,
        originalName: asset.name,
        storedUri,
        mimeType: asset.mimeType ?? '',
        size: asset.size ?? null,
        managedFile,
        source,
        notes,
      });

      setDocuments((current) => [record, ...current]);
      setTitle('');
      setCategory('Other');
      setNotes('');
      setSource(null);
      setMessage(
        managedFile
          ? `${record.title} was copied into managed local storage.`
          : `${record.title} was added with a temporary browser file reference.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not import the document.');
    }
  };

  const shareDocument = async (document: HouseholdDocument) => {
    setMessage('');
    try {
      if (Platform.OS === 'web') {
        await Linking.openURL(document.storedUri);
        setMessage('Opened the browser file reference. It may no longer exist after this browser session.');
        return;
      }
      if (!(await Sharing.isAvailableAsync())) {
        setMessage('System sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(document.storedUri, {
        ...(document.mimeType ? { mimeType: document.mimeType } : {}),
      });
    } catch {
      setMessage('The stored file could not be opened or shared.');
    }
  };

  const removeDocument = (document: HouseholdDocument) => {
    if (document.managedFile && Platform.OS !== 'web') {
      try {
        new File(document.storedUri).delete();
      } catch {
        // Removing the catalog record remains useful if the managed file was already missing.
      }
    }
    setDocuments((current) => current.filter((candidate) => candidate.id !== document.id));
    setMessage(`${document.title} removed.`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>HOUSEHOLD DOCUMENTS</Text>
          <Text style={styles.heading}>Keep the file with the thing it belongs to.</Text>
          <Text style={styles.subheading}>
            Receipts, warranties, manuals, and contracts stay locally cataloged and can retain a reference to another everyday app.
          </Text>

          {Platform.OS === 'web' ? (
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>Web preview limitation</Text>
              <Text style={styles.noticeText}>
                Browser-selected files are temporary references. Durable managed-file storage and system file sharing are native-app capabilities in this MVP.
              </Text>
            </View>
          ) : null}

          <View style={styles.composer}>
            <Text style={styles.sectionTitle}>Import document</Text>
            {source ? (
              <View style={styles.sourceRow}>
                <View style={styles.sourceCopy}>
                  <Text style={styles.sourceLabel}>Linked from {source.app}</Text>
                  <Text style={styles.sourceName}>{source.label}</Text>
                </View>
                <Pressable onPress={() => setSource(null)} style={styles.textButton}>
                  <Text style={styles.deleteText}>Unlink</Text>
                </Pressable>
              </View>
            ) : null}

            <TextInput
              accessibilityLabel="Document title"
              onChangeText={setTitle}
              placeholder="Optional title; file name is used by default"
              placeholderTextColor="#7b817b"
              style={styles.input}
              value={title}
            />

            <Text style={styles.smallLabel}>Category</Text>
            <View style={styles.choiceRow}>
              {CATEGORIES.map((candidate) => (
                <Pressable
                  key={candidate}
                  accessibilityState={{ selected: category === candidate }}
                  onPress={() => setCategory(candidate)}
                  style={[styles.choice, category === candidate && styles.choiceSelected]}>
                  <Text style={[styles.choiceText, category === candidate && styles.choiceTextSelected]}>
                    {candidate}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              accessibilityLabel="Document notes"
              multiline
              onChangeText={setNotes}
              placeholder="Purchase date, serial number, context…"
              placeholderTextColor="#7b817b"
              style={[styles.input, styles.notesInput]}
              value={notes}
            />

            <Pressable onPress={() => void importDocument()} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>Choose file</Text>
            </Pressable>
          </View>

          {message ? <Text style={styles.message}>{message}</Text> : null}

          {documents.length > 0 ? (
            <TextInput
              accessibilityLabel="Search documents"
              onChangeText={setQuery}
              placeholder="Search title, category, source, or notes"
              placeholderTextColor="#7b817b"
              style={styles.searchInput}
              value={query}
            />
          ) : null}

          <Text style={styles.sectionTitle}>Documents</Text>
          <View style={styles.list}>
            {visibleDocuments.length === 0 ? (
              <Text style={styles.emptyText}>{documents.length === 0 ? 'No documents yet.' : 'No documents match.'}</Text>
            ) : (
              visibleDocuments.map((document) => (
                <View key={document.id} style={styles.documentRow}>
                  <View style={styles.documentCopy}>
                    <View style={styles.titleRow}>
                      <Text style={styles.documentTitle}>{document.title}</Text>
                      <Text style={styles.category}>{document.category}</Text>
                    </View>
                    <Text style={styles.meta}>
                      {document.originalName} · {formatSize(document.size)}
                    </Text>
                    {document.source ? (
                      <Text style={styles.sourceMeta}>
                        {document.source.app} · {document.source.label}
                      </Text>
                    ) : null}
                    {document.notes ? <Text style={styles.note}>{document.notes}</Text> : null}
                    {!document.managedFile ? <Text style={styles.temporary}>Temporary browser file reference</Text> : null}
                  </View>
                  <View style={styles.actionRow}>
                    <Pressable onPress={() => void shareDocument(document)} style={styles.textButton}>
                      <Text style={styles.textButtonText}>{Platform.OS === 'web' ? 'Open' : 'Share / export'}</Text>
                    </Pressable>
                    <Pressable onPress={() => removeDocument(document)} style={styles.textButton}>
                      <Text style={styles.deleteText}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>

          <Text style={styles.footer}>
            This app owns document files and document metadata only. Linked Inventory and Maintenance objects remain owned by their source apps.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#f5f3ed' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingBottom: 52 },
  eyebrow: { color: '#657067', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  heading: { color: '#1f2921', fontSize: 34, fontWeight: '800', lineHeight: 39, letterSpacing: -1, marginTop: 8 },
  subheading: { color: '#687068', fontSize: 15, lineHeight: 22, marginTop: 8 },
  notice: { borderColor: '#d8cfb6', borderWidth: 1, borderRadius: 16, marginTop: 18, padding: 14 },
  noticeTitle: { color: '#62532d', fontSize: 13, fontWeight: '800' },
  noticeText: { color: '#756a4d', fontSize: 12, lineHeight: 18, marginTop: 4 },
  composer: { borderTopColor: '#d9dbd5', borderTopWidth: 1, marginTop: 24, paddingTop: 20 },
  sectionTitle: { color: '#273129', fontSize: 18, fontWeight: '800' },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, paddingVertical: 10 },
  sourceCopy: { flex: 1, minWidth: 0 },
  sourceLabel: { color: '#737a74', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  sourceName: { color: '#273129', fontSize: 15, fontWeight: '800', marginTop: 2 },
  input: { backgroundColor: '#fff', borderColor: '#d7d9d2', borderWidth: 1, borderRadius: 14, color: '#1f2921', fontSize: 16, marginTop: 10, paddingHorizontal: 14, paddingVertical: 12 },
  notesInput: { minHeight: 82, textAlignVertical: 'top' },
  smallLabel: { color: '#687068', fontSize: 12, fontWeight: '700', marginTop: 13 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  choice: { borderColor: '#cfd3cc', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  choiceSelected: { backgroundColor: '#243c2b', borderColor: '#243c2b' },
  choiceText: { color: '#687068', fontSize: 12, fontWeight: '700' },
  choiceTextSelected: { color: '#fff' },
  primaryButton: { alignItems: 'center', backgroundColor: '#243c2b', borderRadius: 14, marginTop: 14, paddingVertical: 13 },
  primaryButtonText: { color: '#fff', fontWeight: '800' },
  pressed: { opacity: 0.68 },
  message: { color: '#4f6555', fontSize: 13, lineHeight: 19, marginVertical: 14 },
  searchInput: { backgroundColor: '#fff', borderColor: '#d7d9d2', borderWidth: 1, borderRadius: 14, color: '#1f2921', fontSize: 15, marginBottom: 18, paddingHorizontal: 14, paddingVertical: 11 },
  list: { borderTopColor: '#d9dbd5', borderTopWidth: 1, marginTop: 10 },
  documentRow: { borderBottomColor: '#d9dbd5', borderBottomWidth: 1, paddingVertical: 15 },
  documentCopy: { minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  documentTitle: { color: '#273129', fontSize: 17, fontWeight: '800' },
  category: { color: '#5d695f', fontSize: 11, fontWeight: '800' },
  meta: { color: '#737a74', fontSize: 12, marginTop: 4 },
  sourceMeta: { color: '#526a58', fontSize: 12, fontWeight: '700', marginTop: 4 },
  note: { color: '#666e67', fontSize: 13, lineHeight: 19, marginTop: 5 },
  temporary: { color: '#8a6540', fontSize: 11, fontWeight: '700', marginTop: 5 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 },
  textButton: { paddingVertical: 6 },
  textButtonText: { color: '#31513a', fontSize: 12, fontWeight: '800' },
  deleteText: { color: '#8c4a45', fontSize: 12, fontWeight: '800' },
  emptyText: { color: '#737a74', paddingVertical: 26, textAlign: 'center' },
  footer: { color: '#868b86', fontSize: 12, lineHeight: 18, marginTop: 26 },
});
