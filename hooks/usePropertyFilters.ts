import { useState, useMemo, useCallback } from 'react';
import {
  Property,
  PropertyCategory,
  PropertyType,
  CaseType,
  SizeUnit,
  RESIDENTIAL_PROPERTY_TYPES,
  COMMERCIAL_PROPERTY_TYPES,
} from '../types/property';

export interface FilterState {
  searchQuery: string;
  propertyCategory: PropertyCategory | '';
  selectedType: PropertyType | '';
  caseType: CaseType | '';
  minPrice: string;
  maxPrice: string;
  // Cascading address
  city: string;
  sector: string;
  block: string;
  area: string;
  unitNo: string;
  // Area range
  areaType: 'carpet' | 'builtup' | 'superbuiltup' | '';
  areaUnit: SizeUnit;
  minArea: string;
  maxArea: string;
  // Builder filter
  missingBuilderNumber: boolean;
}

const INITIAL_FILTERS: FilterState = {
  searchQuery: '',
  propertyCategory: '',
  selectedType: '',
  caseType: '',
  minPrice: '',
  maxPrice: '',
  city: '',
  sector: '',
  block: '',
  area: '',
  unitNo: '',
  areaType: '',
  areaUnit: 'sq_yards',
  minArea: '',
  maxArea: '',
  missingBuilderNumber: false,
};

// Conversion factors to sq_ft (base unit)
const TO_SQ_FT: Record<SizeUnit, number> = {
  sq_ft: 1,
  sq_yards: 9,
  sq_mts: 10.764,
};

function convertArea(value: number, from: SizeUnit, to: SizeUnit): number {
  const inSqFt = value * TO_SQ_FT[from];
  return inSqFt / TO_SQ_FT[to];
}

