import { Session } from "@supabase/supabase-js";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

// Type Definitions
type Category = { id: number; name: string };
type City = { id: number; name: string };
type Budget = "Budget" | "Balanced" | "Luxury";
type GroupType = "Solo" | "Couple" | "Group" | "Family";
type Diet = "Any" | "Vegetarian" | "Vegan" | "Gluten-Free";
type Radius = "5 KM" | "10 KM" | "20 KM" | "Anywhere";

// Constants for our filters
const BUDGET_LEVELS: Budget[] = ["Budget", "Balanced", "Luxury"];
const GROUP_TYPES: GroupType[] = ["Solo", "Couple", "Group", "Family"];
const DIETARY_RESTRICTIONS: Diet[] = [
  "Any",
  "Vegetarian",
  "Vegan",
  "Gluten-Free",
];
const SEARCH_RADII: Radius[] = ["5 KM", "10 KM", "20 KM", "Anywhere"];

export default function AiDiscoveryScreen() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiCredits, setAiCredits] = useState<number>(0);
  const [loadingInitialData, setLoadingInitialData] = useState(true);

  const scrollViewRef = useRef<ScrollView>(null);

  // State for all filters
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [isCityModalVisible, setCityModalVisible] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBudgets, setSelectedBudgets] = useState<Budget[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupType | null>(null);
  const [selectedDiet, setSelectedDiet] = useState<Diet>("Any");
  const [includeLocal, setIncludeLocal] = useState(true);
  const [additionalInstructions, setAdditionalInstructions] = useState("");

  // State for Geolocation
  const [searchNearby, setSearchNearby] = useState(false);
  const [selectedRadius, setSelectedRadius] = useState<Radius>("Anywhere");
  const [userLocation, setUserLocation] =
    useState<Location.LocationObject | null>(null);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => setSession(session));
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    );
    return () => authListener.subscription.unsubscribe();
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const fetchData = async () => {
        if (session?.user) {
          setLoadingInitialData(true);
          const creditsPromise = supabase
            .from("profiles")
            .select("ai_credits")
            .eq("id", session.user.id)
            .single();
          const categoriesPromise = supabase
            .from("categories")
            .select("id, name");
          const citiesPromise = supabase
            .from("cities")
            .select("id, name")
            .order("name", { ascending: true });

          const [creditsResult, categoriesResult, citiesResult] =
            await Promise.all([
              creditsPromise,
              categoriesPromise,
              citiesPromise,
            ]);

          if (isActive) {
            if (creditsResult.data) setAiCredits(creditsResult.data.ai_credits);
            if (categoriesResult.data) setCategories(categoriesResult.data);
            if (citiesResult.data) setCities(citiesResult.data);
            setLoadingInitialData(false);
          }
        } else {
          if (isActive) {
            setAiCredits(0);
            setLoadingInitialData(false);
          }
        }
      };
      fetchData();
      return () => {
        isActive = false;
      };
    }, [session])
  );

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        return;
      }
      let location = await Location.getCurrentPositionAsync({});
      setUserLocation(location);
    })();
  }, []);

  const toggleCategory = (categoryName: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryName)
        ? prev.filter((c) => c !== categoryName)
        : [...prev, categoryName]
    );
  };

  const toggleBudget = (budget: Budget) => {
    setSelectedBudgets((prev) =>
      prev.includes(budget)
        ? prev.filter((b) => b !== budget)
        : [...prev, budget]
    );
  };

  const handleGenerate = async () => {
    if (!selectedCity && !searchNearby) {
      Alert.alert("Please select a city before generating suggestions.");
      return;
    }
    if (searchNearby && !userLocation) {
      Alert.alert(
        "Location not available",
        "Could not get your current location. Please ensure location services are enabled."
      );
      return;
    }
    setLoading(true);
    setError(null);

    let queryParts = [];
    if (selectedBudgets.length > 0) {
      queryParts.push(
        `that is ${selectedBudgets.map((b) => b.toLowerCase()).join(" or ")}`
      );
    }
    if (selectedGroup) {
      queryParts.push(`that is good for a ${selectedGroup.toLowerCase()} trip`);
    }
    if (selectedDiet !== "Any") {
      queryParts.push(`with ${selectedDiet.toLowerCase()} options`);
    }
    if (includeLocal) {
      queryParts.push(
        "prioritizing unique activities and hidden gems recommended by locals"
      );
    }
    if (additionalInstructions) {
      queryParts.push(additionalInstructions);
    }

    const finalQuery = "I'm looking for a place " + queryParts.join(" ") + ".";

    if (selectedCategories.length === 0 && queryParts.length === 0) {
      Alert.alert("Please select some options or type a description.");
      setLoading(false);
      return;
    }

    try {
      // NOTE: We will create the 'ai-discovery-geo' function in the next step.
      // For now, this logic will still call the existing function.
      const functionName = searchNearby ? "ai-discovery-geo" : "ai-discovery";
      const body = {
        queryText: finalQuery,
        cityId: selectedCity?.id,
        selectedCategories: selectedCategories,
        ...(searchNearby &&
          userLocation && {
            latitude: userLocation.coords.latitude,
            longitude: userLocation.coords.longitude,
            radius_km: parseInt(selectedRadius.replace(" KM", "")) || 50, // Default large radius
          }),
      };

      const { data, error } = await supabase.functions.invoke(functionName, {
        body,
      });

      if (error) throw error;

      router.push({
        pathname: "/ai-results",
        params: { results: JSON.stringify(data) },
      });
    } catch (e: any) {
      console.error("Error invoking function:", e);
      setError(e.message || "An unknown error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleTextInputFocus = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text>Please sign in.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const canGenerate = aiCredits >= 20;

  return (
    <SafeAreaView style={styles.container}>
      <Modal
        animationType="slide"
        transparent={true}
        visible={isCityModalVisible}
        onRequestClose={() => setCityModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          onPress={() => setCityModalVisible(false)}
        >
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Select a City</Text>
            <ScrollView style={{ width: "100%" }}>
              {cities.map((city) => (
                <TouchableOpacity
                  key={city.id}
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedCity(city);
                    setCityModalVisible(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{city.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Discovery Assistant</Text>
          {loadingInitialData ? (
            <ActivityIndicator />
          ) : (
            <Text style={styles.creditsText}>{aiCredits} AI credits left</Text>
          )}
        </View>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContainer}
        >
          <View style={styles.toggleSection}>
            <View>
              <Text style={styles.sectionTitle}>Search for places near me</Text>
              <Text style={styles.toggleSubtitle}>
                AI will look only for places near you
              </Text>
            </View>
            <Switch
              trackColor={{ false: "#767577", true: "#81b0ff" }}
              thumbColor={searchNearby ? "#6366F1" : "#f4f3f4"}
              onValueChange={() =>
                setSearchNearby((previousState) => !previousState)
              }
              value={searchNearby}
            />
          </View>

          {searchNearby ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Find places within</Text>
              <View style={styles.pillsContainer}>
                {SEARCH_RADII.map((radius) => (
                  <TouchableOpacity
                    key={radius}
                    style={
                      selectedRadius === radius
                        ? styles.pillSelected
                        : styles.pill
                    }
                    onPress={() => setSelectedRadius(radius)}
                  >
                    <Text
                      style={
                        selectedRadius === radius
                          ? styles.pillTextSelected
                          : styles.pillText
                      }
                    >
                      {radius}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>City</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setCityModalVisible(true)}
              >
                <Text style={styles.dropdownButtonText}>
                  {selectedCity ? selectedCity.name : "Select a City"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Place Type</Text>
            <View style={styles.pillsContainer}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={
                    selectedCategories.includes(cat.name)
                      ? styles.pillSelected
                      : styles.pill
                  }
                  onPress={() => toggleCategory(cat.name)}
                >
                  <Text
                    style={
                      selectedCategories.includes(cat.name)
                        ? styles.pillTextSelected
                        : styles.pillText
                    }
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Budget Level</Text>
            <View style={styles.pillsContainer}>
              {BUDGET_LEVELS.map((budget) => (
                <TouchableOpacity
                  key={budget}
                  style={
                    selectedBudgets.includes(budget)
                      ? styles.pillSelected
                      : styles.pill
                  }
                  onPress={() => toggleBudget(budget)}
                >
                  <Text
                    style={
                      selectedBudgets.includes(budget)
                        ? styles.pillTextSelected
                        : styles.pillText
                    }
                  >
                    {budget}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Traveling Group Type</Text>
            <View style={styles.pillsContainer}>
              {GROUP_TYPES.map((group) => (
                <TouchableOpacity
                  key={group}
                  style={
                    selectedGroup === group ? styles.pillSelected : styles.pill
                  }
                  onPress={() => setSelectedGroup(group)}
                >
                  <Text
                    style={
                      selectedGroup === group
                        ? styles.pillTextSelected
                        : styles.pillText
                    }
                  >
                    {group}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dietary Restrictions</Text>
            <View style={styles.pillsContainer}>
              {DIETARY_RESTRICTIONS.map((diet) => (
                <TouchableOpacity
                  key={diet}
                  style={
                    selectedDiet === diet ? styles.pillSelected : styles.pill
                  }
                  onPress={() => setSelectedDiet(diet)}
                >
                  <Text
                    style={
                      selectedDiet === diet
                        ? styles.pillTextSelected
                        : styles.pillText
                    }
                  >
                    {diet}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.toggleSection}>
            <View>
              <Text style={styles.sectionTitle}>Include local experiences</Text>
              <Text style={styles.toggleSubtitle}>
                Find unique activities and hidden gems
              </Text>
            </View>
            <Switch
              trackColor={{ false: "#767577", true: "#81b0ff" }}
              thumbColor={includeLocal ? "#6366F1" : "#f4f3f4"}
              onValueChange={() =>
                setIncludeLocal((previousState) => !previousState)
              }
              value={includeLocal}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Instructions</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., with a great view and live music..."
              multiline
              value={additionalInstructions}
              onChangeText={setAdditionalInstructions}
              onFocus={handleTextInputFocus}
            />
          </View>
          {error && <Text style={styles.errorText}>Error: {error}</Text>}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.generateButton,
              !canGenerate && styles.generateButtonDisabled,
            ]}
            onPress={handleGenerate}
            disabled={!canGenerate || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.generateButtonText}>Let’s Go!</Text>
            )}
          </TouchableOpacity>
          {!canGenerate && (
            <Text style={styles.errorText}>
              You have insufficient credits to generate suggestions.
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scrollContainer: { paddingBottom: 16 },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  title: { fontSize: 22, fontWeight: "bold" },
  creditsText: { fontSize: 14, color: "#6366F1", marginTop: 5 },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  toggleSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  toggleSubtitle: {
    fontSize: 14,
    color: "#666",
    maxWidth: "90%",
  },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 4 },
  pillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#f0f0f0",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  pillSelected: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#6366F1",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#6366F1",
  },
  pillText: { fontSize: 14, color: "#333" },
  pillTextSelected: { fontSize: 14, color: "#fff", fontWeight: "bold" },
  textInput: {
    minHeight: 100,
    padding: 12,
    backgroundColor: "#f8f8f8",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    fontSize: 16,
    textAlignVertical: "top",
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    backgroundColor: "#fff",
  },
  generateButton: {
    backgroundColor: "#6366F1",
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  generateButtonDisabled: {
    backgroundColor: "#a5b4fc",
  },
  generateButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  errorText: {
    color: "red",
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 16,
  },
  dropdownButton: {
    backgroundColor: "#f0f0f0",
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginTop: 8,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: "#333",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalView: {
    width: "80%",
    maxHeight: "60%",
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
  modalItem: {
    width: "100%",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalItemText: { textAlign: "center", fontSize: 18 },
});
