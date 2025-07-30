import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

  const [originalPlaces, setOriginalPlaces] = useState<Place[]>([]);
  const [editingPlaces, setEditingPlaces] = useState<Place[]>([]);

  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const listName = Array.isArray(name) ? name[0] : name;
  const listId = Array.isArray(id)
    ? parseInt(id[0], 10)
    : parseInt(id as string, 10);

  const handleEnterEditMode = useCallback(() => {
    setEditingPlaces([...originalPlaces]);
    setIsEditing(true);
  }, [originalPlaces]);

  const handleCancelEdits = useCallback(() => {
    setEditingPlaces([...originalPlaces]);
    setIsEditing(false);
  }, [originalPlaces]);

  const handleSaveChanges = useCallback(async () => {
    const originalIds = new Set(originalPlaces.map((p) => p.id));
    const editedIds = new Set(editingPlaces.map((p) => p.id));

    const idsToRemove = [...originalIds].filter((id) => !editedIds.has(id));

    if (idsToRemove.length === 0) {
      setIsEditing(false);
      return;
    }

    const { error } = await supabase
      .from("list_places")
      .delete()
      .eq("list_id", listId)
      .in("place_id", idsToRemove);

    if (error) {
      console.error("Error saving changes:", error);
      Alert.alert("Error", "Could not save changes. Please try again.");
    } else {
      setOriginalPlaces([...editingPlaces]);
    }
    setIsEditing(false);
  }, [originalPlaces, editingPlaces, listId]);

  // --- UPDATED: Header now only shows the pencil icon when NOT editing ---
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => {
        if (!isEditing) {
          return (
            <TouchableOpacity
              style={styles.headerIconContainer}
              onPress={handleEnterEditMode}
            >
              <Ionicons name="pencil" size={24} color="#6366F1" />
            </TouchableOpacity>
          );
        }
        // Return null to hide buttons when editing
        return null;
      },
    });
  }, [navigation, isEditing, handleEnterEditMode]);

  useEffect(() => {
    if (isNaN(listId)) return;
    const fetchListPlaces = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("list_places")
        .select(`places (*, categories (id, name))`)
        .eq("list_id", listId);
      if (error) {
        console.error("Error fetching list places:", error);
      } else {
        const fetchedPlaces = data
          .map((item: any) => item.places)
          .filter(Boolean);
        setOriginalPlaces(fetchedPlaces);
        setEditingPlaces(fetchedPlaces);
      }
      setLoading(false);
    };
    fetchListPlaces();
  }, [listId]);

  const handleRemovePlace = (placeId: number) => {
    setEditingPlaces(editingPlaces.filter((p) => p.id !== placeId));
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
        data={isEditing ? editingPlaces : originalPlaces}
        renderItem={renderGridItem}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        contentContainerStyle={isEditing ? { paddingBottom: 100 } : null} // Add padding when editing
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            This list is empty. Add some places!
          </Text>
        }
      />

      {/* --- NEW: Sticky footer bar for edit mode --- */}
      {isEditing && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.footerButton, styles.cancelButton]}
            onPress={handleCancelEdits}
          >
            <Text style={[styles.footerButtonText, styles.cancelButtonText]}>
              Cancel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.footerButton, styles.saveButton]}
            onPress={handleSaveChanges}
          >
            <Text style={[styles.footerButtonText, styles.saveButtonText]}>
              Save Changes
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    width: "50%",
    padding: 8,
  },
  removeIcon: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "white",
    borderRadius: 15,
  },
  // --- NEW: Styles for the sticky footer ---
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    paddingBottom: 30, // Extra padding for home bar
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  footerButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
    marginRight: 10,
  },
  saveButton: {
    backgroundColor: "#6366F1",
    marginLeft: 10,
  },
  footerButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  cancelButtonText: {
    color: "#333",
  },
  saveButtonText: {
    color: "white",
  },
});
