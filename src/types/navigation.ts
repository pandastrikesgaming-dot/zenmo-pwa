import type { NavigatorScreenParams } from '@react-navigation/native';

import type { RecentNote } from './home';
import type { DmUser } from './message';

export type RequestsStackParamList = {
  RequestsFeed: undefined;
  RequestNote: undefined;
  RequestDetail: {
    requestId: string;
  };
};

export type RootTabParamList = {
  Home: undefined;
  Requests: NavigatorScreenParams<RequestsStackParamList> | undefined;
  Upload:
    | {
        requestId?: string;
        requestTitle?: string;
        requestSubject?: string;
      }
    | undefined;
  Messages: NavigatorScreenParams<MessagesStackParamList> | undefined;
  Profile: undefined;
};

export type MessagesStackParamList = {
  ChatList: undefined;
  Classmates: undefined;
  EnterCode: undefined;
  Chat: {
    targetUser: DmUser;
    connectCode?: string;
  };
};

export type RootStackParamList = {
  AdminReports: undefined;
  Auth: undefined;
  BannedAccount: undefined;
  ProfileSetup: undefined;
  MainTabs: NavigatorScreenParams<RootTabParamList> | undefined;
  Messages: NavigatorScreenParams<MessagesStackParamList> | undefined;
  NoteDetail: {
    note: RecentNote;
  };
};
