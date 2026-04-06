import React, { useState, useMemo, useCallback } from 'react';
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
import {
  Property,
  PropertyCategory,
  PropertyType,
  CaseType,
  RESIDENTIAL_PROPERTY_TYPES,
  COMMERCIAL_PROPERTY_TYPES,
  CASE_TYPES,
} from '../../types/property';
import { router } from 'expo-router';
import GridPropertyCard from '../../components/search/GridPropertyCard';
import CompactPropertyCard from '../../components/search/CompactPropertyCard';
import { GridSkeletonCard, CompactSkeletonCard } from '../../components/search/SkeletonCard';
import WhatsAppShareModal from '../../components/property/WhatsAppShareModal';

export default function SearchScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { properties, loading, refreshing, syncing, onRefresh } = useProperties();
  const [shareProperty, setShareProperty] = useState<Property | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyCategory, setPropertyCategory] = useState<PropertyCategory | ''>('');
  const [selectedType, setSelectedType] = useState<PropertyType | ''>('');
  const [caseType, setCaseType] = useState<CaseType | ''>('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  // Compute filtered list synchronously — no extra render cycle
  const filteredProperties = useMemo(() => {
    let filtered = properties;

    if (propertyCategory) {
      filtered = filtered.filter(p => p.propertyCategory === propertyCategory);
    }
    if (selectedType) {
      filtered = filtered.filter(p => p.propertyType === selectedType);
    }
    if (caseType) {
      filtered = filtered.filter(p => p.case === caseType);
    }
    if (minPrice) {
      const min = parseFloat(minPrice);
      filtered = filtered.filter(p => {
        if (p.floors && p.floors.length > 0) {
          return p.floors.some(f => f.price >= min);
        }
        return p.price && p.price >= min;
      });
    }
    if (maxPrice) {
      const max = parseFloat(maxPrice);
      filtered = filtered.filter(p => {
        if (p.floors && p.floors.length > 0) {
          return p.floors.some(f => f.price <= max);
        }
        return p.price && p.price <= max;
      });
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.propertyType?.toLowerCase().includes(query) ||
        p.propertyCategory?.toLowerCase().includes(query) ||
        p.price?.toString().includes(query) ||
        p.address?.city?.toLowerCase().includes(query) ||
        p.address?.sector?.toLowerCase().includes(query) ||
        p.builderName?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [properties, searchQuery, propertyCategory, selectedType, caseType, minPrice, maxPrice]);

  const clearFilters = () => {
    setSearchQuery('');
    setPropertyCategory('');
    setSelectedType('');
    setCaseType('');
    setMinPrice('');
    setMaxPrice('');
  };

  const hasActiveFilters = !!(searchQuery || propertyCategory || selectedType || caseType || minPrice || maxPrice);

  const handlePropertyPress = (property: Property) => {
    router.push({
      pathname: '/property-details',
      params: { propertyId: property.id },
    });
  };

  const getPropertyTypes = (): PropertyType[] => {
    if (propertyCategory === 'Residential') {
      return RESIDENTIAL_PROPERTY_TYPES;
    } else if (propertyCategory === 'Commercial') {
      return COMMERCIAL_PROPERTY_TYPES;
    }
    return [...RESIDENTIAL_PROPERTY_TYPES, ...COMMERCIAL_PROPERTY_TYPES];
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

  const listHeader = (
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
            value={searchQuery}
            onChangeText={setSearchQuery}
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
        <View style={styles.filtersContainer}>
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Property Category</Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={['', 'Residential', 'Commercial'] as (PropertyCategory | '')[]}
              keyExtractor={(item) => item || 'all'}
              renderItem={({ item: cat }) => (
                <TouchableOpacity
                  style={[styles.chip, (cat === '' ? !propertyCategory : propertyCategory === cat) && styles.chipSelected]}
                  onPress={() => { setPropertyCategory(cat as PropertyCategory | ''); setSelectedType(''); }}
                >
                  <Text style={[styles.chipText, (cat === '' ? !propertyCategory : propertyCategory === cat) && styles.chipTextSelected]}>
                    {cat || 'All'}
                  </Text>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.chipContainer}
            />
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Property Type</Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={['', ...getPropertyTypes()] as (PropertyType | '')[]}
              keyExtractor={(item) => item || 'all'}
              renderItem={({ item: type }) => (
                <TouchableOpacity
                  style={[styles.chip, (type === '' ? !selectedType : selectedType === type) && styles.chipSelected]}
                  onPress={() => setSelectedType(type as PropertyType | '')}
                >
                  <Text style={[styles.chipText, (type === '' ? !selectedType : selectedType === type) && styles.chipTextSelected]}>
                    {type || 'All'}
                  </Text>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.chipContainer}
            />
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Case Type</Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={['', ...CASE_TYPES] as (CaseType | '')[]}
              keyExtractor={(item) => item || 'all'}
              renderItem={({ item: type }) => (
                <TouchableOpacity
                  style={[styles.chip, (type === '' ? !caseType : caseType === type) && styles.chipSelected]}
                  onPress={() => setCaseType(type as CaseType | '')}
                >
                  <Text style={[styles.chipText, (type === '' ? !caseType : caseType === type) && styles.chipTextSelected]}>
                    {(type || 'All').replace(/_/g, ' ')}
                  </Text>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.chipContainer}
            />
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Price Range (Cr)</Text>
            <View style={styles.priceContainer}>
              <View style={styles.priceInput}>
                <TextInput
                  style={styles.input}
                  placeholder="Min"
                  placeholderTextColor="#666"
                  value={minPrice}
                  onChangeText={setMinPrice}
                  keyboardType="decimal-pad"
                />
              </View>
              <Text style={styles.priceSeparator}>-</Text>
              <View style={styles.priceInput}>
                <TextInput
                  style={styles.input}
                  placeholder="Max"
                  placeholderTextColor="#666"
                  value={maxPrice}
                  onChangeText={setMaxPrice}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </View>
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
  );

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
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  filtersContainer: {
    backgroundColor: '#0c0c0c',
    padding: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '600',
  },
  chipContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  chipText: {
    color: '#fff',
    fontSize: 13,
  },
  chipTextSelected: {
    color: '#000',
    fontWeight: '600',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priceInput: {
    flex: 1,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    fontSize: 14,
  },
  priceSeparator: {
    color: '#666',
    fontSize: 20,
  },
  soldToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  soldToggleText: {
    color: '#fff',
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
});
