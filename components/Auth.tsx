import { Ionicons } from "@expo/vector-icons";
import { Button, Divider, Input } from "@rneui/themed";
import * as Linking from "expo-linking"; // NEW: Import expo-linking
import React from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { supabase } from "../lib/supabase";

// --- NEW: A helper function to create the redirect URL ---
const createRedirectUrl = () => {
  // This function creates the correct URL for the current environment (Expo Go, dev build, etc.)
  return Linking.createURL("");
};

export default function Auth() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) Alert.alert(error.message);
    setLoading(false);
  }

  async function signUpWithEmail() {
    setLoading(true);
    const {
      data: { session },
      error,
    } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    if (error) Alert.alert(error.message);
    if (!session && !error)
      Alert.alert("Please check your inbox for email verification!");
    setLoading(false);
  }

  // --- UPDATED: The function now includes the redirectTo option ---
  async function signInWithGoogle() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: createRedirectUrl(), // This is the crucial fix
      },
    });

    if (error) {
      Alert.alert(error.message);
      setLoading(false); // Only set loading to false if there's an immediate error
    }
  }

  return (
    <View style={styles.container}>
      <View style={[styles.verticallySpaced, styles.mt20]}>
        <Input
          label="Email"
          leftIcon={{ type: "font-awesome", name: "envelope" }}
          onChangeText={(text: string) => setEmail(text)}
          value={email}
          placeholder="email@address.com"
          autoCapitalize={"none"}
        />
      </View>
      <View style={styles.verticallySpaced}>
        <Input
          label="Password"
          leftIcon={{ type: "font-awesome", name: "lock" }}
          onChangeText={(text: string) => setPassword(text)}
          value={password}
          secureTextEntry={true}
          placeholder="Password"
          autoCapitalize={"none"}
        />
      </View>
      <View style={[styles.verticallySpaced, styles.mt20]}>
        <Button
          title="Sign in"
          disabled={loading}
          onPress={() => signInWithEmail()}
        />
      </View>
      <View style={styles.verticallySpaced}>
        <Button
          title="Sign up"
          disabled={loading}
          onPress={() => signUpWithEmail()}
        />
      </View>

      <View style={styles.separatorContainer}>
        <Divider style={styles.divider} />
        <Text style={styles.separatorText}>OR</Text>
        <Divider style={styles.divider} />
      </View>

      <View style={styles.verticallySpaced}>
        <Button
          title="Sign in with Google"
          onPress={() => signInWithGoogle()}
          disabled={loading}
          buttonStyle={styles.googleButton}
          titleStyle={styles.googleButtonTitle}
          icon={
            <Ionicons
              name="logo-google"
              size={20}
              color="white"
              style={{ marginRight: 10 }}
            />
          }
        />
      </View>
    </View>
  );
}

// Styles are unchanged
const styles = StyleSheet.create({
  container: {
    marginTop: 40,
    padding: 12,
  },
  verticallySpaced: {
    paddingTop: 4,
    paddingBottom: 4,
    alignSelf: "stretch",
  },
  mt20: {
    marginTop: 20,
  },
  separatorContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    backgroundColor: "#d1d5db",
  },
  separatorText: {
    marginHorizontal: 10,
    color: "#6b7280",
    fontWeight: "600",
  },
  googleButton: {
    backgroundColor: "#4285F4",
  },
  googleButtonTitle: {
    color: "white",
    fontWeight: "bold",
  },
});
