import { Stack, useLocalSearchParams } from "expo-router";
import { FlatList, SafeAreaView, StyleSheet, Text, View } from "react-native";
import PlaceCard from "../components/PlaceCard";

// Define the Place type to match what we expect from navigation
type Place = {
  id: number;
  name: string;
  neighborhood: string;
  image_urls: string[] | null;
  categories: { name: string } | null;
};

export default function AiResultsScreen() {
  const { results } = useLocalSearchParams();

  // Parse the results string back into an array of Place objects
  const places: Place[] = results ? JSON.parse(results as string) : [];

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{ title: "AI Suggestions", headerBackTitle: "Assistant" }}
      />
      <FlatList
        data={places}
        renderItem={({ item }) => (
          <View style={styles.gridItemContainer}>
            <PlaceCard place={item} />
          </View>
        )}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        contentContainerStyle={{ paddingHorizontal: 8 }}
        ListHeaderComponent={() => (
          <Text style={styles.header}>Your AI-Powered Suggestions</Text>
        )}
        ListEmptyComponent={() => (
          <Text style={styles.emptyText}>
            The AI could not find any matches. Try a different search!
          </Text>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    fontSize: 22,
    fontWeight: "bold",
    padding: 16,
  },
  gridItemContainer: {
    width: "50%",
    padding: 8,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 50,
    fontSize: 16,
    color: "#666",
  },
});
