import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  FlatList,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MediaItem {
  type: 'photo' | 'video';
  uri: string;
}

interface FullscreenMediaViewerProps {
  visible: boolean;
  media: MediaItem[];
  initialIndex?: number;
  onClose: () => void;
}

function VideoItem({ uri, isActive }: { uri: string; isActive: boolean }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    if (isActive) p.play();
  });

  React.useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  return (
    <View style={styles.mediaPage}>
      <VideoView
        player={player}
        style={styles.video}
        nativeControls
      />
    </View>
  );
}

export default function FullscreenMediaViewer({
  visible,
  media,
  initialIndex = 0,
  onClose,
}: FullscreenMediaViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList>(null);

  React.useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      // Scroll to initial index after layout
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 50);
    }
  }, [visible, initialIndex]);

  if (!visible || media.length === 0) return null;

  const renderItem = ({ item, index }: { item: MediaItem; index: number }) => {
    if (item.type === 'video') {
      return <VideoItem uri={item.uri} isActive={index === currentIndex} />;
    }
    return (
      <View style={styles.mediaPage}>
        <Image
          source={{ uri: item.uri }}
          style={styles.image}
          resizeMode="contain"
        />
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <StatusBar hidden />
      <View style={styles.container}>
        <FlatList
          ref={flatListRef}
          data={media}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => `media-${i}`}
          renderItem={renderItem}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            setCurrentIndex(idx);
          }}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          initialScrollIndex={initialIndex}
        />

        {/* Close button */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        {/* Counter */}
        {media.length > 1 && (
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {currentIndex + 1} / {media.length}
            </Text>
          </View>
        )}

        {/* Media type indicator */}
        {media[currentIndex]?.type === 'video' && (
          <View style={styles.typeBadge}>
            <Ionicons name="videocam" size={14} color="#fff" />
            <Text style={styles.typeBadgeText}>Video</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mediaPage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.85,
  },
  video: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 8,
  },
  counter: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  counterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  typeBadge: {
    position: 'absolute',
    top: 50,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 12,
  },
});
