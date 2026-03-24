import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import {
  Property,
  PropertyCategory,
  PropertyType,
  CaseType,
  RESIDENTIAL_PROPERTY_TYPES,
  COMMERCIAL_PROPERTY_TYPES,
  CASE_TYPES,
} from '../../types/property';
import { router, useFocusEffect } from 'expo-router';
import GridPropertyCard from '../../components/search/GridPropertyCard';
import CompactPropertyCard from '../../components/search/CompactPropertyCard';
import WhatsAppShareModal from '../../components/property/WhatsAppShareModal';
import api from '../../lib/api';
import {
  getCachedProperties,
  cacheProperties,
  isCacheValid,
  shouldRefreshCache,
  resetRefreshFlag,
} from '../../lib/cache';

export default function SearchScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [properties, setProperties] = useState<Property[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shareProperty, setShareProperty] = useState<Property | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyCategory, setPropertyCategory] = useState<PropertyCategory | ''>('');
  const [selectedType, setSelectedType] = useState<PropertyType | ''>('');
  const [caseType, setCaseType] = useState<CaseType | ''>('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  // Load from cache first, then check if refresh needed
  useFocusEffect(
    useCallback(() => {
      loadPropertiesWithCache();
    }, [])
  );

  useEffect(() => {
    applyFilters();
  }, [minPrice, maxPrice, selectedType, searchQuery, properties, propertyCategory, caseType]);

  const loadPropertiesWithCache = async () => {
    // First, try to load from cache for instant display
    const cached = await getCachedProperties();
    if (cached && cached.length > 0) {
      setProperties(cached);
      setLoading(false);
      setInitialLoadDone(true);
      
      // Check if we need to refresh (new property added)
      if (shouldRefreshCache()) {
        fetchPropertiesInBackground();
      }
    } else {
      // No cache, need to fetch
      await fetchProperties();
    }
  };

  const fetchPropertiesInBackground = async () => {
    try {
      const params = new URLSearchParams();
      const response = await api.get(`/properties?${params.toString()}`);
      
      const allProperties = response.data || [];
      
      // Update cache
      await cacheProperties(allProperties);
      resetRefreshFlag();
      
      // Update state
      setProperties(allProperties);
    } catch (error) {
      console.error('Background fetch error:', error);
    }
  };

  const fetchProperties = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      const response = await api.get(`/properties?${params.toString()}`);
      
      const allProperties = response.data || [];
      
      // Cache for future use
      await cacheProperties(allProperties);
      resetRefreshFlag();
      
      setProperties(allProperties);
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
      setInitialLoadDone(true);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams();
      const response = await api.get(`/properties?${params.toString()}`);
      
      const allProperties = response.data || [];
      await cacheProperties(allProperties);
      resetRefreshFlag();
      setProperties(allProperties);
    } catch (error) {
      console.error('Error refreshing properties:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...properties];

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
      filtered = filtered.filter(p => {
        if (p.floors && p.floors.length > 0) {
          return p.floors.some(f => f.price >= parseFloat(minPrice));
        }
        return p.price && p.price >= parseFloat(minPrice);
      });
    }
    if (maxPrice) {
      filtered = filtered.filter(p => {
        if (p.floors && p.floors.length > 0) {
          return p.floors.some(f => f.price <= parseFloat(maxPrice));
        }
        return p.price && p.price <= parseFloat(maxPrice);
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

    setFilteredProperties(filtered);
  };

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

  // Show loading only on first load
  if (loading && !initialLoadDone) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 60 }
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
      >
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
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipContainer}>
                  <TouchableOpacity
                    style={[styles.chip, !propertyCategory && styles.chipSelected]}
                    onPress={() => {
                      setPropertyCategory('');
                      setSelectedType('');
                    }}
                  >
                    <Text style={[styles.chipText, !propertyCategory && styles.chipTextSelected]}>All</Text>
                  </TouchableOpacity>
                  {(['Residential', 'Commercial'] as PropertyCategory[]).map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.chip, propertyCategory === cat && styles.chipSelected]}
                      onPress={() => {
                        setPropertyCategory(cat);
                        setSelectedType('');
                      }}
                    >
                      <Text style={[styles.chipText, propertyCategory === cat && styles.chipTextSelected]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Property Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipContainer}>
                  <TouchableOpacity
                    style={[styles.chip, !selectedType && styles.chipSelected]}
                    onPress={() => setSelectedType('')}
                  >
                    <Text style={[styles.chipText, !selectedType && styles.chipTextSelected]}>All</Text>
                  </TouchableOpacity>
                  {getPropertyTypes().map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.chip, selectedType === type && styles.chipSelected]}
                      onPress={() => setSelectedType(type)}
                    >
                      <Text style={[styles.chipText, selectedType === type && styles.chipTextSelected]}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Case Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipContainer}>
                  <TouchableOpacity
                    style={[styles.chip, !caseType && styles.chipSelected]}
                    onPress={() => setCaseType('')}
                  >
                    <Text style={[styles.chipText, !caseType && styles.chipTextSelected]}>All</Text>
                  </TouchableOpacity>
                  {CASE_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.chip, caseType === type && styles.chipSelected]}
                      onPress={() => setCaseType(type)}
                    >
                      <Text style={[styles.chipText, caseType === type && styles.chipTextSelected]}>
                        {type.replace(/_/g, ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
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

        {/* Properties */}
        {filteredProperties.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={64} color="#666" />
            <Text style={styles.emptyText}>No properties found</Text>
            <Text style={styles.emptySubtext}>
              Try adjusting your filters
            </Text>
          </View>
        ) : viewMode === 'grid' ? (
          <View style={styles.gridContainer}>
            {filteredProperties.map((property) => (
              <GridPropertyCard
                key={property.id}
                property={property}
                onPress={() => handlePropertyPress(property)}
                onShare={() => setShareProperty(property)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.listContainer}>
            {filteredProperties.map((property) => (
              <CompactPropertyCard
                key={property.id}
                property={property}
                onPress={() => handlePropertyPress(property)}
                onShare={() => setShareProperty(property)}
              />
            ))}
          </View>
        )}
      </ScrollView>

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
  scrollView: {
    flex: 1,
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
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
  },
  listContainer: {
    paddingHorizontal: 16,
    gap: 10,
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
