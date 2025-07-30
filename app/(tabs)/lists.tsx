import { Session } from "@supabase/supabase-js";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

type UserList = {
  id: number;
  name: string;
  description: string;
  user_id: string;
};

export default function ListsScreen() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [lists, setLists] = useState<UserList[]>([]);
  const [loading, setLoading] = useState(true);

  const [isCreateModalVisible, setCreateModalVisible] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDescription, setNewListDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [isActionSheetVisible, setActionSheetVisible] = useState(false);
  const [isRenameModalVisible, setRenameModalVisible] = useState(false);
  const [selectedList, setSelectedList] = useState<UserList | null>(null);
  const [editingListName, setEditingListName] = useState("");
  const [editingListDescription, setEditingListDescription] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

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
    else setLists(data as UserList[]);
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
      setCreateModalVisible(false);
      setNewListName("");
      setNewListDescription("");
    }
    setIsCreating(false);
  };

  const handleLongPress = (list: UserList) => {
    setSelectedList(list);
    setEditingListName(list.name);
    setEditingListDescription(list.description);
    setActionSheetVisible(true);
  };

  const handleRenamePress = () => {
    setActionSheetVisible(false);
    setRenameModalVisible(true);
  };

  // --- THIS IS THE CORRECTED FUNCTION ---
  const handleUpdateList = async () => {
    if (!editingListName || !selectedList) return;
    setIsUpdating(true);

    // Perform the update without asking for the data back
    const { error } = await supabase
      .from("user_lists")
      .update({ name: editingListName, description: editingListDescription })
      .eq("id", selectedList.id);

    if (error) {
      console.error("Error updating list:", error.message);
      Alert.alert("Error", "Could not update the list.");
    } else {
      // If the update is successful, update the local state manually
      const updatedList = {
        ...selectedList,
        name: editingListName,
        description: editingListDescription,
      };
      setLists(
        lists.map((list) => (list.id === updatedList.id ? updatedList : list))
      );
      setRenameModalVisible(false);
      setSelectedList(null);
    }
    setIsUpdating(false);
  };

  const handleDeletePress = () => {
    setActionSheetVisible(false);
    if (!selectedList) return;

    Alert.alert(
      "Delete List",
      `Are you sure you want to delete "${selectedList.name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => handleDeleteList(selectedList.id),
        },
      ]
    );
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

  const renderListItem = ({ item }: { item: UserList }) => (
    <TouchableOpacity
      onPress={() =>
        router.push({
          pathname: "/list/[id]",
          params: { id: item.id, name: item.name },
        })
      }
      onLongPress={() => handleLongPress(item)}
      style={styles.card}
    >
      <Text style={styles.cardTitle}>{item.name}</Text>
      <Text style={styles.cardDescription}>{item.description}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" />;
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.loggedOutContainer}>
        <Text style={styles.loggedOutTitle}>View Your Lists</Text>
        <Text style={styles.loggedOutText}>
          Please sign in to create and manage your lists.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Modal
        visible={isCreateModalVisible}
        onRequestClose={() => setCreateModalVisible(false)}
        transparent={true}
        animationType="slide"
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
                onPress={() => setCreateModalVisible(false)}
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

      <Modal
        visible={isRenameModalVisible}
        onRequestClose={() => setRenameModalVisible(false)}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Rename List</Text>
            <TextInput
              style={styles.input}
              value={editingListName}
              onChangeText={setEditingListName}
            />
            <TextInput
              style={styles.input}
              value={editingListDescription}
              onChangeText={setEditingListDescription}
            />
            <View style={styles.modalButtonContainer}>
              <Button
                title="Cancel"
                onPress={() => setRenameModalVisible(false)}
                color="gray"
              />
              <Button
                title={isUpdating ? "Saving..." : "Save"}
                onPress={handleUpdateList}
                disabled={isUpdating}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isActionSheetVisible}
        onRequestClose={() => setActionSheetVisible(false)}
        transparent={true}
        animationType="slide"
      >
        <Pressable
          style={styles.actionSheetContainer}
          onPress={() => setActionSheetVisible(false)}
        >
          <View style={styles.actionSheet}>
            <TouchableOpacity
              style={styles.actionSheetButton}
              onPress={handleRenamePress}
            >
              <Text style={styles.actionSheetButtonText}>Rename List</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionSheetButton, styles.deleteButton]}
              onPress={handleDeletePress}
            >
              <Text
                style={[styles.actionSheetButtonText, styles.deleteButtonText]}
              >
                Delete List
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionSheetButton, { marginTop: 10 }]}
              onPress={() => setActionSheetVisible(false)}
            >
              <Text
                style={[styles.actionSheetButtonText, { fontWeight: "bold" }]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <View style={styles.headerContainer}>
        <Text style={styles.header}>My Lists</Text>
        <Pressable
          style={styles.createButton}
          onPress={() => setCreateModalVisible(true)}
        >
          <Text style={styles.createButtonText}>+ Create</Text>
        </Pressable>
      </View>

      <FlatList
        data={lists}
        renderItem={renderListItem}
        keyExtractor={(item) => item.id.toString()}
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
  actionSheetContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  actionSheet: {
    backgroundColor: "#f8f8f8",
    padding: 16,
    paddingBottom: 30,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  actionSheetButton: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  actionSheetButtonText: {
    fontSize: 18,
    color: "#007AFF",
  },
  deleteButton: {},
  deleteButtonText: {
    color: "#FF3B30",
  },
});
