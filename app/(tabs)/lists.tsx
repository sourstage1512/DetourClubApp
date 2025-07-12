import { Session } from "@supabase/supabase-js";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Button,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SwipeListView } from "react-native-swipe-list-view";
import { supabase } from "../../lib/supabase";

type UserList = {
  id: number;
  name: string;
  description: string;
  user_id: string;
};

export default function ListsScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [lists, setLists] = useState<UserList[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setModalVisible] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDescription, setNewListDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const fetchSessionAndLists = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
      if (session) {
        await fetchLists(session.user.id);
      } else {
        setLoading(false);
      }
    };
    fetchSessionAndLists();
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session) {
          fetchLists(session.user.id);
        } else {
          setLists([]);
        }
      }
    );
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchLists = async (userId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_lists")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) console.error("Error fetching lists:", error);
    else setLists(data);
    setLoading(false);
  };

  const handleCreateList = async () => {
    if (!newListName || !session?.user) return;
    setIsCreating(true);
    const { data, error } = await supabase
      .from("user_lists")
      .insert({
        name: newListName,
        description: newListDescription,
        user_id: session.user.id,
      })
      .select()
      .single();
    if (error) {
      console.error("Error creating list:", error.message);
    } else if (data) {
      setLists([data, ...lists]);
      setModalVisible(false);
      setNewListName("");
      setNewListDescription("");
    }
    setIsCreating(false);
  };

  const handleDeleteList = async (listId: number) => {
    const updatedLists = lists.filter((list) => list.id !== listId);
    setLists(updatedLists);

    const { error } = await supabase
      .from("user_lists")
      .delete()
      .eq("id", listId);

    if (error) {
      console.error("Error deleting list:", error);
      setLists(lists);
    }
  };

  const renderHiddenItem = (data: { item: UserList }) => (
    <View style={styles.rowBack}>
      <TouchableOpacity
        style={[styles.backRightBtn, styles.backRightBtnRight]}
        onPress={() => handleDeleteList(data.item.id)}
      >
        <Text style={styles.backTextWhite}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  const renderListItem = (data: { item: UserList }) => (
    <Link
      href={{
        pathname: "/list/[id]",
        params: { id: data.item.id, name: data.item.name },
      }}
      asChild
    >
      <Pressable style={styles.card}>
        <Text style={styles.cardTitle}>{data.item.name}</Text>
        <Text style={styles.cardDescription}>{data.item.description}</Text>
      </Pressable>
    </Link>
  );

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" />;
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.loggedOutContainer}>
        <Text style={styles.loggedOutTitle}>View Your Lists</Text>
        <Text style={styles.loggedOutText}>
          Please sign in on the Profile tab to create and view your personal
          lists.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* --- THIS IS THE MISSING PART THAT HAS BEEN RESTORED --- */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Create a New List</Text>
            <TextInput
              style={styles.input}
              placeholder="List Name (e.g., Bangkok Trip)"
              value={newListName}
              onChangeText={setNewListName}
            />
            <TextInput
              style={styles.input}
              placeholder="Description (optional)"
              value={newListDescription}
              onChangeText={setNewListDescription}
            />
            <View style={styles.modalButtonContainer}>
              <Button
                title="Cancel"
                onPress={() => setModalVisible(false)}
                color="gray"
              />
              <Button
                title={isCreating ? "Creating..." : "Create"}
                onPress={handleCreateList}
                disabled={isCreating}
              />
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.headerContainer}>
        <Text style={styles.header}>My Lists</Text>
        <Pressable
          style={styles.createButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.createButtonText}>+ Create</Text>
        </Pressable>
      </View>

      <SwipeListView
        data={lists}
        renderItem={renderListItem}
        renderHiddenItem={renderHiddenItem}
        rightOpenValue={-75}
        keyExtractor={(item) => item.id.toString()}
        disableRightSwipe
        contentContainerStyle={{ paddingHorizontal: 16 }}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              You have not created any lists yet.
            </Text>
            <Text style={styles.emptySubText}>
              Tap + Create to get started.
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

// Styles are unchanged
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f8f8" },
  loader: { flex: 1, justifyContent: "center" },
  loggedOutContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loggedOutTitle: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  loggedOutText: { fontSize: 16, textAlign: "center", color: "#666" },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
  },
  header: { fontSize: 28, fontWeight: "bold" },
  createButton: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createButtonText: { color: "white", fontWeight: "bold", fontSize: 16 },
  card: {
    backgroundColor: "white",
    padding: 20,
    marginVertical: 8,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  cardTitle: { fontSize: 18, fontWeight: "600" },
  cardDescription: { fontSize: 14, color: "#555", marginTop: 4 },
  emptyContainer: { alignItems: "center", marginTop: 50 },
  emptyText: { textAlign: "center", fontSize: 16, color: "#666" },
  emptySubText: {
    textAlign: "center",
    fontSize: 14,
    color: "#888",
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalView: {
    width: "90%",
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 15 },
  input: {
    width: "100%",
    height: 50,
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: 10,
  },
  rowBack: {
    alignItems: "center",
    backgroundColor: "#FF3B30",
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingLeft: 15,
    marginVertical: 8,
    borderRadius: 10,
  },
  backRightBtn: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    position: "absolute",
    top: 0,
    width: 75,
  },
  backRightBtnRight: {
    backgroundColor: "#FF3B30",
    right: 0,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  backTextWhite: {
    color: "#FFF",
    fontWeight: "600",
  },
});
