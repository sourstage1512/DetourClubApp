import { Ionicons } from "@expo/vector-icons";
import { Button, Input } from "@rneui/themed";
import { Session } from "@supabase/supabase-js";
import * as ImagePicker from "expo-image-picker";
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
  Text,
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [newLocalImage, setNewLocalImage] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState("free");

  const [loadingStats, setLoadingStats] = useState(true);
  const [aiCredits, setAiCredits] = useState(0);
  const [listCount, setListCount] = useState(0);

  const { user } = session;

  useEffect(() => {
    let ignore = false;
    async function getProfile() {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select(`full_name, bio, avatar_url, subscription_status`)
        .eq("id", user.id)
        .single();
      if (error) console.warn("Error fetching profile:", error);

      if (!ignore && data) {
        setFullName(data.full_name || "");
        setBio(data.bio || "");
        setSubscriptionStatus(data.subscription_status || "free");

        if (data.avatar_url) {
          const { data: signedUrlData } = await supabase.storage
            .from("avatars")
            .createSignedUrl(data.avatar_url, 3600);
          if (signedUrlData) setAvatarUrl(signedUrlData.signedUrl);
        }
      }
      setLoading(false);
    }
    getProfile();
    return () => {
      ignore = true;
    };
  }, [user.id]);

  const getStats = useCallback(() => {
    let ignore = false;
    async function fetchStats() {
      setLoadingStats(true);
      const { data: profileData } = await supabase
        .from("profiles")
        .select(`ai_credits`)
        .eq("id", user.id)
        .single();
      const { count: listCountData } = await supabase
        .from("user_lists")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (!ignore) {
        if (profileData) setAiCredits(profileData.ai_credits || 0);
        if (listCountData !== null) setListCount(listCountData);
      }
      setLoadingStats(false);
    }
    fetchStats();
    return () => {
      ignore = true;
    };
  }, [user.id]);

  useFocusEffect(getStats);

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
      setAvatarUrl(result.assets[0].uri);
    }
  };

  async function updateProfile() {
    setLoading(true);
    let newAvatarPath: string | undefined = undefined;

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
        .upload(filePath, formData, { upsert: true });

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
      ...(newAvatarPath && { avatar_url: newAvatarPath }),
    };

    const { error } = await supabase.from("profiles").upsert(updates);
    if (error) {
      Alert.alert(error.message);
    } else {
      Alert.alert("Success", "Profile updated successfully!");
      setNewLocalImage(null);
      Keyboard.dismiss();
    }
    setLoading(false);
  }

  const handleDeleteAccount = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("delete-user");
      if (error) throw error;
      Alert.alert("Success", "Your account has been deleted.");
      await supabase.auth.signOut();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not delete account.");
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to permanently delete your account and all of your data? This action is irreversible.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: handleDeleteAccount },
      ]
    );
  };

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
            <Text style={styles.fullName}>
              {loading ? "Loading..." : fullName || "New User"}
            </Text>
            <Text style={styles.email}>{user.email}</Text>
          </View>

          <View style={styles.statsContainer}>
            {loadingStats ? (
              <ActivityIndicator />
            ) : (
              <StatCard
                icon="flash-outline"
                label="AI Credits"
                value={aiCredits}
              />
            )}
            {loadingStats ? (
              <ActivityIndicator />
            ) : (
              <StatCard
                icon="list-outline"
                label="Lists Created"
                value={listCount}
              />
            )}
          </View>

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
            <Button
              title={loading ? "Saving..." : "Update Profile"}
              onPress={updateProfile}
              disabled={loading}
              buttonStyle={styles.updateButton}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardHeader}>Membership</Text>
            <View style={styles.membershipInfo}>
              <Text style={styles.membershipStatus}>
                {subscriptionStatus.charAt(0).toUpperCase() +
                  subscriptionStatus.slice(1)}{" "}
                Member
              </Text>
              <Button
                title="Upgrade to Pro"
                buttonStyle={styles.upgradeButton}
                titleStyle={styles.upgradeButtonTitle}
                onPress={() =>
                  Alert.alert(
                    "Coming Soon!",
                    "Pro features will be available in a future update."
                  )
                }
              />
            </View>
          </View>

          <View style={[styles.card, styles.dangerZone]}>
            <Text style={[styles.cardHeader, styles.dangerZoneHeader]}>
              Danger Zone
            </Text>
            <Button
              title="Sign Out"
              onPress={() => supabase.auth.signOut()}
              type="clear"
              titleStyle={styles.signOutTitle}
              containerStyle={{ marginBottom: 10 }}
            />
            <Button
              title="Delete Account"
              onPress={confirmDelete}
              disabled={loading}
              type="clear"
              titleStyle={styles.deleteAccountTitle}
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
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => setSession(session));
    supabase.auth.onAuthStateChange((_event, session) => setSession(session));
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
  container: { flex: 1, backgroundColor: "#f0f4f8" },
  flexContainer: { flex: 1 },
  scrollContentContainer: { flexGrow: 1, padding: 16 },
  profileHeader: { alignItems: "center", marginBottom: 24 },
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
  fullName: { fontSize: 24, fontWeight: "bold", color: "#1f2937" },
  email: { fontSize: 16, color: "#6b7280" },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    minHeight: 90,
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
  statCard: { alignItems: "center", flex: 1 },
  statValue: { fontSize: 22, fontWeight: "bold", color: "#1f2937" },
  statLabel: { fontSize: 14, color: "#6b7280", marginTop: 4 },
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 24,
  },
  cardHeader: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
    color: "#1f2937",
  },
  updateButton: { backgroundColor: "#6366F1", borderRadius: 8 },
  membershipInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  membershipStatus: {
    fontSize: 16,
    fontWeight: "500",
    color: "#374151",
  },
  upgradeButton: {
    backgroundColor: "#f59e0b",
    borderRadius: 8,
  },
  upgradeButtonTitle: {
    fontWeight: "bold",
  },
  dangerZone: {
    borderColor: "#ef4444",
    borderWidth: 1,
    backgroundColor: "#fff1f2",
  },
  dangerZoneHeader: {
    color: "#ef4444",
    textAlign: "center",
  },
  signOutTitle: {
    color: "#6b7280",
    fontWeight: "600",
    fontSize: 16,
  },
  deleteAccountTitle: {
    color: "#ef4444",
    fontWeight: "600",
    fontSize: 16,
  },
});
