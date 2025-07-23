import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import PlaceCard from "../../components/PlaceCard";
import { supabase } from "../../lib/supabase";

// Type definitions remain the same
type Place = {
  id: number;
  name: string;
  neighborhood: string;
  image_urls: string[] | null;
  categories: {
    id: number;
    name: string;
  } | null;
};
type Category = {
  id: number;
  name: string;
};

export default function CityPlacesScreen() {
  // All state, effects, and filtering logic remain the same
  const { id, name } = useLocalSearchParams();
  const [allPlaces, setAllPlaces] = useState<Place[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");

  const cityName = Array.isArray(name) ? name[0] : name;

  useEffect(() => {
    if (!id || Array.isArray(id)) return;
    const numericCityId = parseInt(id, 10);
    const fetchData = async () => {
      setLoading(true);
      const { data: placesData, error: placesError } = await supabase
        .from("places")
        .select(
          `id, name, neighborhood, image_urls, categories!inner(id, name)`
        )
        .eq("city_id", numericCityId)
        .eq("status", "published")
        .order("name", { ascending: true });
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select("id, name");
      if (placesError) console.error("Error fetching places:", placesError);
      else setAllPlaces(placesData as any);
      if (categoriesError)
        console.error("Error fetching categories:", categoriesError);
      else if (categoriesData)
        setCategories([{ id: 0, name: "All" }, ...categoriesData]);
      setLoading(false);
    };
    fetchData();
  }, [id]);

  const filteredPlaces = useMemo(() => {
    let placesToFilter = allPlaces;
    if (selectedCategory !== 0) {
      placesToFilter = placesToFilter.filter(
        (place) => place.categories?.id === selectedCategory
      );
    }
    if (searchQuery) {
      placesToFilter = placesToFilter.filter((place) =>
        place.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return placesToFilter;
  }, [allPlaces, selectedCategory, searchQuery]);

  // 1. We add the same render function from the other screen
  const renderGridItem = ({ item }: { item: Place }) => (
    <View style={styles.gridItemContainer}>
      <PlaceCard place={item} />
    </View>
  );

  if (loading) {
    return (
      <ActivityIndicator
        size="large"
        style={{ flex: 1, justifyContent: "center" }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{ title: cityName || "Places", headerBackTitle: "Cities" }}
      />
      <Text style={styles.header}>{cityName || "Places"}</Text>
      <TextInput
        style={styles.searchInput}
        placeholder="Search for a place..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholderTextColor="#888"
      />
      <View>
        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <Pressable
              style={
                selectedCategory === item.id ? styles.pillActive : styles.pill
              }
              onPress={() => setSelectedCategory(item.id)}
            >
              <Text
                style={
                  selectedCategory === item.id
                    ? styles.pillTextActive
                    : styles.pillText
                }
              >
                {item.name}
              </Text>
            </Pressable>
          )}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 10 }}
        />
      </View>
      <FlatList
        data={filteredPlaces}
        renderItem={renderGridItem} // 2. Use the new render function
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        ListEmptyComponent={() => (
          <Text style={styles.emptyText}>
            No places found. Try a different search or category.
          </Text>
        )}
      />
    </SafeAreaView>
  );
}

// 3. The styles are updated to match the robust grid system
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f8f8",
    paddingHorizontal: 8, // Add main horizontal padding
  },
  header: {
    fontSize: 28,
    fontWeight: "bold",
    paddingHorizontal: 8, // Align with new container padding
    paddingTop: 10,
    paddingBottom: 10,
  },
  searchInput: {
    height: 50,
    borderColor: "#E0E0E0",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginHorizontal: 8, // Adjust to align with new container padding
    marginBottom: 10,
    backgroundColor: "white",
    fontSize: 16,
  },
  pill: {
    backgroundColor: "white",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#eee",
  },
  pillActive: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#6366F1",
  },
  pillText: {
    color: "black",
  },
  pillTextActive: {
    color: "white",
    fontWeight: "bold",
  },
  emptyText: {
    textAlign: "center",
    marginTop: 50,
    fontSize: 16,
    color: "#666",
    paddingHorizontal: 20,
  },
  // New style for grid item spacing
  gridItemContainer: {
    width: "50%", // This forces a fixed width for each item
    padding: 8,
  },
});
