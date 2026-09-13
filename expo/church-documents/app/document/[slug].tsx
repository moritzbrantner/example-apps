import { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { findDocument } from '../../lib/documents';
import {
  emptyReadingState,
  loadReadingState,
  saveReadingState,
  withBookmarkToggled,
  withReadingStatus,
  type ReadingState,
  type ReadingStatus,
} from '../../lib/reading-state';

const readingStatuses: readonly { value: ReadingStatus; label: string }[] = [
  { value: 'unread', label: 'Not started' },
  { value: 'reading', label: 'Reading' },
  { value: 'finished', label: 'Finished' },
];

export default function DocumentDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const document = findDocument(slug);
  const [readingState, setReadingState] = useState<ReadingState>(emptyReadingState);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void loadReadingState().then((next) => {
        if (active) {
          setReadingState(next);
        }
      });

      return () => {
        active = false;
      };
    }, []),
  );

  if (!document) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.notFound}>
          <Text style={styles.title}>Document not found</Text>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Back to catalog</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const bookmarked = readingState.bookmarks.includes(document.slug);
  const status = readingState.statuses[document.slug] ?? 'unread';

  async function updateState(next: ReadingState) {
    setReadingState(next);
    await saveReadingState(next);
  }

  async function openOfficialSource() {
    try {
      await Linking.openURL(document.officialSourceUrl);
    } catch {
      Alert.alert('Could not open source', 'The official document could not be opened on this device.');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page}>
        <Pressable accessibilityRole="button" hitSlop={10} onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Text style={styles.meta}>
          {document.family} · {formatDate(document.publishedOn)}
        </Text>
        <Text style={styles.title}>{document.title}</Text>
        <Text style={styles.subtitle}>{document.subtitle}</Text>
        <Text style={styles.issuer}>{document.issuedBy}</Text>

        <View style={styles.rule} />

        <Text style={styles.sectionLabel}>Overview</Text>
        <Text style={styles.summary}>{document.summary}</Text>

        <View style={styles.topics}>
          {document.topics.map((topic) => (
            <View key={topic} style={styles.topic}>
              <Text style={styles.topicText}>{topic}</Text>
            </View>
          ))}
        </View>

        <View style={styles.rule} />

        <Text style={styles.sectionLabel}>Reading status</Text>
        <View style={styles.statusGroup}>
          {readingStatuses.map((option) => {
            const selected = option.value === status;
            return (
              <Pressable
                accessibilityRole="button"
                key={option.value}
                onPress={() =>
                  void updateState(withReadingStatus(readingState, document.slug, option.value))
                }
                style={[styles.statusButton, selected && styles.statusButtonSelected]}
              >
                <Text style={[styles.statusText, selected && styles.statusTextSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void openOfficialSource()}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Open official text</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void updateState(withBookmarkToggled(readingState, document.slug))}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>{bookmarked ? 'Remove bookmark' : 'Bookmark'}</Text>
          </Pressable>
        </View>

        <Text style={styles.sourceNote}>
          The Vatican-hosted document is the authoritative source. This app stores only catalog metadata, an app-authored overview, and your local reading state in this slice.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f4ef',
  },
  page: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 48,
  },
  notFound: {
    flex: 1,
    gap: 20,
    justifyContent: 'center',
    padding: 24,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 28,
    paddingVertical: 4,
  },
  backText: {
    color: '#7c2d12',
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    color: '#7c2d12',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    color: '#1c1917',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: 8,
  },
  subtitle: {
    color: '#44403c',
    fontSize: 19,
    fontWeight: '600',
    lineHeight: 27,
    marginTop: 8,
  },
  issuer: {
    color: '#78716c',
    fontSize: 15,
    marginTop: 8,
  },
  rule: {
    backgroundColor: '#d6d3d1',
    height: 1,
    marginVertical: 26,
  },
  sectionLabel: {
    color: '#1c1917',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  summary: {
    color: '#44403c',
    fontSize: 17,
    lineHeight: 27,
  },
  topics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
  },
  topic: {
    backgroundColor: '#ede7de',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  topicText: {
    color: '#44403c',
    fontSize: 13,
    fontWeight: '600',
  },
  statusGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    borderColor: '#d6d3d1',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  statusButtonSelected: {
    backgroundColor: '#292524',
    borderColor: '#292524',
  },
  statusText: {
    color: '#57534e',
    fontSize: 14,
    fontWeight: '600',
  },
  statusTextSelected: {
    color: '#fffdfa',
  },
  actions: {
    gap: 10,
    marginTop: 30,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#7c2d12',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: '#fffdfa',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#a8a29e',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  secondaryButtonText: {
    color: '#44403c',
    fontSize: 15,
    fontWeight: '700',
  },
  sourceNote: {
    color: '#78716c',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 24,
  },
});
