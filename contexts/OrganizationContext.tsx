import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { Organization } from '../types/property';
import api from '../lib/api';
import { useAuth } from './AuthContext';

interface OrganizationContextType {
  organizations: Organization[];
  loadingOrgs: boolean;
  // The "active" org — the first org the user is in (most brokers only have one)
  currentOrg: Organization | null;
  fetchOrganizations: () => Promise<void>;
  createOrganization: (name: string) => Promise<Organization | null>;
  joinOrganization: (inviteCode: string) => Promise<Organization | null>;
  leaveOrganization: (orgId: string) => Promise<void>;
  removeMember: (orgId: string, userId: string) => Promise<void>;
  regenerateInviteCode: (orgId: string) => Promise<string | null>;
  deleteOrganization: (orgId: string) => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType>({
  organizations: [],
  loadingOrgs: false,
  currentOrg: null,
  fetchOrganizations: async () => {},
  createOrganization: async () => null,
  joinOrganization: async () => null,
  leaveOrganization: async () => {},
  removeMember: async () => {},
  regenerateInviteCode: async () => null,
  deleteOrganization: async () => {},
});

export const useOrganization = () => useContext(OrganizationContext);

export const OrganizationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  const currentOrg = organizations.length > 0 ? organizations[0] : null;

  useEffect(() => {
    if (user) {
      fetchOrganizations();
    } else {
      setOrganizations([]);
    }
  }, [user]);

  const fetchOrganizations = useCallback(async () => {
    if (!user) return;
    setLoadingOrgs(true);
    try {
      const response = await api.get('/organizations/me');
      setOrganizations(response.data || []);
    } catch (error) {
      console.error('Error fetching organizations:', error);
    } finally {
      setLoadingOrgs(false);
    }
  }, [user]);

  const createOrganization = useCallback(async (name: string): Promise<Organization | null> => {
    try {
      const response = await api.post('/organizations', { name });
      const org: Organization = response.data;
      setOrganizations(prev => [org, ...prev]);
      return org;
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Failed to create organization';
      Alert.alert('Error', msg);
      return null;
    }
  }, []);

  const joinOrganization = useCallback(async (inviteCode: string): Promise<Organization | null> => {
    try {
      const response = await api.post('/organizations/join', { inviteCode });
      const org: Organization = response.data;
      setOrganizations(prev => {
        const existing = prev.find(o => o.id === org.id);
        if (existing) return prev.map(o => o.id === org.id ? org : o);
        return [org, ...prev];
      });
      return org;
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Failed to join organization';
      Alert.alert('Error', msg);
      return null;
    }
  }, []);

  const leaveOrganization = useCallback(async (orgId: string) => {
    if (!user) return;
    try {
      await api.delete(`/organizations/${orgId}/members/${user.id}`);
      setOrganizations(prev => prev.filter(o => o.id !== orgId));
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Failed to leave organization';
      Alert.alert('Error', msg);
    }
  }, [user]);

  const removeMember = useCallback(async (orgId: string, userId: string) => {
    try {
      await api.delete(`/organizations/${orgId}/members/${userId}`);
      setOrganizations(prev => prev.map(o => {
        if (o.id !== orgId) return o;
        return { ...o, members: o.members.filter(m => m.userId !== userId) };
      }));
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Failed to remove member';
      Alert.alert('Error', msg);
    }
  }, []);

  const regenerateInviteCode = useCallback(async (orgId: string): Promise<string | null> => {
    try {
      const response = await api.post(`/organizations/${orgId}/regenerate-invite`);
      const newCode: string = response.data.inviteCode;
      setOrganizations(prev => prev.map(o =>
        o.id === orgId ? { ...o, inviteCode: newCode } : o
      ));
      return newCode;
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Failed to regenerate invite code';
      Alert.alert('Error', msg);
      return null;
    }
  }, []);

  const deleteOrganization = useCallback(async (orgId: string) => {
    try {
      await api.delete(`/organizations/${orgId}`);
      setOrganizations(prev => prev.filter(o => o.id !== orgId));
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Failed to delete organization';
      Alert.alert('Error', msg);
    }
  }, []);

  return (
    <OrganizationContext.Provider value={{
      organizations,
      loadingOrgs,
      currentOrg,
      fetchOrganizations,
      createOrganization,
      joinOrganization,
      leaveOrganization,
      removeMember,
      regenerateInviteCode,
      deleteOrganization,
    }}>
      {children}
    </OrganizationContext.Provider>
  );
};
