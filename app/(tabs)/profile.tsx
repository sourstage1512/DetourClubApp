import { Ionicons } from "@expo/vector-icons";
import { Button, Input } from "@rneui/themed";
import { Session } from "@supabase/supabase-js";
import * as ImagePicker from "expo-image-picker"; // NEW: Import Image Picker
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text, // NEW: Import Image component
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Auth from "../../components/Auth";
import { supabase } from "../../lib/supabase";

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string | number;
}) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={24} color="#6366F1" />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ProfileDetails({ session }: { session: Session }) {
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");

  // --- NEW: State for the avatar ---
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null); // This will hold the displayable URL
  const [newLocalImage, setNewLocalImage] =
    useState<ImagePicker.ImagePickerAsset | null>(null); // Holds the new image selected by the user

  const [aiCredits, setAiCredits] = useState(0);
  const [listCount, setListCount] = useState(0);

  const { user } = session;

  const getProfileAndStats = useCallback(() => {
    let ignore = false;
    async function fetchData() {
      setLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select(`full_name, bio, avatar_url, ai_credits`)
        .eq("id", user.id)
        .single();
      if (error) console.warn(error);
      if (!ignore && data) {
        setFullName(data.full_name || "");
        setBio(data.bio || "");
        setAiCredits(data.ai_credits || 0);

        // --- NEW: Fetch the secure, signed URL for the avatar ---
        if (data.avatar_url) {
          const { data: signedUrlData, error: signedUrlError } =
            await supabase.storage
              .from("avatars")
              .createSignedUrl(data.avatar_url, 3600); // URL valid for 1 hour
          if (signedUrlError) {
            console.warn("Error creating signed URL:", signedUrlError);
          } else {
            setAvatarUrl(signedUrlData.signedUrl);
          }
        }
      }

      const { count: listCountData } = await supabase
        .from("user_lists")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (!ignore && listCountData !== null) setListCount(listCountData);

      setLoading(false);
    }

    fetchData();
    return () => {
      ignore = true;
    };
  }, [user.id]);

  useFocusEffect(getProfileAndStats);

  // --- NEW: Function to handle picking an image from the gallery ---
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Sorry, we need camera roll permissions to make this work!");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "Images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setNewLocalImage(result.assets[0]);
      setAvatarUrl(result.assets[0].uri); // Show a preview of the new image immediately
    }
  };

  async function updateProfile() {
    setLoading(true);
    let newAvatarPath: string | undefined = undefined;

    // --- NEW: Upload logic for the new image ---
    if (newLocalImage) {
      const fileExt = newLocalImage.uri.split(".").pop();
      const fileName = `${user.id}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const formData = new FormData();
      formData.append("file", {
        uri: newLocalImage.uri,
        name: fileName,
        type: newLocalImage.mimeType ?? "image/jpeg",
      } as any);

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, formData, { upsert: true }); // upsert = true allows overwriting

      if (uploadError) {
        Alert.alert("Error uploading image:", uploadError.message);
        setLoading(false);
        return;
      }
      newAvatarPath = filePath;
    }

    const updates = {
      id: user.id,
      full_name: fullName,
      bio: bio,
      updated_at: new Date(),
      ...(newAvatarPath && { avatar_url: newAvatarPath }), // Only include avatar_url if a new one was uploaded
    };

    const { error } = await supabase.from("profiles").upsert(updates);
    if (error) {
      Alert.alert(error.message);
    } else {
      Alert.alert("Success", "Profile updated successfully!");
      setNewLocalImage(null); // Clear the temporary local image
      Keyboard.dismiss();
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.flexContainer}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={Keyboard.dismiss}>
          {/* --- NEW: Interactive Profile Header --- */}
          <View style={styles.profileHeader}>
            <TouchableOpacity onPress={pickImage}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons
                    name="person-add-outline"
                    size={60}
                    color="#6366F1"
                  />
                </View>
              )}
            </TouchableOpacity>
            <Text style={styles.fullName}>{fullName || "New User"}</Text>
            <Text style={styles.email}>{user.email}</Text>
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginVertical: 20 }} />
          ) : (
            <View style={styles.statsContainer}>
              <StatCard
                icon="flash-outline"
                label="AI Credits"
                value={aiCredits}
              />
              <StatCard
                icon="list-outline"
                label="Lists Created"
                value={listCount}
              />
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.cardHeader}>Edit Profile</Text>
            <Input
              label="Full Name"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your Name"
            />
            <Input
              label="Bio"
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself"
              multiline
            />
            {/* Avatar URL input is now removed */}
            <Button
              title={loading ? "Saving..." : "Update Profile"}
              onPress={updateProfile}
              disabled={loading}
              buttonStyle={styles.updateButton}
            />
          </View>

          <View style={styles.signOutButtonContainer}>
            <Button
              title="Sign Out"
              onPress={() => supabase.auth.signOut()}
              type="clear"
              titleStyle={styles.signOutTitle}
            />
          </View>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function ProfileScreen() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {session && session.user ? (
        <ProfileDetails session={session} />
      ) : (
        <Auth />
      )}
    </SafeAreaView>
  );
}

// --- UPDATED STYLES for Avatar ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f4f8",
  },
  flexContainer: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
    padding: 16,
  },
  profileHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
    backgroundColor: "#e0e7ff",
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#e0e7ff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  fullName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
  },
  email: {
    fontSize: 16,
    color: "#6b7280",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 24,
    backgroundColor: "white",
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statCard: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1f2937",
  },
  statLabel: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
    color: "#1f2937",
  },
  updateButton: {
    backgroundColor: "#6366F1",
    borderRadius: 8,
  },
  signOutButtonContainer: {
    marginTop: 24,
    alignItems: "center",
  },
  signOutTitle: {
    color: "#ef4444",
    fontWeight: "600",
    fontSize: 16,
  },
});
