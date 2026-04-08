import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  PropertyCategory,
  PropertyType,
  CaseType,
  SizeUnit,
  CASE_TYPES,
  SIZE_UNITS,
} from '../../types/property';
import { FilterState } from '../../hooks/usePropertyFilters';
import FilterDropdown from './FilterDropdown';

const AREA_TYPES: { label: string; value: FilterState['areaType'] }[] = [
  { label: 'Any', value: '' },
  { label: 'Carpet', value: 'carpet' },
  { label: 'Built-up', value: 'builtup' },
  { label: 'Super Built-up', value: 'superbuiltup' },
];

interface PropertyFiltersProps {
  filters: FilterState;
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  addressOptions: {
    cities: string[];
    sectors: string[];
    blocks: string[];
    areas: string[];
    unitNos: string[];
  };
  getPropertyTypes: () => PropertyType[];
  variant: 'inline' | 'panel';
}

export default function PropertyFilters({
  filters,
  setFilter,
  clearFilters,
  hasActiveFilters,
  addressOptions,
  getPropertyTypes,
  variant,
}: PropertyFiltersProps) {
  const isPanel = variant === 'panel';

  const chipStyle = isPanel ? styles.chipPanel : styles.chipInline;
  const chipSelectedStyle = styles.chipSelected;
  const chipTextStyle = isPanel ? styles.chipTextPanel : styles.chipTextInline;
  const chipTextSelectedStyle = styles.chipTextSelected;

  const renderChip = (
    label: string,
    selected: boolean,
    onPress: () => void,
  ) => (
    <TouchableOpacity
      key={label}
      style={[chipStyle, selected && chipSelectedStyle]}
      onPress={onPress}
    >
      <Text style={[chipTextStyle, selected && chipTextSelectedStyle]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={isPanel ? styles.panelScroll : undefined}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={isPanel ? styles.containerPanel : styles.containerInline}>
        {/* Header with clear */}
        {isPanel && (
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Filters</Text>
            {hasActiveFilters && (
              <TouchableOpacity onPress={clearFilters}>
                <Text style={styles.clearTextSmall}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Property Category */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {renderChip('All', !filters.propertyCategory, () => setFilter('propertyCategory', ''))}
              {(['Residential', 'Commercial'] as PropertyCategory[]).map(cat =>
                renderChip(cat, filters.propertyCategory === cat, () => setFilter('propertyCategory', cat))
              )}
            </View>
          </ScrollView>
        </View>

        {/* Property Type */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {renderChip('All', !filters.selectedType, () => setFilter('selectedType', ''))}
              {getPropertyTypes().map(type =>
                renderChip(type, filters.selectedType === type, () => setFilter('selectedType', type))
              )}
            </View>
          </ScrollView>
        </View>

        {/* Case Type */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Case Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {renderChip('All', !filters.caseType, () => setFilter('caseType', '' as CaseType | ''))}
              {CASE_TYPES.map(type =>
                renderChip(
                  type.replace(/_/g, ' '),
                  filters.caseType === type,
                  () => setFilter('caseType', type),
                )
              )}
            </View>
          </ScrollView>
        </View>

        {/* Price Range */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Price Range (Cr)</Text>
          <View style={styles.rangeRow}>
            <TextInput
              style={[styles.input, styles.rangeInput]}
              placeholder="Min"
              placeholderTextColor="#555"
              value={filters.minPrice}
              onChangeText={v => setFilter('minPrice', v)}
              keyboardType="decimal-pad"
            />
            <Text style={styles.rangeSeparator}>—</Text>
            <TextInput
              style={[styles.input, styles.rangeInput]}
              placeholder="Max"
              placeholderTextColor="#555"
              value={filters.maxPrice}
              onChangeText={v => setFilter('maxPrice', v)}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* ── Address (Cascading Dropdowns) ── */}
        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>Address</Text>

        <FilterDropdown
          label="City"
          value={filters.city}
          options={addressOptions.cities}
          onSelect={v => setFilter('city', v)}
          placeholder="Select city"
        />
        <FilterDropdown
          label="Sector"
          value={filters.sector}
          options={addressOptions.sectors}
          onSelect={v => setFilter('sector', v)}
          placeholder={filters.city ? 'Select sector' : 'Select city first'}
          keyboardType="default"
        />
        <FilterDropdown
          label="Block"
          value={filters.block}
          options={addressOptions.blocks}
          onSelect={v => setFilter('block', v)}
          placeholder={filters.sector ? 'Select block' : 'Select sector first'}
          keyboardType="default"
        />
        <FilterDropdown
          label="Area"
          value={filters.area}
          options={addressOptions.areas}
          onSelect={v => setFilter('area', v)}
          placeholder={filters.block ? 'Select area' : 'Select block first'}
        />
        <FilterDropdown
          label="Unit No"
          value={filters.unitNo}
          options={addressOptions.unitNos}
          onSelect={v => setFilter('unitNo', v)}
          placeholder="Enter unit number"
          keyboardType="numeric"
        />

        {/* ── Area Range ── */}
        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>Area Range</Text>

        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Area Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {AREA_TYPES.map(at =>
                renderChip(
                  at.label,
                  filters.areaType === at.value,
                  () => setFilter('areaType', at.value),
                )
              )}
            </View>
          </ScrollView>
        </View>

        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Unit</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {SIZE_UNITS.map(su =>
                renderChip(
                  su.label,
                  filters.areaUnit === su.value,
                  () => setFilter('areaUnit', su.value),
                )
              )}
            </View>
          </ScrollView>
        </View>

        <View style={styles.filterSection}>
          <View style={styles.rangeRow}>
            <TextInput
              style={[styles.input, styles.rangeInput]}
              placeholder="Min area"
              placeholderTextColor="#555"
              value={filters.minArea}
              onChangeText={v => setFilter('minArea', v)}
              keyboardType="decimal-pad"
            />
            <Text style={styles.rangeSeparator}>—</Text>
            <TextInput
              style={[styles.input, styles.rangeInput]}
              placeholder="Max area"
              placeholderTextColor="#555"
              value={filters.maxArea}
              onChangeText={v => setFilter('maxArea', v)}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* ── Missing Builder Number ── */}
        <View style={styles.divider} />
        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Missing Builder Number</Text>
            <Text style={styles.toggleHint}>Properties with builder name but no phone number</Text>
          </View>
          <Switch
            value={filters.missingBuilderNumber}
            onValueChange={v => setFilter('missingBuilderNumber', v)}
            trackColor={{ false: '#333', true: '#4CAF50' }}
            thumbColor={filters.missingBuilderNumber ? '#fff' : '#888'}
          />
        </View>

        {/* Clear All (inline variant only) */}
        {!isPanel && hasActiveFilters && (
          <TouchableOpacity style={styles.clearAllBtn} onPress={clearFilters}>
            <Ionicons name="close-circle" size={16} color="#ff4444" />
            <Text style={styles.clearAllText}>Clear All Filters</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 16 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Inline (search page)
  containerInline: {
    backgroundColor: '#0c0c0c',
    padding: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  // Panel (map overlay)
  containerPanel: {
    padding: 14,
  },
  panelScroll: {
    maxHeight: 480,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  panelTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  clearTextSmall: {
    color: '#999',
    fontSize: 12,
  },

  // Sections
  filterSection: {
    marginBottom: 12,
  },
  filterLabel: {
    color: '#999',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 12,
  },

  // Chips
  chipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  chipInline: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipSelected: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  chipTextInline: {
    color: '#fff',
    fontSize: 13,
  },
  chipTextPanel: {
    color: '#999',
    fontSize: 12,
  },
  chipTextSelected: {
    color: '#000',
    fontWeight: '600',
  },

  // Inputs
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rangeInput: {
    flex: 1,
  },
  rangeSeparator: {
    color: '#666',
    fontSize: 16,
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  toggleHint: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },

  // Clear all
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
  },
  clearAllText: {
    color: '#ff4444',
    fontSize: 14,
  },
});
