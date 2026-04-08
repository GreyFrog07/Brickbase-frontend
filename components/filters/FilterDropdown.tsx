import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FilterDropdownProps {
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
}

export default function FilterDropdown({
  label,
  value,
  options,
  onSelect,
  placeholder,
  keyboardType = 'default',
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = search
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  const handleSelect = (val: string) => {
    onSelect(val);
    setSearch('');
    setOpen(false);
  };

  const handleClear = () => {
    onSelect('');
    setSearch('');
    setOpen(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.selectorText, !value && styles.placeholderText]} numberOfLines={1}>
          {value || placeholder || `Select ${label}`}
        </Text>
        <View style={styles.selectorIcons}>
          {value ? (
            <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color="#666" />
            </TouchableOpacity>
          ) : null}
          <Ionicons name="chevron-down" size={14} color="#666" />
        </View>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => { setOpen(false); setSearch(''); }}
        >
          <View style={styles.dropdown} onStartShouldSetResponder={() => true}>
            <Text style={styles.dropdownTitle}>{label}</Text>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={16} color="#666" />
              <TextInput
                style={styles.searchInput}
                placeholder={`Search or enter ${label.toLowerCase()}...`}
                placeholderTextColor="#555"
                value={search}
                onChangeText={setSearch}
                keyboardType={keyboardType}
                autoFocus
              />
            </View>

            <ScrollView style={styles.optionsList} keyboardShouldPersistTaps="handled">
              {filtered.map(option => (
                <TouchableOpacity
                  key={option}
                  style={[styles.option, value === option && styles.optionSelected]}
                  onPress={() => handleSelect(option)}
                >
                  <Text style={[styles.optionText, value === option && styles.optionTextSelected]}>
                    {option}
                  </Text>
                  {value === option && <Ionicons name="checkmark" size={16} color="#000" />}
                </TouchableOpacity>
              ))}
              {filtered.length === 0 && search.trim() !== '' && (
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => handleSelect(search.trim())}
                >
                  <Text style={styles.optionText}>Use "{search.trim()}"</Text>
                  <Ionicons name="add-circle-outline" size={16} color="#999" />
                </TouchableOpacity>
              )}
            </ScrollView>

            {value ? (
              <TouchableOpacity style={styles.clearRow} onPress={handleClear}>
                <Ionicons name="close-circle-outline" size={16} color="#ff4444" />
                <Text style={styles.clearRowText}>Clear selection</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    color: '#999',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectorText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  placeholderText: {
    color: '#555',
  },
  selectorIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  dropdown: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    maxHeight: 400,
    borderWidth: 1,
    borderColor: '#333',
  },
  dropdownTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0c0c0c',
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingVertical: 10,
    paddingLeft: 8,
  },
  optionsList: {
    maxHeight: 240,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 2,
  },
  optionSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  optionText: {
    color: '#fff',
    fontSize: 14,
  },
  optionTextSelected: {
    fontWeight: '600',
  },
  clearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
    marginTop: 4,
  },
  clearRowText: {
    color: '#ff4444',
    fontSize: 13,
  },
});
