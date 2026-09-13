import { useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { findDocument } from '../../../lib/documents';
import { downloadReaderDocument, loadCachedReaderDocument } from '../../../lib/reader-cache';
import {
  findReaderSource,
  findSectionIndexForParagraph,
  searchReaderDocument,
  type ReaderDocumentContent,
} from '../../../lib/reader-content';
import {
  emptyReadingState,
  loadReadingState,
  paragraphBookmarkKey,
  readerStateKey,
  saveReadingState,
  withParagraphBookmarkToggled,
  withReadingStatus,
  withResumeLocation,
  type ReadingState,
} from '../../../lib/reading-state';

export default function ReaderScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const catalogDocument = findDocument(slug);
  const source = catalogDocument ? findReaderSource(catalogDocument.slug) : undefined;
  const [content, setContent] = useState<ReaderDocumentContent | null>(null);
  const [readingState, setReadingState] = useState<ReadingState>(emptyReadingState);
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!source) {
      setLoading(false);
      return;
    }

    const effectSource = source;
    let active = true;
    void Promise.all([loadReadingState(), loadCachedReaderDocument(effectSource)]).then(
      ([nextState, cached]) => {
        if (!active) {
          return;
        }
        setReadingState(nextState);
        setContent(cached);
        if (cached) {
          const resumeParagraph =
            nextState.resumeLocations[
              readerStateKey(effectSource.documentSlug, effectSource.language)
            ];
          setSelectedSectionIndex(findSectionIndexForParagraph(cached, resumeParagraph) ?? 0);
        }
        setLoading(false);
      },
      () => {
        if (active) {
          setError('Stored reader data could not be loaded.');
          setLoading(false);
        }
      },
    );

    return () => {
      active = false;
    };
  }, [source]);

  const searchResults = useMemo(
    () => (content ? searchReaderDocument(content, query) : []),
    [content, query],
  );

  if (!catalogDocument) {
    return <MessageScreen title="Document not found" message="This document is not in the catalog." />;
  }

  if (!source) {
    return (
      <MessageScreen
        title="Reader not available yet"
        message="This document does not have a reviewed in-app text source yet. Use the official source for now."
        officialSourceUrl={catalogDocument.officialSourceUrl}
      />
    );
  }

  const selectedDocument = catalogDocument;
  const selectedSource = source;
  const selectedSection = content?.sections[selectedSectionIndex];

  async function persist(next: ReadingState) {
    setReadingState(next);
    await saveReadingState(next);
  }

  async function download() {
    setDownloading(true);
    setError(null);
    try {
      const nextContent = await downloadReaderDocument(selectedSource);
      setContent(nextContent);
      setQuery('');
      setSelectedSectionIndex(0);

      const firstParagraph = nextContent.sections[0]?.paragraphs[0];
      let nextState =
        readingState.statuses[selectedSource.documentSlug] === 'finished'
          ? readingState
          : withReadingStatus(readingState, selectedSource.documentSlug, 'reading');
      if (firstParagraph) {
        nextState = withResumeLocation(
          nextState,
          selectedSource.documentSlug,
          selectedSource.language,
          firstParagraph.id,
        );
      }
      await persist(nextState);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : 'The reader source could not be downloaded.',
      );
    } finally {
      setDownloading(false);
    }
  }

  async function selectSection(index: number, paragraphId?: string) {
    if (!content || index < 0 || index >= content.sections.length) {
      return;
    }
    setSelectedSectionIndex(index);
    setQuery('');
    const location = paragraphId ?? content.sections[index]?.paragraphs[0]?.id;
    if (location) {
      await persist(
        withResumeLocation(
          readingState,
          selectedSource.documentSlug,
          selectedSource.language,
          location,
        ),
      );
    }
  }

  async function toggleParagraphBookmark(paragraphId: string) {
    await persist(
      withParagraphBookmarkToggled(
        readingState,
        selectedSource.documentSlug,
        selectedSource.language,
        paragraphId,
      ),
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Pressable
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Text style={styles.eyebrow}>In-app reader</Text>
        <Text style={styles.title}>{selectedDocument.title}</Text>
        <Text style={styles.sourceLine}>
          {selectedSource.languageLabel} · {selectedSource.provider}
        </Text>

        {loading ? <Text style={styles.message}>Loading local reader…</Text> : null}

        {!loading && !content ? (
          <View style={styles.downloadPanel}>
            <Text style={styles.sectionTitle}>Download text for offline reading</Text>
            <Text style={styles.bodyText}>
              The text is downloaded only when you ask for it, then cached locally. Source
              provenance is kept separately from your bookmarks and reading status.
            </Text>
            <Text style={styles.provenance}>{selectedSource.provenanceNote}</Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={downloading}
              onPress={() => void download()}
              style={[styles.primaryButton, downloading && styles.disabledButton]}
            >
              <Text style={styles.primaryButtonText}>
                {downloading ? 'Downloading…' : 'Download reader text'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              onPress={() => void Linking.openURL(selectedDocument.officialSourceUrl)}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Open official Vatican text</Text>
            </Pressable>
          </View>
        ) : null}

        {content ? (
          <>
            <View style={styles.provenanceBlock}>
              <Text style={styles.provenance}>
                Cached {formatTimestamp(content.fetchedAt)}
                {content.sourceRevision ? ` · source revision ${content.sourceRevision}` : ''}
              </Text>
              <View style={styles.inlineActions}>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => void Linking.openURL(selectedSource.sourcePageUrl)}
                >
                  <Text style={styles.textLink}>Source transcription</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => void Linking.openURL(selectedDocument.officialSourceUrl)}
                >
                  <Text style={styles.textLink}>Official text</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={downloading}
                  onPress={() => void download()}
                >
                  <Text style={styles.textLink}>
                    {downloading ? 'Refreshing…' : 'Refresh source'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TextInput
              accessibilityLabel={`Search ${selectedDocument.title}`}
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder="Search full text"
              placeholderTextColor="#78716c"
              style={styles.search}
              value={query}
            />

            {query.trim() ? (
              <View style={styles.searchResults}>
                <Text style={styles.sectionTitle}>Search results</Text>
                <Text style={styles.resultCount}>{searchResults.length} matching paragraphs</Text>
                {searchResults.map((result) => {
                  const sectionIndex = content.sections.findIndex(
                    (section) => section.id === result.sectionId,
                  );
                  if (sectionIndex < 0) {
                    return null;
                  }
                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={result.paragraph.id}
                      onPress={() => void selectSection(sectionIndex, result.paragraph.id)}
                      style={styles.searchResult}
                    >
                      <Text style={styles.resultHeading}>{result.sectionHeading}</Text>
                      <Text numberOfLines={4} style={styles.resultText}>
                        {result.paragraph.text}
                      </Text>
                    </Pressable>
                  );
                })}
                {searchResults.length === 0 ? (
                  <Text style={styles.bodyText}>No matching paragraphs.</Text>
                ) : null}
              </View>
            ) : selectedSection ? (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.sections}
                >
                  {content.sections.map((section, index) => {
                    const selected = index === selectedSectionIndex;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={section.id}
                        onPress={() => void selectSection(index)}
                        style={[styles.sectionChip, selected && styles.sectionChipSelected]}
                      >
                        <Text
                          style={[
                            styles.sectionChipText,
                            selected && styles.sectionChipTextSelected,
                          ]}
                        >
                          {section.heading}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Text style={styles.readerHeading}>{selectedSection.heading}</Text>
                <View style={styles.paragraphs}>
                  {selectedSection.paragraphs.map((paragraph) => {
                    const bookmarkKey = paragraphBookmarkKey(
                      selectedSource.documentSlug,
                      selectedSource.language,
                      paragraph.id,
                    );
                    const bookmarked = readingState.paragraphBookmarks.includes(bookmarkKey);
                    return (
                      <View key={paragraph.id} style={styles.paragraphBlock}>
                        <Text style={styles.paragraphText}>{paragraph.text}</Text>
                        <Pressable
                          accessibilityLabel={
                            bookmarked ? 'Remove paragraph bookmark' : 'Bookmark paragraph'
                          }
                          accessibilityRole="button"
                          onPress={() => void toggleParagraphBookmark(paragraph.id)}
                          style={styles.paragraphAction}
                        >
                          <Text style={styles.paragraphActionText}>
                            {bookmarked ? 'Saved paragraph' : 'Save paragraph'}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.navigation}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={selectedSectionIndex === 0}
                    onPress={() => void selectSection(selectedSectionIndex - 1)}
                    style={[styles.navButton, selectedSectionIndex === 0 && styles.disabledButton]}
                  >
                    <Text style={styles.navButtonText}>Previous section</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={selectedSectionIndex >= content.sections.length - 1}
                    onPress={() => void selectSection(selectedSectionIndex + 1)}
                    style={[
                      styles.navButton,
                      selectedSectionIndex >= content.sections.length - 1 && styles.disabledButton,
                    ]}
                  >
                    <Text style={styles.navButtonText}>Next section</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function MessageScreen({
  title,
  message,
  officialSourceUrl,
}: {
  title: string;
  message: string;
  officialSourceUrl?: string;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.messagePage}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.bodyText}>{message}</Text>
        {officialSourceUrl ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL(officialSourceUrl)}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Open official source</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'locally';
  }
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f4ef' },
  page: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 56,
  },
  messagePage: { flex: 1, gap: 16, justifyContent: 'center', padding: 24 },
  backButton: { alignSelf: 'flex-start', marginBottom: 24, paddingVertical: 4 },
  backText: { color: '#7c2d12', fontSize: 15, fontWeight: '700' },
  eyebrow: {
    color: '#7c2d12',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  title: {
    color: '#1c1917',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: 6,
  },
  sourceLine: { color: '#78716c', fontSize: 14, marginTop: 7 },
  message: { color: '#57534e', fontSize: 16, marginTop: 28 },
  downloadPanel: { gap: 14, marginTop: 30 },
  sectionTitle: { color: '#1c1917', fontSize: 20, fontWeight: '800' },
  bodyText: { color: '#57534e', fontSize: 16, lineHeight: 24 },
  provenance: { color: '#78716c', fontSize: 12, lineHeight: 18 },
  provenanceBlock: {
    borderBottomColor: '#d6d3d1',
    borderBottomWidth: 1,
    gap: 8,
    marginTop: 22,
    paddingBottom: 18,
  },
  inlineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  textLink: { color: '#7c2d12', fontSize: 13, fontWeight: '700' },
  errorText: { color: '#991b1b', fontSize: 14, lineHeight: 20, marginTop: 12 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#7c2d12',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryButtonText: { color: '#fffdfa', fontSize: 15, fontWeight: '800' },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#a8a29e',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  secondaryButtonText: { color: '#44403c', fontSize: 15, fontWeight: '700' },
  disabledButton: { opacity: 0.4 },
  search: {
    backgroundColor: '#fffdfa',
    borderColor: '#d6d3d1',
    borderRadius: 12,
    borderWidth: 1,
    color: '#1c1917',
    fontSize: 16,
    marginTop: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchResults: { gap: 10, marginTop: 24 },
  resultCount: { color: '#78716c', fontSize: 13, marginBottom: 4 },
  searchResult: {
    borderBottomColor: '#d6d3d1',
    borderBottomWidth: 1,
    gap: 5,
    paddingVertical: 12,
  },
  resultHeading: { color: '#7c2d12', fontSize: 13, fontWeight: '700' },
  resultText: { color: '#44403c', fontSize: 15, lineHeight: 22 },
  sections: { gap: 8, paddingVertical: 22 },
  sectionChip: {
    borderColor: '#d6d3d1',
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 260,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  sectionChipSelected: { backgroundColor: '#292524', borderColor: '#292524' },
  sectionChipText: { color: '#57534e', fontSize: 13, fontWeight: '600' },
  sectionChipTextSelected: { color: '#fffdfa' },
  readerHeading: {
    color: '#1c1917',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 18,
  },
  paragraphs: { gap: 22 },
  paragraphBlock: { gap: 8 },
  paragraphText: { color: '#292524', fontSize: 18, lineHeight: 30 },
  paragraphAction: { alignSelf: 'flex-start', paddingVertical: 3 },
  paragraphActionText: { color: '#7c2d12', fontSize: 12, fontWeight: '700' },
  navigation: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    marginTop: 34,
  },
  navButton: {
    borderColor: '#a8a29e',
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  navButtonText: { color: '#44403c', fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
