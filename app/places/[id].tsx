import { Ionicons } from "@expo/vector-icons";
import { Session } from "@supabase/supabase-js";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList, // Re-added for use in the modal
  Linking,
  Modal,
  Pressable, // Re-added for use in the modal
  StyleSheet,
  Text,
  TouchableOpacity,
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

// Type definitions are unchanged
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
  nearby_station: string | null;
};
type UserList = { id: number; name: string };

const IMG_HEIGHT = 300;

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <View style={styles.detailRowContainer}>
      <Ionicons name={icon} size={20} color="#555" style={styles.detailIcon} />
      <View style={styles.detailTextContainer}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

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

  // Data fetching logic is unchanged
  useEffect(() => {
    const numericId = id && !Array.isArray(id) ? parseInt(id, 10) : null;
    if (!numericId) return;

    const fetchPlaceDetails = async () => {
      const { data, error } = await supabase
        .from("places")
        .select(`*, tags (id, name)`)
        .eq("id", numericId)
        .single();
      if (error) console.error("Error fetching place:", error);
      else setPlace(data as Place);
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

  // "Add to List" logic is now correctly used by the modal
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
      {/* --- FIX: The modal content is now restored --- */}
      <Modal
        visible={isModalVisible}
        onRequestClose={() => setModalVisible(false)}
        transparent={true}
        animationType="slide"
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

      {session && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add-outline" size={32} color="white" />
          <Text style={styles.fabText}>Add to List</Text>
        </TouchableOpacity>
      )}

      <Animated.ScrollView
        ref={scrollRef}
        scrollEventThrottle={16}
        onScroll={scrollHandler}
        contentContainerStyle={{ paddingBottom: 100 }}
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
          <View style={styles.headerOverlay} />
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>{place.name}</Text>
            <Text style={styles.headerSubtitle}>{place.neighborhood}</Text>
          </View>
        </Animated.View>

        <View style={styles.contentContainer}>
          <View style={styles.pillsContainer}>
            {place.tags?.map((tag) => (
              <Text key={tag.id} style={styles.pill}>
                {tag.name}
              </Text>
            ))}
          </View>

          {/* --- FIX: The feedback message is now rendered --- */}
          {feedbackMessage ? (
            <Text style={styles.feedbackText}>{feedbackMessage}</Text>
          ) : null}

          <View style={styles.detailsSection}>
            <DetailRow
              icon="navigate-circle-outline"
              label="Nearby Station"
              value={place.nearby_station}
            />
            <DetailRow
              icon="cash-outline"
              label="Budget"
              value={place.budget_level}
            />
            <DetailRow
              icon="document-text-outline"
              label="Description"
              value={place.description}
            />
            {place.notes && (
              <DetailRow
                icon="bulb-outline"
                label="Notes"
                value={place.notes}
              />
            )}
            {place.is_rain_friendly && (
              <DetailRow
                icon="rainy-outline"
                label="Rain-friendly"
                value="This spot is a good option on a rainy day."
              />
            )}
          </View>

          <View style={styles.buttonSection}>
            {place.google_maps_link && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => Linking.openURL(place.google_maps_link)}
              >
                <Ionicons name="map-outline" size={20} color="#6366F1" />
                <Text style={styles.actionButtonText}>Open in Google Maps</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="create-outline" size={20} color="#6366F1" />
              <Text style={styles.actionButtonText}>
                Suggest Edit / Correction
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

// Styles are unchanged
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f8f8" },
  loader: { flex: 1, justifyContent: "center" },
  header: { height: IMG_HEIGHT, overflow: "hidden", backgroundColor: "#ccc" },
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
  headerOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(0,0,0,0)",
    backgroundImage:
      "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 100%)",
  },
  headerTextContainer: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "white",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  headerSubtitle: {
    fontSize: 18,
    color: "white",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  contentContainer: { paddingVertical: 24, backgroundColor: "#f8f8f8" },
  pillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  pill: {
    backgroundColor: "#e0e7ff",
    color: "#4f46e5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "500",
    overflow: "hidden",
  },
  detailsSection: {
    paddingHorizontal: 24,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
  },
  detailRowContainer: {
    flexDirection: "row",
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    alignItems: "flex-start",
  },
  detailIcon: {
    marginRight: 16,
    marginTop: 2,
  },
  detailTextContainer: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 4,
    fontWeight: "600",
  },
  detailValue: {
    fontSize: 16,
    color: "#111827",
    lineHeight: 24,
  },
  buttonSection: {
    marginTop: 24,
    paddingHorizontal: 24,
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6366F1",
    marginLeft: 12,
  },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 30,
    backgroundColor: "#6366F1",
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  fabText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  feedbackText: {
    textAlign: "center",
    color: "green",
    marginBottom: 20,
    fontSize: 16,
    paddingHorizontal: 24,
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
