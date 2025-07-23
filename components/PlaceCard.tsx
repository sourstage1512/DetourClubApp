import { Link } from "expo-router";
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

type Place = {
  id: number;
  name: string;
  neighborhood: string;
  image_urls: string[] | null;
  // This type correctly reflects that categories can be null
  categories: {
    name: string;
  } | null;
};

type PlaceCardProps = {
  place: Place;
  disabled?: boolean;
};

export default function PlaceCard({ place, disabled = false }: PlaceCardProps) {
  if (!place) {
    return null;
  }

  // --- THIS IS THE FIX ---
  // The '?.' safely checks if 'place.categories' exists before trying to access its 'name' property.
  // If it doesn't exist, it gracefully uses 'Misc' as a fallback.
  const categoryName = place.categories?.name || "Misc";

  const imageUrl =
    place.image_urls && place.image_urls.length > 0
      ? place.image_urls[0]
      : null;

  return (
    <Link href={`/places/${place.id}`} asChild>
      <Pressable style={styles.card} disabled={disabled}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder} />
        )}
        <View style={styles.textContainer}>
          <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
            {place.name}
          </Text>
          <Text style={styles.details} numberOfLines={1} ellipsizeMode="tail">
            {categoryName} • {place.neighborhood}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

// Styles are unchanged
const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  image: {
    width: "100%",
    height: 120,
  },
  imagePlaceholder: {
    width: "100%",
    height: 120,
    backgroundColor: "#eee",
  },
  textContainer: {
    padding: 12,
    height: 65,
    justifyContent: "center",
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  details: {
    fontSize: 14,
    color: "#555",
  },
});
