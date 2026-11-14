import test from 'node:test';
import assert from 'node:assert/strict';
import { mapPublicDoctor, doctorPublicSummary, completedDoctorAppointments } from './doctor-profile.ts';

const doctor = {
  id: 'doctor-1', name: 'Dr. Amougou', specialty: 'Pédiatrie',
  bio: 'Soins pédiatriques', yearsOfExperience: 8,
  consultationFee: 15000, currency: 'XAF',
  professionalAddress: null, serviceCity: 'Yaoundé', serviceDistricts: ['Bastos'],
  modes: ['home', 'teleconsultation'],
  availability: [{ weekday: 'monday', startTime: '08:00', endTime: '12:00', isAvailable: true }],
  blockedDates: ['2026-11-16'],
  rating: 4.5, reviewsCount: 6,
};

test('public detail maps only allowed GET /doctors/:id fields', () => {
  const mapped = mapPublicDoctor({
    ...doctor,
    email: 'doctor@example.com', phone: '+237123456789',
    registrationNumber: 'PRIVATE-001',
    documents: [{ name: 'medical_license', downloadUrl: 'secret' }],
    verificationStatus: 'verified', degrees: ['private'],
    patients: [{ id: 'patient-private' }],
  });
  assert.equal(mapped.id, 'doctor-1');
  assert.equal(mapped.rating, 4.5);
  assert.equal(mapped.blockedDates?.[0], '2026-11-16');
  for (const field of ['email', 'phone', 'registrationNumber', 'documents', 'degrees', 'verificationStatus', 'patients']) {
    assert.equal(Object.hasOwn(mapped, field), false, field + ' should not be exposed');
  }
});

test('rejects malformed or missing profiles', () => {
  for (const value of [undefined, null, {}, { id: '', name: 'Dr', specialty: 'Med', modes: [], availability: [], yearsOfExperience: 0, consultationFee: 0 }]) {
    assert.throws(() => mapPublicDoctor(value), /invalide|indisponible/i);
  }
});

test('shows only API-provided review aggregate and indicative fee', () => {
  const summary = doctorPublicSummary(mapPublicDoctor(doctor));
  assert.match(summary.rating, /4,5 \/ 5/);
  assert.match(summary.price, /15\s?000/);
  assert.equal(summary.location, 'Yaoundé');
  assert.deepEqual(summary.modes, ['À domicile', 'Téléconsultation']);
  assert.deepEqual(summary.weekly, ['Lundi · 08:00–12:00']);
  assert.equal(summary.canOpenBooking, true);
});

test('a doctor with no consultation mode or opening hours does not imply reservable time', () => {
  const summary = doctorPublicSummary(mapPublicDoctor({ ...doctor, modes: [], availability: [], rating: null }));
  assert.equal(summary.rating, 'Pas encore d’avis');
  assert.equal(summary.canOpenBooking, false);
  assert.deepEqual(summary.weekly, []);
});

test('reviews are based only on own completed appointments for the doctor', () => {
  const appointment = (id, doctorId, status, date) => ({
    id, status, doctor: { id: doctorId }, scheduledAt: date,
  });
  const filtered = completedDoctorAppointments([
    appointment('a', 'doctor-1', 'confirmed', '2026-11-16T12:00:00Z'),
    appointment('b', 'other-doctor', 'completed', '2026-11-16T12:00:00Z'),
    appointment('c', 'doctor-1', 'completed', '2026-11-14T12:00:00Z'),
    appointment('d', 'doctor-1', 'completed', '2026-11-17T12:00:00Z'),
  ], 'doctor-1');
  assert.deepEqual(filtered.map(item => item.id), ['d', 'c']);
});
