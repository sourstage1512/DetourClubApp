import { Text, View } from "react-native";

export default function AlertsScreen() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ fontSize: 24 }}>You do not have any alerts</Text>
    </View>
  );
}