function getUniqueValues(properties: Property[], getter: (p: Property) => string | undefined): string[] {
  const set = new Set<string>();
  for (const p of properties) {
    const val = getter(p);
    if (val && val.trim()) set.add(val.trim());
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function usePropertyFilters(properties: Property[]) {
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);

  const setFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      // Cascading resets for address
      if (key === 'city') {
        next.sector = '';
        next.block = '';
        next.area = '';
        next.unitNo = '';
      } else if (key === 'sector') {
        next.block = '';
        next.area = '';
        next.unitNo = '';
      } else if (key === 'block') {
        next.area = '';
        next.unitNo = '';
      } else if (key === 'area') {
        next.unitNo = '';
      }
      // Reset property type when category changes
      if (key === 'propertyCategory') {
        next.selectedType = '';
      }
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
  }, []);

  // Address options derived from properties, cascading based on current selections
  const addressOptions = useMemo(() => {
    const cities = getUniqueValues(properties, p => p.address?.city);

    let cityFiltered = properties;
    if (filters.city) {
      cityFiltered = properties.filter(p =>
        p.address?.city?.trim().toLowerCase() === filters.city.toLowerCase()
      );
    }
    const sectors = getUniqueValues(cityFiltered, p => p.address?.sector);

    let sectorFiltered = cityFiltered;
    if (filters.sector) {
      sectorFiltered = cityFiltered.filter(p =>
        p.address?.sector?.trim().toLowerCase() === filters.sector.toLowerCase()
      );
    }
    const blocks = getUniqueValues(sectorFiltered, p => p.address?.block);

    let blockFiltered = sectorFiltered;
    if (filters.block) {
      blockFiltered = sectorFiltered.filter(p =>
        p.address?.block?.trim().toLowerCase() === filters.block.toLowerCase()
      );
    }
    const areas = getUniqueValues(blockFiltered, p => p.address?.area);

    let areaFiltered = blockFiltered;
    if (filters.area) {
      areaFiltered = blockFiltered.filter(p =>
        p.address?.area?.trim().toLowerCase() === filters.area.toLowerCase()
      );
    }
    const unitNos = getUniqueValues(areaFiltered, p => p.address?.unitNo);

    return { cities, sectors, blocks, areas, unitNos };
  }, [properties, filters.city, filters.sector, filters.block, filters.area]);

  const getPropertyTypes = useCallback((): PropertyType[] => {
    if (filters.propertyCategory === 'Residential') return RESIDENTIAL_PROPERTY_TYPES;
    if (filters.propertyCategory === 'Commercial') return COMMERCIAL_PROPERTY_TYPES;
    return [...RESIDENTIAL_PROPERTY_TYPES, ...COMMERCIAL_PROPERTY_TYPES];
  }, [filters.propertyCategory]);

  // Filter properties
  const filteredProperties = useMemo(() => {
    let filtered = properties;

    if (filters.propertyCategory) {
      filtered = filtered.filter(p => p.propertyCategory === filters.propertyCategory);
    }
    if (filters.selectedType) {
      filtered = filtered.filter(p => p.propertyType === filters.selectedType);
    }
    if (filters.caseType) {
      filtered = filtered.filter(p => p.case === filters.caseType);
    }

    // Price range
    if (filters.minPrice) {
      const min = parseFloat(filters.minPrice);
      filtered = filtered.filter(p => {
        if (p.floors && p.floors.length > 0) {
          return p.floors.some(f => f.price >= min);
        }
        return p.price && p.price >= min;
      });
    }
    if (filters.maxPrice) {
      const max = parseFloat(filters.maxPrice);
      filtered = filtered.filter(p => {
        if (p.floors && p.floors.length > 0) {
          return p.floors.some(f => f.price <= max);
        }
        return p.price && p.price <= max;
      });
    }

    // Cascading address
    if (filters.city) {
      filtered = filtered.filter(p =>
        p.address?.city?.trim().toLowerCase() === filters.city.toLowerCase()
      );
    }
    if (filters.sector) {
      filtered = filtered.filter(p =>
        p.address?.sector?.trim().toLowerCase() === filters.sector.toLowerCase()
      );
    }
    if (filters.block) {
      filtered = filtered.filter(p =>
        p.address?.block?.trim().toLowerCase() === filters.block.toLowerCase()
      );
    }
    if (filters.area) {
      filtered = filtered.filter(p =>
        p.address?.area?.trim().toLowerCase() === filters.area.toLowerCase()
      );
    }
    if (filters.unitNo) {
      filtered = filtered.filter(p =>
        p.address?.unitNo?.trim().toLowerCase() === filters.unitNo.toLowerCase()
      );
    }

    // Area range filter
    if (filters.minArea || filters.maxArea) {
      const minVal = filters.minArea ? parseFloat(filters.minArea) : 0;
      const maxVal = filters.maxArea ? parseFloat(filters.maxArea) : Infinity;
      const targetUnit = filters.areaUnit;
      const targetType = filters.areaType; // '' means any type

      filtered = filtered.filter(p => {
        if (!p.sizes || p.sizes.length === 0) return false;
        return p.sizes.some(size => {
          if (targetType && size.type !== targetType) return false;
          const converted = convertArea(size.value, size.unit, targetUnit);
          return converted >= minVal && converted <= maxVal;
        });
      });
    }

    // Missing builder number
    if (filters.missingBuilderNumber) {
      filtered = filtered.filter(p => {
        const hasLegacyPhone = !!p.builderPhone;
        const hasBuilderPhone = p.builders && p.builders.some(b => !!b.phoneNumber);
        return !hasLegacyPhone && !hasBuilderPhone;
      });
    }

    // Text search (broad search across fields)
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.propertyType?.toLowerCase().includes(query) ||
        p.propertyCategory?.toLowerCase().includes(query) ||
        p.price?.toString().includes(query) ||
        p.address?.city?.toLowerCase().includes(query) ||
        p.address?.sector?.toLowerCase().includes(query) ||
        p.address?.block?.toLowerCase().includes(query) ||
        p.address?.area?.toLowerCase().includes(query) ||
        p.address?.unitNo?.toLowerCase().includes(query) ||
        p.builderName?.toLowerCase().includes(query) ||
        p.builders?.some(b => b.name?.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [properties, filters]);

  const hasActiveFilters = !!(
    filters.searchQuery || filters.propertyCategory || filters.selectedType ||
    filters.caseType || filters.minPrice || filters.maxPrice ||
    filters.city || filters.sector || filters.block || filters.area || filters.unitNo ||
    filters.minArea || filters.maxArea || filters.areaType ||
    filters.missingBuilderNumber
  );

  return {
    filters,
    setFilter,
    clearFilters,
    filteredProperties,
    hasActiveFilters,
    addressOptions,
    getPropertyTypes,
  };
}
