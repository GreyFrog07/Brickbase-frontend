import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useProperties } from '../../contexts/PropertyContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { Property } from '../../types/property';
import { router } from 'expo-router';
import GridPropertyCard from '../../components/search/GridPropertyCard';
import CompactPropertyCard from '../../components/search/CompactPropertyCard';
import { GridSkeletonCard, CompactSkeletonCard } from '../../components/search/SkeletonCard';
import WhatsAppShareModal from '../../components/property/WhatsAppShareModal';
import { usePropertyFilters } from '../../hooks/usePropertyFilters';
import PropertyFilters from '../../components/filters/PropertyFilters';

export default function SearchScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { properties, loading, refreshing, syncing, onRefresh } = useProperties();
  const { currentOrg } = useOrganization();
  const [shareProperty, setShareProperty] = useState<Property | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  // 'all' = personal + org, 'personal' = only mine, 'org' = only org shared
  const [orgFilter, setOrgFilter] = useState<'all' | 'personal' | 'org'>('all');

  // Apply org filter before passing to the text/field filter hook
  const orgFilteredProperties = useMemo(() => {
    if (!currentOrg || orgFilter === 'all') return properties;
    if (orgFilter === 'org') return properties.filter(p => p.orgId === currentOrg.id);
    // 'personal' = properties that belong to this user only (no org share)
    return properties.filter(p => !p.orgId || p.orgId !== currentOrg.id);
  }, [properties, currentOrg, orgFilter]);

  const {
    filters,
    setFilter,
    clearFilters,
    filteredProperties,
    hasActiveFilters,
    addressOptions,
    getPropertyTypes,
  } = usePropertyFilters(orgFilteredProperties);

  const handlePropertyPress = (property: Property) => {
    router.push({
      pathname: '/property-details',
      params: { propertyId: property.id },
    });
  };

  const skeletonFooter = useCallback(() => {
    if (!syncing && !loading) return null;
    if (viewMode === 'grid') {
      return (
        <View style={styles.skeletonFooter}>
          <View style={styles.gridRow}>
            <GridSkeletonCard />
            <GridSkeletonCard />
          </View>
          <View style={[styles.gridRow, { marginTop: 10 }]}>
            <GridSkeletonCard />
            <GridSkeletonCard />
          </View>
        </View>
      );
    }
    return (
      <View style={styles.skeletonFooter}>
        <CompactSkeletonCard />
        <View style={{ height: 10 }} />
        <CompactSkeletonCard />
        <View style={{ height: 10 }} />
        <CompactSkeletonCard />
      </View>
    );
  }, [syncing, loading, viewMode]);

  const renderItem = useCallback(({ item }: { item: Property }) => {
    if (viewMode === 'grid') {
      return (
        <GridPropertyCard
          property={item}
          onPress={() => handlePropertyPress(item)}
          onShare={() => setShareProperty(item)}
        />
      );
    }
    return (
      <View style={styles.listItemWrapper}>
        <CompactPropertyCard
          property={item}
          onPress={() => handlePropertyPress(item)}
          onShare={() => setShareProperty(item)}
        />
      </View>
    );
  }, [viewMode]);

  const listHeader = useMemo(() => (
    <>
      {/* Search Bar */}
      <View style={styles.searchSection}>
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => setShowFilters(!showFilters)}
          activeOpacity={0.8}
        >
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search properties..."
            placeholderTextColor="#666"
            value={filters.searchQuery}
            onChangeText={v => setFilter('searchQuery', v)}
            onFocus={() => setShowFilters(true)}
          />
          <TouchableOpacity onPress={() => setShowFilters(!showFilters)}>
            <Ionicons
              name={showFilters ? "chevron-up" : "options-outline"}
              size={22}
              color="#fff"
            />
          </TouchableOpacity>
        </TouchableOpacity>

        {hasActiveFilters && (
          <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
            <Ionicons name="close-circle" size={16} color="#ff4444" />
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Expanded Filters */}
      {showFilters && (
        <PropertyFilters
          filters={filters}
          setFilter={setFilter}
          clearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
          addressOptions={addressOptions}
          getPropertyTypes={getPropertyTypes}
          variant="inline"
        />
      )}

      {/* Org filter chips — only shown when user is in an org */}
      {currentOrg && (
        <View style={styles.orgFilterRow}>
          {(['all', 'personal', 'org'] as const).map(option => (
            <TouchableOpacity
              key={option}
              style={[styles.orgFilterChip, orgFilter === option && styles.orgFilterChipActive]}
              onPress={() => setOrgFilter(option)}
            >
              <Text style={[styles.orgFilterChipText, orgFilter === option && styles.orgFilterChipTextActive]}>
                {option === 'all' ? 'All' : option === 'personal' ? 'Personal' : currentOrg.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Results Count + View Toggle */}
      <View style={styles.resultsRow}>
        <Text style={styles.resultsCount}>
          {filteredProperties.length} {filteredProperties.length === 1 ? 'property' : 'properties'} found
        </Text>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'grid' && styles.toggleBtnActive]}
            onPress={() => setViewMode('grid')}
          >
            <Ionicons name="grid-outline" size={18} color={viewMode === 'grid' ? '#fff' : '#666'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons name="list-outline" size={18} color={viewMode === 'list' ? '#fff' : '#666'} />
          </TouchableOpacity>
        </View>
      </View>
    </>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [showFilters, filters, filteredProperties.length, viewMode, hasActiveFilters, addressOptions, getPropertyTypes, currentOrg, orgFilter]);

  // Show skeleton cards on first load (no cached data yet)
  if (loading && properties.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.scrollContent}>
          {listHeader}
          {skeletonFooter()}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        key={viewMode}
        data={filteredProperties}
        numColumns={viewMode === 'grid' ? 2 : 1}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={64} color="#666" />
            <Text style={styles.emptyText}>No properties found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
          </View>
        }
        columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={skeletonFooter}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 60 }
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews
      />

      {/* WhatsApp Share Modal */}
      {shareProperty && (
        <WhatsAppShareModal
          visible={!!shareProperty}
          property={shareProperty}
          onClose={() => setShareProperty(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  scrollContent: {
    paddingBottom: 16,
  },
  searchSection: {
    padding: 16,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    padding: 8,
    marginTop: 4,
  },
  clearButtonText: {
    color: '#ff4444',
    fontSize: 14,
  },
  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resultsCount: {
    color: '#999',
    fontSize: 14,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },
  toggleBtn: {
    padding: 7,
    paddingHorizontal: 10,
  },
  toggleBtnActive: {
    backgroundColor: '#333',
  },
  gridRow: {
    paddingHorizontal: 16,
    gap: 10,
  },
  listItemWrapper: {
    paddingHorizontal: 16,
  },
  separator: {
    height: 10,
  },
  skeletonFooter: {
    paddingTop: 10,
    paddingBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 4,
  },
  orgFilterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  orgFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  orgFilterChipActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  orgFilterChipText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '500',
  },
  orgFilterChipTextActive: {
    color: '#000',
  },
});
