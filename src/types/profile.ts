export type UserProfile = {
  id: string;
  fullName: string;
  username: string;
  schoolId: string;
  classId: string;
  sectionId: string;
  userCode: string;
  avatarUrl: string | null;
  profileEditCount: number;
  isAdmin: boolean;
  isBanned: boolean;
  bannedAt: string | null;
  bannedReason: string | null;
  createdAt: string | null;
};

export type CompleteProfileInput = {
  fullName: string;
  schoolId: string;
  classLabel: string;
  sectionId: string;
};
