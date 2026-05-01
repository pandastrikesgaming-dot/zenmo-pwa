import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from '../types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

let pendingNavigationAction: (() => void) | null = null;

function runOrQueue(action: () => void) {
  if (navigationRef.isReady()) {
    action();
    return;
  }

  pendingNavigationAction = action;
}

export function flushPendingNavigationAction() {
  if (!navigationRef.isReady() || !pendingNavigationAction) {
    return;
  }

  const action = pendingNavigationAction;
  pendingNavigationAction = null;
  action();
}

export function navigateToRequestsFeed() {
  runOrQueue(() => {
    navigationRef.navigate('MainTabs', {
      screen: 'Requests',
    });
  });
}

export function navigateToRequestDetail(requestId: string) {
  runOrQueue(() => {
    navigationRef.navigate('MainTabs', {
      screen: 'Requests',
      params: {
        screen: 'RequestDetail',
        params: {
          requestId,
        },
      },
    });
  });
}
