import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GAP = 10;
const PADDING = 16;
const GRID_CARD_WIDTH = (SCREEN_WIDTH - PADDING * 2 - GAP) / 2;
const GRID_CARD_HEIGHT = GRID_CARD_WIDTH * 1.7;

function ShimmerBlock({ style }: { style: any }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return <Animated.View style={[style, { opacity }]} />;
}

export function GridSkeletonCard() {
  return (
    <View style={gridStyles.card}>
      <ShimmerBlock style={gridStyles.image} />
      <View style={gridStyles.overlay}>
        <ShimmerBlock style={gridStyles.badge} />
        <ShimmerBlock style={gridStyles.priceLine} />
        <ShimmerBlock style={gridStyles.typeLine} />
      </View>
    </View>
  );
}

export function CompactSkeletonCard() {
  return (
    <View style={compactStyles.card}>
      <ShimmerBlock style={compactStyles.thumbnail} />
      <View style={compactStyles.content}>
        <ShimmerBlock style={compactStyles.categoryLine} />
        <ShimmerBlock style={compactStyles.titleLine} />
        <ShimmerBlock style={compactStyles.detailLine} />
        <ShimmerBlock style={compactStyles.locationLine} />
      </View>
    </View>
  );
}

const gridStyles = StyleSheet.create({
  card: {
    width: GRID_CARD_WIDTH,
    height: GRID_CARD_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#252525',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    gap: 6,
  },
  badge: {
    width: 70,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  priceLine: {
    width: '60%',
    height: 16,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  typeLine: {
    width: '40%',
    height: 12,
    borderRadius: 4,
    backgroundColor: '#333',
  },
});

const compactStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.18)',
    height: 150,
    marginHorizontal: PADDING,
  },
  thumbnail: {
    width: 140,
    height: '100%',
    backgroundColor: '#252525',
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 8,
  },
  categoryLine: {
    width: 80,
    height: 12,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  titleLine: {
    width: '80%',
    height: 16,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  detailLine: {
    width: '55%',
    height: 12,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  locationLine: {
    width: '65%',
    height: 12,
    borderRadius: 4,
    backgroundColor: '#333',
  },
});
