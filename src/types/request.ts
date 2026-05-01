export type NoteRequestStatus = 'open' | 'fulfilled' | 'closed';

export type NoteRequest = {
  id: string;
  userId: string;
  userName: string;
  schoolId: string;
  classId: string;
  sectionId: string;
  subject: string;
  title: string;
  description: string;
  status: NoteRequestStatus;
  createdAt: string;
  createdLabel: string;
  fulfilledByUserId: string | null;
  fulfilledByNoteId: string | null;
  fulfilledAt: string | null;
  fulfilledLabel: string | null;
  accentColor: string;
};

export type CreateNoteRequestInput = {
  userId: string;
  userName: string;
  schoolId: string;
  classId: string;
  sectionId: string;
  subject: string;
  title: string;
  description?: string;
};

export type FetchScopedNoteRequestsInput = {
  schoolId: string;
  classId: string;
  sectionId: string;
  status?: NoteRequestStatus;
};

export type FetchNoteRequestByIdInput = {
  requestId: string;
  schoolId: string;
  classId: string;
  sectionId: string;
};

export type UpdateOwnedNoteRequestStatusInput = {
  requestId: string;
  userId: string;
  status: NoteRequestStatus;
};

export type MarkRequestFulfilledInput = {
  requestId: string;
  noteId: string;
};

export type DeleteOwnedNoteRequestInput = {
  requestId: string;
  userId: string;
};
