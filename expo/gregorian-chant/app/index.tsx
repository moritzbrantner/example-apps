import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import GabcNotation from "../components/GabcNotation";
import { CHANTS } from "../lib/catalog";
import { searchChants } from "../lib/domain";
import { parseGabc } from "../lib/gabc";

export default function HomeScreen() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(CHANTS[0]?.id ?? "");
  const results = useMemo(() => searchChants(CHANTS, query), [query]);
  const selected = results.find((chant) => chant.id === selectedId) ?? results[0];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>Gregorian chant</Text>
          <Text style={styles.title}>Library and practice</Text>
          <Text style={styles.subtitle}>
            GABC is the notation source. Playback and analysis are adapters, not chant business logic.
          </Text>
        </View>

        <TextInput
          accessibilityLabel="Search chants"
          onChangeText={setQuery}
          placeholder="Search by incipit, text, mode, or use"
          style={styles.search}
          value={query}
        />

        <View style={styles.results}>
          {results.map((chant) => {
            const active = chant.id === selected?.id;
            return (
              <Pressable
                accessibilityRole="button"
                key={chant.id}
                onPress={() => setSelectedId(chant.id)}
                style={[styles.result, active && styles.resultActive]}
              >
                <Text style={styles.resultTitle}>{chant.title}</Text>
                <Text style={styles.meta}>
                  {chant.usage}{chant.mode ? ` · mode ${chant.mode}` : ""}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {selected ? <ChantReader chant={selected} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ChantReader({ chant }: { chant: (typeof CHANTS)[number] }) {
  const notation = chant.notation;
  const gabc = notation ? parseGabc(notation.source) : null;

  return (
    <View style={styles.reader}>
      <Text style={styles.incipit}>{chant.incipit}</Text>
      <Text style={styles.meta}>
        {chant.mode ? `Mode ${chant.mode} · ` : ""}{chant.sources[0]?.label}
      </Text>
      <Text style={styles.latin}>{chant.latinText}</Text>

      <Text style={styles.sectionTitle}>Phrases</Text>
      {chant.phrases.map((phrase) => (
        <View key={phrase.id} style={styles.phrase}>
          <Text style={styles.phraseText}>{phrase.latin}</Text>
          <Text style={styles.pending}>timing pending recording evidence</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Notation</Text>
      {notation && gabc ? (
        <View style={styles.notation}>
          <Text style={styles.notationLabel}>Rendered score · derived from canonical GABC</Text>
          <View style={styles.scoreFrame}>
            <GabcNotation
              dom={{ matchContents: true, scrollEnabled: false }}
              label={`${chant.title} Gregorian notation`}
              source={notation.source}
            />
          </View>
          <View style={styles.sourceBlock}>
            <Text style={styles.sourceLabel}>Canonical GABC source</Text>
            <Text selectable style={styles.gabc}>{notation.source}</Text>
          </View>
        </View>
      ) : (
        <Text style={styles.pending}>GABC has not been ingested for this catalog entry yet.</Text>
      )}

      <Text style={styles.sectionTitle}>Practice audio</Text>
      <Text style={styles.body}>
        The first slice deliberately does not invent phrase timings or duplicate a player. A recording adapter will bind local audio to these phrase IDs; media-player owns transport behavior and audio-analysis owns signal analysis.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f7f4ed" },
  content: { padding: 20, paddingBottom: 48, gap: 18, maxWidth: 840, width: "100%", alignSelf: "center" },
  heading: { gap: 5 },
  eyebrow: { textTransform: "uppercase", letterSpacing: 1.4, fontSize: 12, fontWeight: "700", color: "#665d4d" },
  title: { fontSize: 32, lineHeight: 38, fontWeight: "700", color: "#201d18" },
  subtitle: { fontSize: 16, lineHeight: 23, color: "#5f594f" },
  search: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#d7d0c2", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  results: { gap: 8 },
  result: { borderWidth: 1, borderColor: "#d7d0c2", borderRadius: 10, padding: 13, backgroundColor: "#fff" },
  resultActive: { borderColor: "#5a5142", backgroundColor: "#eee8dc" },
  resultTitle: { fontSize: 17, fontWeight: "700", color: "#201d18" },
  meta: { marginTop: 3, fontSize: 13, color: "#6a6358" },
  reader: { gap: 13, marginTop: 4 },
  incipit: { fontSize: 27, fontWeight: "700", color: "#201d18" },
  latin: { fontSize: 19, lineHeight: 29, color: "#29251f" },
  sectionTitle: { marginTop: 7, fontSize: 16, fontWeight: "700", color: "#383229" },
  phrase: { borderLeftWidth: 3, borderLeftColor: "#918673", paddingLeft: 11, paddingVertical: 4 },
  phraseText: { fontSize: 16, color: "#29251f" },
  pending: { marginTop: 2, fontSize: 13, color: "#766d60", fontStyle: "italic" },
  notation: { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#d7d0c2", padding: 14, gap: 12, overflow: "hidden" },
  notationLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: "#6a6358" },
  scoreFrame: { width: "100%", minHeight: 136, overflow: "hidden" },
  sourceBlock: { borderTopWidth: 1, borderTopColor: "#e7e1d7", paddingTop: 12, gap: 8 },
  sourceLabel: { fontSize: 12, fontWeight: "700", color: "#6a6358" },
  gabc: { fontFamily: "monospace", fontSize: 12, lineHeight: 18, color: "#4b443a" },
  body: { fontSize: 15, lineHeight: 22, color: "#5f594f" },
});
