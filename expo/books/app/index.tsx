import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CameraView,
  type BarcodeScanningResult,
  useCameraPermissions,
} from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
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
  createLibraryBook,
  type LibraryBook,
  lookupBookMetadata,
  type ReadingStatus,
} from '../lib/books';
import { normalizeIsbn } from '../lib/isbn';

const STORAGE_KEY = '@expo-template/books/library-v1';
const STATUS_OPTIONS: { value: ReadingStatus; label: string }[] = [
  { value: 'read', label: 'Read' },
  { value: 'reading', label: 'Reading' },
  { value: 'want-to-read', label: 'Want to read' },
];

function statusLabel(status: ReadingStatus) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function BookCover({ book, large = false }: { book: LibraryBook; large?: boolean }) {
  const coverStyle = large ? styles.coverLarge : styles.cover;

  if (book.coverUrl) {
    return <Image source={{ uri: book.coverUrl }} style={coverStyle} resizeMode="cover" />;
  }

  return (
    <View style={[coverStyle, styles.coverFallback]}>
      <Text style={styles.coverFallbackText}>{book.title.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

function BookCard({ book, onPress }: { book: LibraryBook; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.bookCard, pressed && styles.pressed]}
    >
      <BookCover book={book} />
      <View style={styles.bookCardBody}>
        <Text style={styles.bookTitle} numberOfLines={2}>
          {book.title}
        </Text>
        <Text style={styles.bookAuthor} numberOfLines={1}>
          {book.authors.length > 0 ? book.authors.join(', ') : 'Author unknown'}
        </Text>
        <View style={styles.bookMetaRow}>
          <Text style={styles.statusBadge}>{statusLabel(book.status)}</Text>
          {book.firstPublishedYear ? (
            <Text style={styles.mutedSmall}>{book.firstPublishedYear}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function LibraryView({
  books,
  onAdd,
  onSelect,
}: {
  books: LibraryBook[];
  onAdd: () => void;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const visibleBooks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const sorted = [...books].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );

    if (!normalizedQuery) {
      return sorted;
    }

    return sorted.filter((book) =>
      [
        book.title,
        book.authors.join(' '),
        book.isbn,
        book.notes,
        book.review,
        book.keyIdeas,
        book.meaning,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [books, query]);

  return (
    <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
      <View style={styles.heroRow}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>YOUR READING</Text>
          <Text style={styles.heading}>Library</Text>
          <Text style={styles.subtitle}>
            Keep the books you have read together with the notes, reviews, and ideas you want to remember.
          </Text>
        </View>
        <Pressable
          onPress={onAdd}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.primaryButtonText}>+ Add</Text>
        </Pressable>
      </View>

      {books.length > 0 ? (
        <TextInput
          accessibilityLabel="Search library"
          onChangeText={setQuery}
          placeholder="Search books or your notes"
          placeholderTextColor="#7c817b"
          style={styles.searchInput}
          value={query}
        />
      ) : null}

      {visibleBooks.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            {books.length === 0 ? 'Your shelf is empty.' : 'No books match.'}
          </Text>
          <Text style={styles.emptyBody}>
            {books.length === 0
              ? 'Scan the barcode on a book or enter an ISBN to create the first entry.'
              : 'Try a different title, author, ISBN, or phrase from your notes.'}
          </Text>
          {books.length === 0 ? (
            <Pressable
              onPress={onAdd}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryButtonText}>Add first book</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.bookList}>
          {visibleBooks.map((book) => (
            <BookCard key={book.id} book={book} onPress={() => onSelect(book.id)} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function AddBookView({
  books,
  onBack,
  onBookReady,
}: {
  books: LibraryBook[];
  onBack: () => void;
  onBookReady: (book: LibraryBook, alreadyExists: boolean) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [manualIsbn, setManualIsbn] = useState('');
  const [scanLocked, setScanLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (unlockTimer.current) {
        clearTimeout(unlockTimer.current);
      }
    },
    [],
  );

  const addByIsbn = async (rawValue: string) => {
    const isbn = normalizeIsbn(rawValue);
    if (!isbn) {
      setMessage('That is not a valid ISBN-10 or ISBN-13.');
      return;
    }

    const existing = books.find((book) => book.isbn === isbn);
    if (existing) {
      setMessage('This book is already in your library.');
      onBookReady(existing, true);
      return;
    }

    setBusy(true);
    setMessage('Looking up book details…');
    try {
      let metadata = null;
      try {
        metadata = await lookupBookMetadata(isbn);
      } catch {
        // Metadata is enrichment only. A valid ISBN can still be saved offline.
      }

      const book = createLibraryBook(isbn, metadata);
      setManualIsbn('');
      setMessage(metadata ? 'Book found.' : 'Saved locally. Add the missing details yourself.');
      onBookReady(book, false);
    } finally {
      setBusy(false);
    }
  };

  const handleBarcode = (result: BarcodeScanningResult) => {
    if (scanLocked || busy) {
      return;
    }

    setScanLocked(true);
    const isbn = normalizeIsbn(result.data);
    if (!isbn) {
      setMessage('Barcode detected, but it is not an ISBN book barcode.');
      unlockTimer.current = setTimeout(() => setScanLocked(false), 1200);
      return;
    }

    void addByIsbn(isbn);
  };

  return (
    <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <Text style={styles.backButtonText}>‹ Library</Text>
      </Pressable>

      <Text style={styles.eyebrow}>ADD A BOOK</Text>
      <Text style={styles.heading}>Scan the ISBN</Text>
      <Text style={styles.subtitle}>
        Book barcodes normally encode ISBN-13 as EAN-13. The ISBN is validated before anything is saved.
      </Text>

      <View style={styles.scannerCard}>
        {permission?.granted ? (
          <CameraView
            active={!busy}
            barcodeScannerSettings={{ barcodeTypes: ['ean13'] }}
            onBarcodeScanned={handleBarcode}
            style={styles.camera}
          >
            <View style={styles.cameraOverlay} pointerEvents="none">
              <View style={styles.scanFrame} />
              <Text style={styles.cameraHint}>Center the book barcode in the frame</Text>
            </View>
          </CameraView>
        ) : (
          <View style={styles.permissionBox}>
            <Text style={styles.emptyTitle}>Camera access</Text>
            <Text style={styles.emptyBody}>
              Camera permission is only used to read the ISBN barcode. Manual entry always remains available.
            </Text>
            {permission?.canAskAgain !== false ? (
              <Pressable
                onPress={() => void requestPermission()}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryButtonText}>Allow camera</Text>
              </Pressable>
            ) : (
              <Text style={styles.mutedSmall}>Camera permission is disabled in system settings.</Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.orRow}>
        <View style={styles.divider} />
        <Text style={styles.orText}>OR ENTER ISBN</Text>
        <View style={styles.divider} />
      </View>

      <View style={styles.manualRow}>
        <TextInput
          accessibilityLabel="ISBN"
          autoCapitalize="characters"
          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
          onChangeText={setManualIsbn}
          onSubmitEditing={() => void addByIsbn(manualIsbn)}
          placeholder="978-… or ISBN-10"
          placeholderTextColor="#7c817b"
          returnKeyType="search"
          style={styles.isbnInput}
          value={manualIsbn}
        />
        <Pressable
          disabled={busy}
          onPress={() => void addByIsbn(manualIsbn)}
          style={({ pressed }) => [styles.primaryButton, (pressed || busy) && styles.pressed]}
        >
          <Text style={styles.primaryButtonText}>{busy ? 'Finding…' : 'Add'}</Text>
        </Pressable>
      </View>

      {message ? <Text style={styles.lookupMessage}>{message}</Text> : null}
      <Text style={styles.attribution}>
        Saved books remain local. When online, Open Library is queried only to enrich book metadata.
      </Text>
    </ScrollView>
  );
}

function BookDetail({
  book,
  onBack,
  onChange,
  onDelete,
}: {
  book: LibraryBook;
  onBack: () => void;
  onChange: (book: LibraryBook) => void;
  onDelete: () => void;
}) {
  const update = (patch: Partial<LibraryBook>) =>
    onChange({ ...book, ...patch, updatedAt: new Date().toISOString() });

  const confirmDelete = () => {
    Alert.alert('Remove book?', 'Your notes and review for this book will also be removed from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <Text style={styles.backButtonText}>‹ Library</Text>
      </Pressable>

      <View style={styles.detailHeader}>
        <BookCover book={book} large />
        <View style={styles.detailHeaderCopy}>
          <Text style={styles.eyebrow}>BOOK DETAILS</Text>
          <TextInput
            accessibilityLabel="Book title"
            multiline
            onChangeText={(title) => update({ title })}
            style={styles.titleInput}
            value={book.title}
          />
          <TextInput
            accessibilityLabel="Authors"
            onChangeText={(value) =>
              update({
                authors: value
                  .split(',')
                  .map((author) => author.trim())
                  .filter(Boolean),
              })
            }
            placeholder="Author"
            placeholderTextColor="#7c817b"
            style={styles.authorInput}
            value={book.authors.join(', ')}
          />
          <Text style={styles.mutedSmall}>ISBN {book.isbn}</Text>
          {book.publisher || book.firstPublishedYear ? (
            <Text style={styles.mutedSmall}>
              {[book.publisher, book.firstPublishedYear].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>
      </View>

      <Text style={styles.sectionLabel}>READING STATUS</Text>
      <View style={styles.statusOptions}>
        {STATUS_OPTIONS.map((option) => {
          const selected = book.status === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => update({ status: option.value })}
              style={({ pressed }) => [
                styles.statusOption,
                selected && styles.statusOptionSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.statusOptionText, selected && styles.statusOptionTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {book.status === 'read' ? (
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Finished on</Text>
          <TextInput
            accessibilityLabel="Finished on"
            onChangeText={(finishedOn) => update({ finishedOn })}
            placeholder="YYYY-MM-DD (optional)"
            placeholderTextColor="#7c817b"
            style={styles.textInput}
            value={book.finishedOn}
          />
        </View>
      ) : null}

      <View style={styles.reflectionCard}>
        <Text style={styles.reflectionTitle}>Reading record</Text>
        <Text style={styles.reflectionIntro}>
          Keep private working notes separate from the review you would want to preserve as your considered view of the book.
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Notes</Text>
          <TextInput
            accessibilityLabel="Book notes"
            multiline
            onChangeText={(notes) => update({ notes })}
            placeholder="Questions, passages to revisit, loose thoughts…"
            placeholderTextColor="#7c817b"
            style={[styles.textInput, styles.multilineInput]}
            textAlignVertical="top"
            value={book.notes}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Review</Text>
          <TextInput
            accessibilityLabel="Book review"
            multiline
            onChangeText={(review) => update({ review })}
            placeholder="What is your considered assessment of the book?"
            placeholderTextColor="#7c817b"
            style={[styles.textInput, styles.reviewInput]}
            textAlignVertical="top"
            value={book.review}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Key ideas</Text>
          <TextInput
            accessibilityLabel="Key ideas"
            multiline
            onChangeText={(keyIdeas) => update({ keyIdeas })}
            placeholder="Arguments, concepts, or practical lessons…"
            placeholderTextColor="#7c817b"
            style={[styles.textInput, styles.multilineInput]}
            textAlignVertical="top"
            value={book.keyIdeas}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Why it mattered</Text>
          <TextInput
            accessibilityLabel="Why it mattered"
            multiline
            onChangeText={(meaning) => update({ meaning })}
            placeholder="What was meaningful, challenging, beautiful, or worth changing because of it?"
            placeholderTextColor="#7c817b"
            style={[styles.textInput, styles.multilineInput]}
            textAlignVertical="top"
            value={book.meaning}
          />
        </View>
      </View>

      <Pressable
        onPress={confirmDelete}
        style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
      >
        <Text style={styles.deleteButtonText}>Remove from library</Text>
      </Pressable>
    </ScrollView>
  );
}

export default function BooksApp() {
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<'library' | 'add'>('library');
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!active || !stored) {
          return;
        }

        const parsed = JSON.parse(stored) as unknown;
        if (Array.isArray(parsed)) {
          setBooks(
            (parsed as LibraryBook[]).map((book) => ({
              ...book,
              review: typeof book.review === 'string' ? book.review : '',
            })),
          );
        }
      })
      .catch(() => {
        // A broken local cache should not prevent the app from opening.
      })
      .finally(() => {
        if (active) {
          setHydrated(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const timer = setTimeout(() => {
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(books));
    }, 200);

    return () => clearTimeout(timer);
  }, [books, hydrated]);

  const selectedBook = books.find((book) => book.id === selectedBookId) ?? null;

  const updateBook = (next: LibraryBook) => {
    setBooks((current) => current.map((book) => (book.id === next.id ? next : book)));
  };

  const handleBookReady = (book: LibraryBook, alreadyExists: boolean) => {
    if (!alreadyExists) {
      setBooks((current) => [book, ...current]);
    }
    setSelectedBookId(book.id);
    setView('library');
  };

  const deleteSelected = () => {
    if (!selectedBookId) {
      return;
    }
    setBooks((current) => current.filter((book) => book.id !== selectedBookId));
    setSelectedBookId(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {selectedBook ? (
          <BookDetail
            book={selectedBook}
            onBack={() => setSelectedBookId(null)}
            onChange={updateBook}
            onDelete={deleteSelected}
          />
        ) : view === 'add' ? (
          <AddBookView
            books={books}
            onBack={() => setView('library')}
            onBookReady={handleBookReady}
          />
        ) : (
          <LibraryView
            books={books}
            onAdd={() => setView('add')}
            onSelect={setSelectedBookId}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#f5f3ed' },
  pageContent: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 56,
  },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  heroCopy: { flex: 1 },
  eyebrow: {
    color: '#687168',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  heading: { color: '#1e2720', fontSize: 36, fontWeight: '800', letterSpacing: -1.2 },
  subtitle: { color: '#59625b', fontSize: 16, lineHeight: 24, marginTop: 10, maxWidth: 560 },
  primaryButton: {
    backgroundColor: '#243c2b',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderColor: '#bbc3ba',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 16,
  },
  secondaryButtonText: { color: '#243c2b', fontWeight: '800' },
  pressed: { opacity: 0.68 },
  searchInput: {
    backgroundColor: '#ffffff',
    borderColor: '#dedfd8',
    borderWidth: 1,
    borderRadius: 16,
    color: '#1e2720',
    fontSize: 16,
    marginTop: 28,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  bookList: { gap: 12, marginTop: 18 },
  bookCard: {
    flexDirection: 'row',
    gap: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dedfd8',
    backgroundColor: '#faf9f5',
    padding: 12,
  },
  cover: { width: 64, height: 94, borderRadius: 10, backgroundColor: '#dfe4dc' },
  coverLarge: { width: 104, height: 154, borderRadius: 14, backgroundColor: '#dfe4dc' },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  coverFallbackText: { color: '#506053', fontSize: 28, fontWeight: '800' },
  bookCardBody: { flex: 1, paddingVertical: 3 },
  bookTitle: { color: '#1f2921', fontSize: 18, fontWeight: '800', lineHeight: 23 },
  bookAuthor: { color: '#687068', fontSize: 14, marginTop: 5 },
  bookMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 'auto' },
  statusBadge: {
    alignSelf: 'flex-start',
    color: '#31513a',
    backgroundColor: '#e2ebe1',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
  mutedSmall: { color: '#7a817a', fontSize: 12, lineHeight: 18 },
  emptyCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#dedfd8',
    backgroundColor: '#faf9f5',
    marginTop: 24,
    padding: 24,
  },
  emptyTitle: { color: '#243027', fontSize: 20, fontWeight: '800' },
  emptyBody: { color: '#626a63', fontSize: 15, lineHeight: 22, marginTop: 8 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 18 },
  backButtonText: { color: '#355540', fontWeight: '800', fontSize: 15 },
  scannerCard: {
    minHeight: 290,
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#d7d9d2',
    backgroundColor: '#1b211c',
    marginTop: 24,
  },
  camera: { height: 310, width: '100%' },
  cameraOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 26 },
  scanFrame: {
    width: '88%',
    height: 116,
    borderColor: '#ffffff',
    borderWidth: 2,
    borderRadius: 14,
  },
  cameraHint: {
    color: '#ffffff',
    backgroundColor: 'rgba(0,0,0,0.48)',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 18,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  permissionBox: {
    minHeight: 290,
    justifyContent: 'center',
    padding: 26,
    backgroundColor: '#faf9f5',
  },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 },
  divider: { height: 1, backgroundColor: '#d8dad4', flex: 1 },
  orText: { color: '#777d77', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  manualRow: { flexDirection: 'row', gap: 10 },
  isbnInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderColor: '#d7d9d2',
    borderWidth: 1,
    borderRadius: 15,
    color: '#1e2720',
    fontSize: 16,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  lookupMessage: { color: '#405b48', fontSize: 14, fontWeight: '700', marginTop: 12 },
  attribution: { color: '#818681', fontSize: 12, lineHeight: 18, marginTop: 18 },
  detailHeader: { flexDirection: 'row', gap: 18, marginBottom: 28 },
  detailHeaderCopy: { flex: 1 },
  titleInput: {
    color: '#1e2720',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    padding: 0,
    margin: 0,
  },
  authorInput: {
    color: '#59625b',
    fontSize: 15,
    paddingHorizontal: 0,
    paddingVertical: 8,
    marginTop: 2,
  },
  sectionLabel: { color: '#697069', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  statusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    marginBottom: 24,
  },
  statusOption: {
    borderColor: '#cdd1ca',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#faf9f5',
  },
  statusOptionSelected: { backgroundColor: '#243c2b', borderColor: '#243c2b' },
  statusOptionText: { color: '#4f5951', fontSize: 13, fontWeight: '700' },
  statusOptionTextSelected: { color: '#ffffff' },
  reflectionCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#dedfd8',
    backgroundColor: '#faf9f5',
    padding: 18,
    marginTop: 22,
  },
  reflectionTitle: { color: '#243027', fontSize: 20, fontWeight: '800' },
  reflectionIntro: { color: '#697069', lineHeight: 21, marginTop: 6, marginBottom: 2 },
  fieldGroup: { marginTop: 18 },
  fieldLabel: { color: '#3f4941', fontSize: 13, fontWeight: '800', marginBottom: 7 },
  textInput: {
    backgroundColor: '#ffffff',
    borderColor: '#d7d9d2',
    borderWidth: 1,
    borderRadius: 14,
    color: '#1e2720',
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  multilineInput: { minHeight: 112 },
  reviewInput: { minHeight: 160 },
  deleteButton: {
    alignSelf: 'flex-start',
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  deleteButtonText: { color: '#8c3838', fontSize: 14, fontWeight: '800' },
});
