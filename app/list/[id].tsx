import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import PlaceCard from "../../components/PlaceCard";
import { supabase } from "../../lib/supabase";

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

export default function ListDetailScreen() {
  const { id, name } = useLocalSearchParams();
  const navigation = useNavigation();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const listName = Array.isArray(name) ? name[0] : name;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerIconContainer}
          onPress={() => setIsEditing(!isEditing)}
        >
          <Ionicons
            name={isEditing ? "checkmark-done-sharp" : "pencil"}
            size={24}
            color="#6366F1"
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, isEditing]);

  useEffect(() => {
    if (!id) return;
    const listId = Array.isArray(id) ? parseInt(id[0], 10) : parseInt(id, 10);
    if (isNaN(listId)) return;
    const fetchListPlaces = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("list_places")
        .select(`places (*, categories (id, name))`)
        .eq("list_id", listId);
      if (error) console.error("Error fetching list places:", error);
      else {
        const fetchedPlaces = data.map((item: any) => item.places);
        setPlaces(fetchedPlaces.filter(Boolean));
      }
      setLoading(false);
    };
    fetchListPlaces();
  }, [id]);

  const handleRemovePlace = async (placeId: number) => {
    const listId = Array.isArray(id) ? parseInt(id[0], 10) : parseInt(id!, 10);
    if (isNaN(listId)) return;
    setPlaces(places.filter((p) => p.id !== placeId));
    const { error } = await supabase
      .from("list_places")
      .delete()
      .eq("list_id", listId)
      .eq("place_id", placeId);
    if (error) console.error("Error removing place:", error);
  };

  const renderGridItem = ({ item }: { item: Place }) => (
    <View style={styles.gridItemContainer}>
      <PlaceCard place={item} disabled={isEditing} />
      {isEditing && (
        <TouchableOpacity
          style={styles.removeIcon}
          onPress={() => handleRemovePlace(item.id)}
        >
          <Ionicons name="remove-circle" size={30} color="#FF3B30" />
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return <ActivityIndicator size="large" style={styles.loader} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{ title: listName || "List", headerBackTitle: "Lists" }}
      />
      <Text style={styles.header}>{listName || "List"}</Text>
      <FlatList
        data={places}
        renderItem={renderGridItem}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        ListEmptyComponent={() => (
          <Text style={styles.emptyText}>
            This list is empty. Add some places!
          </Text>
        )}
      />
    </SafeAreaView> // --- THIS CLOSING TAG WAS MISSING ---
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f8f8",
    paddingHorizontal: 8,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
  },
  header: {
    fontSize: 28,
    fontWeight: "bold",
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 10,
  },
  headerIconContainer: {
    marginRight: 15,
    padding: 5,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 50,
    fontSize: 16,
    color: "#666",
  },
  gridItemContainer: {
    flex: 1,
    padding: 8,
  },
  removeIcon: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "white",
    borderRadius: 15,
  },
});
