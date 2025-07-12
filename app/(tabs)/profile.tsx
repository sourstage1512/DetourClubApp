import { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { Button, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Auth from "../../components/Auth";
import { supabase } from "../../lib/supabase";

export default function ProfileScreen() {
  // We will use this state variable to keep track of the user's session
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // Immediately check if a session exists
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // This listener will update the session state whenever the user signs in or out
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Cleanup the listener when the component is removed
    return () => subscription.unsubscribe();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      {/* If a session exists, show the user's info and a sign out button */}
      {session && session.user ? (
        <View>
          <Text style={{ fontSize: 20, fontWeight: "bold", marginBottom: 10 }}>
            Welcome!
          </Text>
          <Text style={{ marginBottom: 20 }}>
            You are signed in as: {session.user.email}
          </Text>
          <Button
            title="Sign Out"
            onPress={() => supabase.auth.signOut()}
            color="#FF6347"
          />
        </View>
      ) : (
        // If no session exists, show the Auth component (the login form)
        <Auth />
      )}
    </SafeAreaView>
  );
}
