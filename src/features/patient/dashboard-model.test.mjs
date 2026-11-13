import test from 'node:test';
import assert from 'node:assert/strict';
import { patientOverview, formatPatientDate, NEED_LABELS } from './dashboard-model.ts';

const need = (id, status, interested = 0) => ({
  id, status, interested, title: id, specialty: 'Médecine générale',
  createdAt: '2026-11-01T10:00:00Z', mode: 'domicile', attachmentsCount: 0,
});
const appointment = (id, status, scheduledAt) => ({
  id, status, scheduledAt, doctor: { id: 'doc', name: 'Médecin', specialty: 'Généraliste', professionalAddress: null },
  durationMinutes: 30, consultationMode: 'home', fee: 0, currency: 'XAF', reason: null,
});
const now = Date.parse('2026-11-13T10:00:00Z');

test('never synthesizes zero counts if API datasets failed', () => {
  const summary = patientOverview(null, null, now);
  assert.equal(summary.activeNeedsCount, null);
  assert.equal(summary.proposalsCount, null);
  assert.equal(summary.upcomingCount, null);
  assert.equal(summary.nextAppointment, null);
});

test('successful empty API arrays produce legitimate zeros', () => {
  const summary = patientOverview([], [], now);
  assert.equal(summary.activeNeedsCount, 0);
  assert.equal(summary.proposalsCount, 0);
  assert.equal(summary.upcomingCount, 0);
});

test('active need statuses and proposal counts match web dashboard', () => {
  const summary = patientOverview([
    need('draft', 'draft', 80),
    need('published', 'published', 2),
    need('waiting', 'awaiting_proposals', 3),
    need('proposals', 'proposals_received', 4),
    need('closed', 'closed', 10),
    need('confirmed', 'appointment_confirmed', 7),
  ], null, now);
  assert.deepEqual(summary.active?.map(n => n.id), ['published', 'waiting', 'proposals']);
  assert.equal(summary.activeNeedsCount, 3);
  assert.equal(summary.proposalsCount, 9);
  assert.equal(summary.upcomingCount, null);
});

test('upcoming appointments exclude past and completed appointments, sorted ascending', () => {
  const summary = patientOverview(null, [
    appointment('completed', 'completed', '2026-11-20T10:00:00Z'),
    appointment('later', 'confirmed', '2026-11-15T10:00:00Z'),
    appointment('past', 'confirmed', '2026-11-01T10:00:00Z'),
    appointment('first', 'pending_confirmation', '2026-11-14T10:00:00Z'),
    appointment('rejected', 'rejected', '2026-11-17T10:00:00Z'),
    appointment('invalid', 'confirmed', 'invalid'),
  ], now);
  assert.deepEqual(summary.upcoming?.map(a => a.id), ['first', 'later']);
  assert.equal(summary.nextAppointment?.id, 'first');
  assert.equal(summary.upcomingCount, 2);
});

test('date display does not invent invalid time', () => {
  assert.equal(formatPatientDate('invalid'), 'Date indisponible');
  assert.match(formatPatientDate('2026-11-13T09:00:00Z'), /13/);
  assert.equal(NEED_LABELS.awaiting_proposals, 'En attente de propositions');
});
