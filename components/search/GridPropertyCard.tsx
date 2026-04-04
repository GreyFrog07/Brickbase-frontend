import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Linking,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Property } from "../../types/property";
import CachedImage from "../CachedImage";

const SCREEN_WIDTH = Dimensions.get("window").width;
const GAP = 10;
const PADDING = 16;
const CARD_WIDTH = (SCREEN_WIDTH - PADDING * 2 - GAP) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.7;

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

  const coverPhotoPath = property.coverPhotoPath;
  const image =
    property.propertyPhotos?.[property.coverPhotoIndex ?? 0] ||
    property.propertyPhotos?.[0];

  const hasPhone = !!(property.builders?.[0]?.phoneNumber || property.builderPhone);
  const isCorner = (property as any).cornerProperty;

  const getLocationInfo = () => {
    if (!property.address) return null;
    const parts: string[] = [];
    if (property.address.sector) parts.push(`Sec ${property.address.sector}`);
    if (property.address.city) parts.push(property.address.city);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const locationInfo = getLocationInfo();

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {(coverPhotoPath || image) ? (
        <CachedImage
          storagePath={coverPhotoPath}
          bucket={coverPhotoPath ? 'property-photos' : undefined}
          uri={!coverPhotoPath ? image : undefined}
          style={styles.image}
        />
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name="image-outline" size={28} color="#666" />
        </View>
      )}

      {/* Top gradient */}
      <LinearGradient
        colors={["rgba(0,0,0,0.45)", "rgba(0,0,0,0)"]}
        style={styles.topGradient}
        pointerEvents="box-none"
      >
        <View style={styles.topRow}>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {property.propertyCategory?.toUpperCase() || "RESIDENTIAL"}
              </Text>
            </View>
            {isCorner && (
              <View style={styles.cornerBadge}>
                <Text style={styles.cornerBadgeText}>CORNER</Text>
              </View>
            )}
          </View>
          {onShare && (
            <TouchableOpacity style={styles.shareIcon} onPress={onShare}>
              <Ionicons name="share-social" size={16} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Bottom gradient */}
      <LinearGradient
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.75)"]}
        style={styles.bottomGradient}
        pointerEvents="box-none"
      >
        <View style={styles.bottomContent}>
          <Text numberOfLines={1} style={styles.title}>
            {property.bhk ? `${property.bhk} BHK ` : ""}{property.propertyType || "Property"}
          </Text>
          {locationInfo && (
            <Text numberOfLines={1} style={styles.locationLine}>{locationInfo}</Text>
          )}

          <View style={styles.priceRow}>
            <Text style={styles.price}>
              {getPrice()}
            </Text>
            {hasPhone && (
              <View style={styles.actions}>
                <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
                  <Ionicons name="call-outline" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.whatsappBtn} onPress={handleWhatsApp}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
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

  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "40%",
    padding: 12,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  badge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },

  cornerBadge: {
    backgroundColor: "rgba(255,180,0,0.3)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },

  cornerBadgeText: {
    color: "#ffb400",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    fontFamily: 'sans-serif'
  },

  shareIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(150,150,150,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },

  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "50%",
    justifyContent: "flex-end",
    padding: 12,
  },

  bottomContent: {},

  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  locationLine: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    marginTop: 1,
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },

  price: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    flexShrink: 1,
  },

  actions: {
    flexDirection: "row",
    gap: 8,
    marginLeft: 6,
  },

  callBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },

  whatsappBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
});
