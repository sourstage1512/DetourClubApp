import { Ionicons } from "@expo/vector-icons";
import { Button, Input } from "@rneui/themed";
import { Session } from "@supabase/supabase-js";
import { useFocusEffect } from "expo-router"; // NEW: Import useFocusEffect
import { useCallback, useEffect, useState } from "react"; // NEW: Import useCallback
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
  const [avatarUrl, setAvatarUrl] = useState("");
  const [aiCredits, setAiCredits] = useState(0);
  const [listCount, setListCount] = useState(0);

  const { user } = session;

  // --- THIS IS THE KEY CHANGE ---
  // 1. The data fetching logic is wrapped in useCallback
  const getProfileAndStats = useCallback(() => {
    let ignore = false;
    async function fetchData() {
      setLoading(true);

      const profilePromise = supabase
        .from("profiles")
        .select(`full_name, bio, avatar_url, ai_credits`)
        .eq("id", user.id)
        .single();
      const listCountPromise = supabase
        .from("user_lists")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      const [profileResult, listCountResult] = await Promise.all([
        profilePromise,
        listCountPromise,
      ]);

      if (!ignore) {
        if (profileResult.error) {
          console.warn(profileResult.error);
        } else if (profileResult.data) {
          setFullName(profileResult.data.full_name || "");
          setBio(profileResult.data.bio || "");
          setAvatarUrl(profileResult.data.avatar_url || "");
          setAiCredits(profileResult.data.ai_credits || 0);
        }

        if (listCountResult.count !== null) setListCount(listCountResult.count);
      }
      setLoading(false);
    }

    fetchData();
    return () => {
      ignore = true;
    };
  }, [user.id]);

  // 2. We use useFocusEffect to call the function every time the screen is focused
  useFocusEffect(getProfileAndStats);
  // --- END OF KEY CHANGE ---

  async function updateProfile() {
    setLoading(true);
    const updates = {
      id: user.id,
      full_name: fullName,
      bio: bio,
      avatar_url: avatarUrl,
      updated_at: new Date(),
    };

    const { error } = await supabase.from("profiles").upsert(updates);
    if (error) {
      Alert.alert(error.message);
    } else {
      Alert.alert("Success", "Profile updated successfully!");
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
          <View style={styles.profileHeader}>
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person-outline" size={60} color="#6366F1" />
            </View>
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
            <Input
              label="Avatar URL"
              value={avatarUrl}
              onChangeText={setAvatarUrl}
              placeholder="https://.../your-image.png"
              autoCapitalize="none"
            />
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
