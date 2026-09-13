import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  documentFamilyFilters,
  filterDocuments,
  type ChurchDocument,
  type DocumentFamilyFilter,
} from '../lib/documents';
import {
  emptyReadingState,
  loadReadingState,
  saveReadingState,
  withBookmarkToggled,
  type ReadingState,
} from '../lib/reading-state';

export default function ChurchDocumentsScreen() {
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState<DocumentFamilyFilter>('All');
  const [readingState, setReadingState] = useState<ReadingState>(emptyReadingState);
  const [readingStateHydrated, setReadingStateHydrated] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setReadingStateHydrated(false);

      void loadReadingState().then((next) => {
        if (active) {
          setReadingState(next);
          setReadingStateHydrated(true);
        }
      });

      return () => {
        active = false;
      };
    }, []),
  );

  const documents = useMemo(() => filterDocuments(query, family), [family, query]);

  async function toggleBookmark(event: GestureResponderEvent, slug: string) {
    event.stopPropagation();
    if (!readingStateHydrated) {
      return;
    }

    const next = withBookmarkToggled(readingState, slug);
    setReadingState(next);
    await saveReadingState(next);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Reference library</Text>
          <Text style={styles.title}>Church Documents</Text>
          <Text style={styles.intro}>
            Find foundational documents, keep a private reading state, and open the canonical source when you are ready to read.
          </Text>
        </View>

        <TextInput
          accessibilityLabel="Search church documents"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder="Search title, topic, or issuer"
          placeholderTextColor="#78716c"
          style={styles.search}
          value={query}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {documentFamilyFilters.map((option) => {
            const selected = option === family;
            return (
              <Pressable
                accessibilityRole="button"
                key={option}
                onPress={() => setFamily(option)}
                style={[styles.filter, selected && styles.filterSelected]}
              >
                <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.resultsHeader}>
          <Text style={styles.sectionTitle}>Documents</Text>
          <Text style={styles.resultCount}>{documents.length} shown</Text>
        </View>

        <View style={styles.list}>
          {documents.map((document) => (
            <DocumentRow
              bookmarkEnabled={readingStateHydrated}
              bookmarked={readingState.bookmarks.includes(document.slug)}
              document={document}
              key={document.slug}
              onBookmark={toggleBookmark}
              status={readingState.statuses[document.slug] ?? 'unread'}
            />
          ))}
        </View>

        {documents.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No matching documents</Text>
            <Text style={styles.emptyText}>Try a different title, topic, issuer, or category.</Text>
          </View>
        ) : null}

        <Text style={styles.sourceNote}>
          Catalog summaries are app-authored. The official source remains authoritative.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function DocumentRow({
  bookmarkEnabled,
  bookmarked,
  document,
  onBookmark,
  status,
}: {
  bookmarkEnabled: boolean;
  bookmarked: boolean;
  document: ChurchDocument;
  onBookmark: (event: GestureResponderEvent, slug: string) => void;
  status: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({
          pathname: '/document/[slug]',
          params: { slug: document.slug },
        })
      }
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardTopLine}>
        <Text style={styles.meta}>
          {document.family} · {new Date(`${document.publishedOn}T00:00:00Z`).getUTCFullYear()}
        </Text>
        <Pressable
          accessibilityLabel={bookmarked ? `Remove ${document.title} bookmark` : `Bookmark ${document.title}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: !bookmarkEnabled }}
          disabled={!bookmarkEnabled}
          hitSlop={10}
          onPress={(event) => void onBookmark(event, document.slug)}
          style={[styles.bookmarkButton, !bookmarkEnabled && styles.bookmarkButtonDisabled]}
        >
          <Text style={styles.bookmarkText}>{bookmarked ? 'Saved' : 'Save'}</Text>
        </Pressable>
      </View>
      <Text style={styles.cardTitle}>{document.title}</Text>
      <Text style={styles.cardSubtitle}>{document.subtitle}</Text>
      <Text style={styles.cardSummary}>{document.summary}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.issuer}>{document.issuedBy}</Text>
        <Text style={styles.status}>{statusLabel(status)}</Text>
      </View>
    </Pressable>
  );
}

function statusLabel(status: string) {
  if (status === 'reading') {
    return 'Reading';
  }
  if (status === 'finished') {
    return 'Finished';
  }
  return 'Not started';
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f4ef',
  },
  page: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
  },
  header: {
    gap: 8,
    marginBottom: 22,
  },
  eyebrow: {
    color: '#7c2d12',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: '#1c1917',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  intro: {
    color: '#57534e',
    fontSize: 17,
    lineHeight: 25,
    maxWidth: 650,
  },
  search: {
    backgroundColor: '#fffdfa',
    borderColor: '#d6d3d1',
    borderRadius: 12,
    borderWidth: 1,
    color: '#1c1917',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  filters: {
    gap: 8,
    paddingVertical: 16,
  },
  filter: {
    borderColor: '#d6d3d1',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterSelected: {
    backgroundColor: '#292524',
    borderColor: '#292524',
  },
  filterText: {
    color: '#57534e',
    fontSize: 14,
    fontWeight: '600',
  },
  filterTextSelected: {
    color: '#fffdfa',
  },
  resultsHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    color: '#1c1917',
    fontSize: 20,
    fontWeight: '700',
  },
  resultCount: {
    color: '#78716c',
    fontSize: 13,
  },
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: '#fffdfa',
    borderColor: '#e7e5e4',
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    padding: 17,
  },
  cardPressed: {
    opacity: 0.8,
  },
  cardTopLine: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  meta: {
    color: '#7c2d12',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  bookmarkButton: {
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  bookmarkButtonDisabled: {
    opacity: 0.5,
  },
  bookmarkText: {
    color: '#7c2d12',
    fontSize: 13,
    fontWeight: '700',
  },
  cardTitle: {
    color: '#1c1917',
    fontSize: 22,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: '#44403c',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  cardSummary: {
    color: '#57534e',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
  },
  cardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  issuer: {
    color: '#78716c',
    flex: 1,
    fontSize: 13,
  },
  status: {
    color: '#44403c',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    color: '#1c1917',
    fontSize: 18,
    fontWeight: '700',
  },
  emptyText: {
    color: '#78716c',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  sourceNote: {
    color: '#78716c',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 24,
    textAlign: 'center',
  },
});
