import { Link } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  TextInput, // 1. Import TextInput
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";

type City = {
  id: number;
  name: string;
  country: string; // Also good to have for display or filtering
  image_url: string | null;
};

function CityListItem({ city }: { city: City }) {
  return (
    <Link
      href={{
        pathname: "/city/[id]",
        params: { id: city.id, name: city.name },
      }}
      asChild
    >
      <Pressable style={styles.card}>
        <ImageBackground
          source={{ uri: city.image_url || undefined }}
          style={styles.image}
          imageStyle={{ borderRadius: 10 }}
        >
          <View style={styles.overlay}>
            <Text style={styles.cardText}>{city.name}</Text>
            <Text style={styles.cardSubText}>{city.country}</Text>
          </View>
        </ImageBackground>
      </Pressable>
    </Link>
  );
}

export default function HomeScreen() {
  const [allCities, setAllCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  // 2. Add state for the search query
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchCities = async () => {
      setLoading(true);
      // Let's also select the 'country' field
      const { data, error } = await supabase
        .from("cities")
        .select("id, name, country, image_url");

      if (error) {
        console.error(error);
      } else {
        setAllCities(data);
      }
      setLoading(false);
    };

    fetchCities();
  }, []);

  // 3. Filter cities based on the search query
  const filteredCities = useMemo(() => {
    if (!searchQuery) {
      return allCities;
    }
    return allCities.filter((city) =>
      city.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allCities, searchQuery]);

  if (loading) {
    return <ActivityIndicator size="large" style={styles.loader} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Where to next?</Text>

      {/* 4. Add the TextInput for the search bar */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search by city name..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholderTextColor="#888"
      />

      {/* 5. Update FlatList to use 'filteredCities' */}
      <FlatList
        data={filteredCities}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => <CityListItem city={item} />}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        ListEmptyComponent={() => (
          <Text style={styles.emptyText}>No cities found.</Text>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    backgroundColor: "#f8f8f8",
  },
  loader: {
    flex: 1,
    justifyContent: "center",
  },
  header: {
    fontSize: 28,
    fontWeight: "bold",
    paddingHorizontal: 16,
    marginBottom: 10, // Reduced margin
  },
  // New style for the search input
  searchInput: {
    height: 50,
    borderColor: "#E0E0E0",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: "white",
    fontSize: 16,
  },
  card: {
    height: 150,
    marginVertical: 8,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  image: {
    flex: 1,
    justifyContent: "flex-end", // Aligns content to the bottom
  },
  overlay: {
    backgroundColor: "rgba(0,0,0,0.4)",
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    padding: 12,
  },
  cardText: {
    fontSize: 22,
    fontWeight: "600",
    color: "white",
  },
  // New style for the country subtext
  cardSubText: {
    fontSize: 14,
    color: "white",
    opacity: 0.9,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 16,
    color: "#666",
  },
});
