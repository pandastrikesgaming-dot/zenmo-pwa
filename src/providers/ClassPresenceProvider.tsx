import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';

type ClassPresenceUser = {
  user_id: string;
  full_name: string;
  school_id: string;
  class_id: string;
  section_id: string;
  last_seen: string;
};

type PresenceMeta = ClassPresenceUser & {
  phx_ref?: string;
  presence_ref?: string;
};

type ClassPresenceContextValue = {
  activeUsers: ClassPresenceUser[];
  activeCount: number;
  isUserActive: (userId: string) => boolean;
};

const ClassPresenceContext = createContext<ClassPresenceContextValue | undefined>(undefined);

function uniquePresenceUsers(users: ClassPresenceUser[]) {
  const byUserId = new Map<string, ClassPresenceUser>();

  users.forEach((presenceUser) => {
    if (presenceUser.user_id) {
      byUserId.set(presenceUser.user_id, presenceUser);
    }
  });

  return Array.from(byUserId.values());
}

function flattenPresenceState(state: Record<string, PresenceMeta[]>) {
  return Object.values(state)
    .flat()
    .filter((presenceUser): presenceUser is PresenceMeta => Boolean(presenceUser?.user_id))
    .map((presenceUser) => ({
      user_id: presenceUser.user_id,
      full_name: presenceUser.full_name,
      school_id: presenceUser.school_id,
      class_id: presenceUser.class_id,
      section_id: presenceUser.section_id,
      last_seen: presenceUser.last_seen,
    }));
}

export function ClassPresenceProvider({ children }: PropsWithChildren) {
  const { profile, user } = useAuth();
  const [activeUsers, setActiveUsers] = useState<ClassPresenceUser[]>([]);

  const schoolId = profile?.schoolId?.trim() ?? '';
  const classId = profile?.classId?.trim() ?? '';
  const sectionId = profile?.sectionId?.trim() ?? '';

  useEffect(() => {
    if (!user?.id || !profile?.fullName || !schoolId || !classId || !sectionId) {
      setActiveUsers([]);
      return;
    }

    const channel = supabase.channel(`presence:${schoolId}:${classId}:${sectionId}`, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState() as Record<string, PresenceMeta[]>;
      setActiveUsers(uniquePresenceUsers(flattenPresenceState(state)));
    });

    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') {
        return;
      }

      void channel.track({
        user_id: user.id,
        full_name: profile.fullName,
        school_id: schoolId,
        class_id: classId,
        section_id: sectionId,
        last_seen: new Date().toISOString(),
      });
    });

    return () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
      setActiveUsers([]);
    };
  }, [classId, profile?.fullName, schoolId, sectionId, user?.id]);

  const value = useMemo<ClassPresenceContextValue>(() => {
    const activeClassmates = activeUsers.filter((presenceUser) => presenceUser.user_id !== user?.id);

    return {
      activeUsers,
      activeCount: activeClassmates.length,
      isUserActive: (userId: string) =>
        activeUsers.some((presenceUser) => presenceUser.user_id === userId),
    };
  }, [activeUsers, user?.id]);

  return (
    <ClassPresenceContext.Provider value={value}>
      {children}
    </ClassPresenceContext.Provider>
  );
}

export function useClassPresence() {
  const context = useContext(ClassPresenceContext);

  if (!context) {
    throw new Error('useClassPresence must be used within a ClassPresenceProvider.');
  }

  return context;
}
