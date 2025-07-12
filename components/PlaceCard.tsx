import { Link } from "expo-router";
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

type Place = {
  id: number;
  name: string;
  neighborhood: string;
  image_urls: string[] | null;
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

  const categoryName = place.categories ? place.categories.name : "Unknown";
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
        {/* The textContainer now has a fixed height */}
        <View style={styles.textContainer}>
          {/* The name is now truncated */}
          <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
            {place.name}
          </Text>
          {/* The details are also truncated */}
          <Text style={styles.details} numberOfLines={1} ellipsizeMode="tail">
            {categoryName} • {place.neighborhood}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

// The styles have been updated to enforce a fixed height
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
    height: 120, // The image has a fixed height
  },
  imagePlaceholder: {
    width: "100%",
    height: 120,
    backgroundColor: "#eee",
  },
  textContainer: {
    padding: 12,
    // 1. We enforce a fixed height for the text area
    height: 65,
    // This ensures the text area doesn't grow, even if content is short
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
