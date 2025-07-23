import { Ionicons } from "@expo/vector-icons";
import { Session } from "@supabase/supabase-js";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity, // Correctly imported
  View,
} from "react-native";
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { supabase } from "../../lib/supabase";

// Type definitions
type Place = {
  id: number;
  name: string;
  neighborhood: string;
  description: string;
  is_rain_friendly: boolean;
  budget_level: string;
  google_maps_link: string;
  notes: string;
  image_urls: string[] | null;
  tags: { id: number; name: string }[] | null;
};
type UserList = { id: number; name: string };

const IMG_HEIGHT = 300;

export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams();
  const [place, setPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [userLists, setUserLists] = useState<UserList[]>([]);
  const [isModalVisible, setModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const imageAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollY.value,
            [-IMG_HEIGHT, 0, IMG_HEIGHT],
            [-IMG_HEIGHT / 2, 0, IMG_HEIGHT * 0.75]
          ),
        },
        {
          scale: interpolate(
            scrollY.value,
            [-IMG_HEIGHT, 0, IMG_HEIGHT],
            [2, 1, 1]
          ),
        },
      ],
    };
  });

  useEffect(() => {
    const numericId = id && !Array.isArray(id) ? parseInt(id, 10) : null;
    if (!numericId) return;

    const fetchPlaceDetails = async () => {
      const { data, error } = await supabase
        .from("places")
        .select(`*, tags ( id, name )`)
        .eq("id", numericId)
        .single();
      if (error) console.error("Error fetching place:", error);
      else setPlace(data);
    };
    const fetchUserAndLists = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
      if (session) {
        const { data, error } = await supabase
          .from("user_lists")
          .select("id, name")
          .eq("user_id", session.user.id);
        if (error) console.error("Error fetching lists:", error);
        else setUserLists(data || []);
      }
    };

    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchPlaceDetails(), fetchUserAndLists()]);
      setLoading(false);
    };
    loadData();
  }, [id]);

  const handleAddToList = async (listId: number) => {
    if (!place || isSaving) return;
    setIsSaving(true);
    const { error } = await supabase
      .from("list_places")
      .insert({ list_id: listId, place_id: place.id });
    if (error && error.code === "23505") {
      setFeedbackMessage("This place is already in the list.");
    } else if (error) {
      setFeedbackMessage("Error: Could not add to list.");
      console.error(error);
    } else {
      setFeedbackMessage(`Added to list successfully!`);
    }
    setIsSaving(false);
    setModalVisible(false);
    setTimeout(() => setFeedbackMessage(""), 3000);
  };

  if (loading) {
    return <ActivityIndicator size="large" style={styles.loader} />;
  }
  if (!place) {
    return (
      <View style={styles.container}>
        <Text>Place not found.</Text>
      </View>
    );
  }

  const headerImageUrl =
    place.image_urls && place.image_urls.length > 0
      ? place.image_urls[0]
      : null;

  return (
    <View style={styles.container}>
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalContainer}
          onPress={() => setModalVisible(false)}
        >
          <Pressable style={styles.modalView}>
            <Text style={styles.modalTitle}>Add to a list</Text>
            <FlatList
              data={userLists}
              keyExtractor={(item) => item.id.toString()}
              style={{ width: "100%" }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.listItem}
                  onPress={() => handleAddToList(item.id)}
                >
                  <Ionicons name="list-outline" size={24} color="#555" />
                  <Text style={styles.listItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyListText}>
                  You have not created any lists yet.
                </Text>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Stack.Screen
        options={{
          headerTransparent: true,
          headerTitle: "",
          headerTintColor: "white",
        }}
      />
      <Animated.ScrollView
        ref={scrollRef}
        scrollEventThrottle={16}
        onScroll={scrollHandler}
      >
        <Animated.View style={[styles.header, imageAnimatedStyle]}>
          {headerImageUrl ? (
            <Animated.Image
              source={{ uri: headerImageUrl }}
              style={styles.headerImage}
            />
          ) : (
            <View style={styles.headerImagePlaceholder}>
              <Text style={styles.headerImagePlaceholderText}>
                {place.name}
              </Text>
            </View>
          )}
        </Animated.View>
        <View style={styles.contentContainer}>
          <Text style={styles.title}>{place.name}</Text>
          <Text style={styles.details}>Neighborhood: {place.neighborhood}</Text>
          <View style={styles.pillsContainer}>
            {place.budget_level && (
              <Text style={styles.pill}>{place.budget_level}</Text>
            )}
            {place.is_rain_friendly && (
              <Text style={styles.pill}>🌧️ Rain Friendly</Text>
            )}
            {place.tags?.map((tag) => (
              <Text key={tag.id} style={styles.pill}>
                {tag.name}
              </Text>
            ))}
          </View>
          {session && (
            <Pressable
              style={styles.addToListButton}
              onPress={() => setModalVisible(true)}
            >
              <Text style={styles.addToListButtonText}>+ Add to List</Text>
            </Pressable>
          )}
          {feedbackMessage ? (
            <Text style={styles.feedbackText}>{feedbackMessage}</Text>
          ) : null}
          <Text style={styles.description}>{place.description}</Text>
          {place.notes && (
            <Text style={styles.notes}>💡 Note: {place.notes}</Text>
          )}
          {place.google_maps_link && (
            <Pressable onPress={() => Linking.openURL(place.google_maps_link)}>
              <Text style={styles.linkText}>Open in Google Maps</Text>
            </Pressable>
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  loader: { flex: 1, justifyContent: "center" },
  header: { height: IMG_HEIGHT, overflow: "hidden" },
  headerImage: { width: "100%", height: IMG_HEIGHT },
  headerImagePlaceholder: {
    width: "100%",
    height: IMG_HEIGHT,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
  },
  headerImagePlaceholderText: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
  },
  contentContainer: { padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 10 },
  details: { fontSize: 16, color: "#555", marginBottom: 5 },
  pillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
    marginBottom: 20,
  },
  pill: {
    backgroundColor: "#eee",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginRight: 10,
    marginBottom: 10,
    fontSize: 14,
    overflow: "hidden",
  },
  addToListButton: {
    backgroundColor: "#6366F1",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
  },
  addToListButtonText: { color: "white", fontWeight: "bold", fontSize: 18 },
  feedbackText: {
    textAlign: "center",
    color: "green",
    marginBottom: 20,
    fontSize: 16,
  },
  description: { fontSize: 16, marginTop: 10, lineHeight: 24 },
  notes: {
    fontSize: 16,
    marginTop: 20,
    fontStyle: "italic",
    color: "#333",
    backgroundColor: "#f8f8f8",
    padding: 10,
    borderRadius: 5,
  },
  linkText: {
    fontSize: 16,
    color: "#2e78b7",
    marginTop: 20,
    textAlign: "center",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalView: {
    width: "100%",
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 25 },
  listItem: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  listItemText: { fontSize: 18, marginLeft: 15 },
  emptyListText: { textAlign: "center", color: "#888", marginVertical: 20 },
});
