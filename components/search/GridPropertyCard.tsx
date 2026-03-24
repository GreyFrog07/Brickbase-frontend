import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  Linking,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Property } from "../../types/property";

const SCREEN_WIDTH = Dimensions.get("window").width;
const GAP = 12;
const PADDING = 16;
const CARD_WIDTH = (SCREEN_WIDTH - PADDING * 2 - GAP) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.25;

interface Props {
  property: Property;
  onPress: () => void;
  onShare?: () => void;
}

export default function GridPropertyCard({
  property,
  onPress,
  onShare,
}: Props) {
  const formatPrice = (price?: number, unit?: string) => {
    if (!price) return "N/A";
    if (unit === "cr") return `₹${price.toFixed(2)} Cr`;
    if (unit === "lakh_per_month") return `₹${price.toFixed(1)} L/mo`;
    return `₹${price.toFixed(2)} L`;
  };

  const getPrice = () => {
    if (property.floors?.length) {
      const prices = property.floors.map((f) => f.price);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const unit = property.floors[0].priceUnit;

      if (min === max) return formatPrice(min, unit);

      const label = unit === "cr" ? "Cr" : "L";
      return `₹${min}-${max} ${label}`;
    }
    return formatPrice(property.price, property.priceUnit);
  };

  const handleCall = () => {
    const phone = property.builders?.[0]?.phoneNumber || property.builderPhone;
    if (!phone) return;

    const code = property.builders?.[0]?.countryCode || "+91";
    Linking.openURL(`tel:${code}${phone}`).catch(() =>
      Alert.alert("Error", "Cannot open dialer"),
    );
  };

  const handleWhatsApp = () => {
    const phone = property.builders?.[0]?.phoneNumber || property.builderPhone;
    if (!phone) return;

    const code = property.builders?.[0]?.countryCode || "+91";
    Linking.openURL(
      `whatsapp://send?phone=${code.replace("+", "")}${phone}`,
    ).catch(() => Alert.alert("Error", "WhatsApp not installed"));
  };

  const image =
    property.propertyPhotos?.[property.coverPhotoIndex ?? 0] ||
    property.propertyPhotos?.[0];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {image ? (
        <Image source={{ uri: image }} style={styles.image} />
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name="image-outline" size={28} color="#666" />
        </View>
      )}

      {/* DARK GRADIENT OVERLAY (FAKE USING VIEW) */}
      <View style={styles.overlay}>
        {/* TOP */}
        <View style={styles.topRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {property.propertyCategory?.toUpperCase() || "RESIDENTIAL"}
            </Text>
          </View>

          {onShare && (
            <TouchableOpacity onPress={onShare}>
              <Ionicons name="share-social-outline" size={16} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* TITLE */}
        <Text numberOfLines={1} style={styles.title}>
          {property.propertyType || "Property"}
        </Text>

        {/* PRICE + ACTIONS */}
        <View style={styles.bottomRow}>
          <Text numberOfLines={1} style={styles.price}>
            {getPrice()}
          </Text>

          {(property.builders?.[0]?.phoneNumber || property.builderPhone) && (
            <View style={styles.actions}>
              <TouchableOpacity style={styles.icon} onPress={handleCall}>
                <Ionicons name="call" size={13} color="#4CAF50" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.icon} onPress={handleWhatsApp}>
                <Ionicons name="logo-whatsapp" size={13} color="#25D366" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#111",
  },

  image: {
    width: "100%",
    height: "100%",
  },

  placeholder: {
    flex: 1,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
  },

  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,

    padding: 10,
    paddingTop: 18,

    backgroundColor: "rgba(0,0,0,0.65)",
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  badge: {
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  badgeText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 0.4,
  },

  title: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },

  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },

  price: {
    flex: 1,
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },

  actions: {
    flexDirection: "row",
    gap: 6,
  },

  icon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
});
