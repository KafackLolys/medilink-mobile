import type { AccountRole } from './api';

export type { AccountRole };
export type ConsultationMode = 'home' | 'teleconsultation';
export type AppointmentStatus = 'pending_confirmation' | 'confirmed' | 'completed' | 'cancelled' | 'rejected' | 'no_show';
export type NeedStatus = 'draft' | 'published' | 'awaiting_proposals' | 'proposals_received' | 'appointment_confirmed' | 'closed' | 'cancelled';
export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type DoctorVerificationStatus = 'pending' | 'verified' | 'rejected' | 'suspended';
export type AccountStatus = 'active' | 'pending' | 'suspended' | 'deleted';

export interface AuthenticatedUser {
  id: string; role: AccountRole; email: string | null; phone: string | null; status: AccountStatus;
  firstName?: string; lastName?: string; specialty?: string | null;
  registrationNumber?: string | null; emailVerified?: boolean; phoneVerified?: boolean;
}
export interface TokenResponse {
  idToken: string; refreshToken: string; expiresIn: number; tokenType: string;
}
export interface LoginResponse extends TokenResponse { user: AuthenticatedUser; message?: string }
export interface RegisterRequest {
  firstName: string; lastName: string; email: string; password: string; phone: string;
  role: 'patient' | 'doctor'; specialty?: string; registrationNumber?: string;
}
export interface DoctorAvailability { weekday: Weekday; isAvailable: boolean; startTime: string; endTime: string }
export interface DoctorDirectoryItem {
  id: string; name: string; specialty: string; bio: string; yearsOfExperience: number;
  consultationFee: number; currency: string; professionalAddress: string | null;
  serviceCity?: string | null; serviceDistricts?: string[]; blockedDates?: string[];
  appointmentDurationMinutes?: number; modes: ConsultationMode[];
  availability: DoctorAvailability[]; rating: number | null; reviewsCount: number;
}
export interface DoctorOwnProfile extends DoctorDirectoryItem {
  phone: string; email: string; registrationNumber: string; secondarySpecialties: string[];
  degrees: string[]; verificationStatus: DoctorVerificationStatus; documents: DoctorDocument[];
  completedConsultations: number;
}
export interface DoctorDocument {
  id: string; medicalDocumentId: string; name: 'medical_license' | 'medical_degree' | 'identity_document' | 'other';
  filename: string; status: 'pending' | 'approved' | 'rejected'; sizeBytes: number; downloadUrl: string | null;
}
export interface PatientAppointment {
  id: string; doctor: { id: string; name: string; specialty: string; professionalAddress: string | null };
  scheduledAt: string; durationMinutes: number; consultationMode: ConsultationMode;
  status: AppointmentStatus; fee: number; currency: string; reason: string | null;
}
export interface CreateAppointmentRequest { doctorId: string; scheduledAt: string; timeZone: string; consultationMode: ConsultationMode; reason?: string }
export interface DoctorAppointment {
  id: string; date: string; time: string; patient: string; district: string | null;
  mode: 'À domicile' | 'Téléconsultation'; status: AppointmentStatus;
}
export interface PatientNeed {
  id: string; title: string; specialty: string; createdAt: string; interested: number;
  mode: 'domicile' | 'teleconsultation'; status: NeedStatus; attachmentsCount: number;
}
export interface NeedDetail extends PatientNeed {
  description: string; symptoms: string[]; durationDescription: string | null;
  city: string; district: string; privateAddress: string | null; priority: 'normal' | 'rapide';
  attachments: Array<{ id: string; fileName: string; mimeType: string; sizeBytes: number; downloadUrl: string }>;
}
export interface DoctorNeed {
  id: string; title: string; summary: string; specialty: string; city: string; district: string;
  mode: ConsultationMode; priority: 'routine' | 'urgent' | 'emergency';
  publishedAt: string; availableFrom: string | null; documentsCount: number;
}
export interface DoctorProposal {
  id: string; needId: string; needTitle: string; specialty: string; city: string; district: string;
  status: 'sent' | 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled';
  message: string; proposedAt: string; proposedAppointmentAt: string | null;
  consultationMode: ConsultationMode; fee: number; currency: string; patientResponse: string | null; respondedAt: string | null;
}
export interface Page<T> { items: T[]; page: number; pageSize: number; total: number; totalPages: number }
export interface WeeklyAvailability { weekday: Weekday; isAvailable: boolean; startTime: string; endTime: string }
export interface BlockedDate { id: string; date: string; label: string; reason: string | null }
export interface Conversation { id: string; peerUserId: string; peerName: string; requestId: string; requestTitle: string; preview: string; lastMessageAt: string | null; unreadCount: number }
export interface ConversationMessage { id: string; senderUserId: string; body: string; sentAt: string; readAt: string | null }
export interface UserNotification { id: string; type: string; title: string; body: string; targetUrl: string | null; readAt: string | null; createdAt: string }
export interface NotificationPage extends Page<UserNotification> { unreadCount: number }
export interface PatientDocument { id: string; type: string; title: string; filename: string; mimeType: string; sizeBytes: number; uploadedAt: string; downloadUrl: string | null; dataUrl?: string | null }
export interface PatientCondition { id: string; name: string; description: string | null; status: 'active' | 'controlled' | 'inactive'; diagnosedAt: string | null; notes: string | null }
export interface AdminAccount {
  id: string; firstName: string; lastName: string; email: string | null; phone: string | null;
  role: 'patient' | 'doctor'; status: AccountStatus; emailVerified: boolean;
  verificationStatus: DoctorVerificationStatus | null; createdAt: string | null;
}
export interface DoctorZoneSettings { city: string; districts: string[]; radiusKm: number; maxDistanceKm: number }
export interface ContactMessage { name: string; email: string; subject: string; message: string }
