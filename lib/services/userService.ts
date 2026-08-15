import { UserProfile } from '@/context/AuthContext';

let currentUserState: UserProfile = {
  id: 'usr_admin_001',
  email: 'admin@nexus.security',
  full_name: 'Admin Operator',
  avatar_url: null,
  role: 'Operator',
  organization_id: 'NEXUS Enterprise Corp'
};

// Listeners to notify context of updates
type UserUpdateListener = (user: UserProfile) => void;
const listeners: Set<UserUpdateListener> = new Set();

export const userService = {
  getCurrentUser(): UserProfile {
    return currentUserState;
  },
  
  updateCurrentUser(updates: Partial<UserProfile>): UserProfile {
    currentUserState = {
      ...currentUserState,
      ...updates
    };
    
    // Notify all context listeners
    listeners.forEach((listener) => listener(currentUserState));
    
    return currentUserState;
  },
  
  subscribe(listener: UserUpdateListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }
};
