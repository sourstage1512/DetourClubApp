import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      {/* This line tells the navigator to find the (tabs) layout 
          but specifically hide its header. */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
