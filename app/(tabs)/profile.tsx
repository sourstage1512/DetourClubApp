import { Button, Input } from "@rneui/themed";
import { Session } from "@supabase/supabase-js"; // 'User' has been removed
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Auth from "../../components/Auth";
import { supabase } from "../../lib/supabase";

function ProfileDetails({ session }: { session: Session }) {
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const { user } = session; // Destructure user from session

  useEffect(() => {
    let ignore = false;
    async function getProfile() {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select(`full_name, bio, avatar_url`)
        .eq("id", user.id)
        .single();

      if (!ignore) {
        if (error) {
          console.warn(error);
        } else if (data) {
          setFullName(data.full_name || "");
          setBio(data.bio || "");
          setAvatarUrl(data.avatar_url || "");
        }
      }
      setLoading(false);
    }

    getProfile();
    return () => {
      ignore = true;
    };
  }, [session, user.id]); // Dependency array now includes user.id

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
    }
    setLoading(false);
  }

  return (
    <View style={styles.contentContainer}>
      <Text style={styles.header}>Your Profile</Text>

      <View style={styles.inputContainer}>
        <Input label="Email" value={user.email} disabled />
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
      </View>

      <Button
        title={loading ? "Saving..." : "Update Profile"}
        onPress={updateProfile}
        disabled={loading}
        buttonStyle={styles.updateButton}
      />
      <View style={styles.signOutButtonContainer}>
        <Button
          title="Sign Out"
          onPress={() => supabase.auth.signOut()}
          type="outline"
          buttonStyle={styles.signOutButton}
          titleStyle={styles.signOutTitle}
        />
      </View>
    </View>
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
    backgroundColor: "#f8f8f8",
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  header: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: 20,
  },
  updateButton: {
    backgroundColor: "#6366F1",
  },
  signOutButtonContainer: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingTop: 20,
  },
  signOutButton: {
    borderColor: "#FF3B30",
  },
  signOutTitle: {
    color: "#FF3B30",
  },
});
