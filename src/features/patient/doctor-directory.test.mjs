import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDoctorFilters, mapDoctorDirectory, doctorLocation, doctorModes, doctorRating,
} from './doctor-directory.ts';

const doctor = {
  id: 'doc-1', name: 'Dr. Mvondo', specialty: 'Cardiologie', bio: '',
  yearsOfExperience: 6, consultationFee: 10000, currency: 'XAF',
  professionalAddress: null, serviceCity: 'Yaoundé', serviceDistricts: ['Bastos'],
  modes: ['home', 'teleconsultation'], availability: [], rating: null,
  reviewsCount: 0,
};

test('only q specialty city are accepted, whitespace is trimmed', () => {
  assert.deepEqual(normalizeDoctorFilters({ q: '  Mvondo  ', city: '  Yaoundé ', specialty: '' }), {
    q: 'Mvondo', city: 'Yaoundé',
  });
  assert.deepEqual(normalizeDoctorFilters({}), {});
  assert.deepEqual(normalizeDoctorFilters({ specialty: '  Cardiologie  ' }), { specialty: 'Cardiologie' });
});

test('backend limits each filter to 100 characters', () => {
  for (const key of ['q', 'city', 'specialty']) {
    assert.throws(() => normalizeDoctorFilters({ [key]: 'x'.repeat(101) }), /100/);
    assert.equal(normalizeDoctorFilters({ [key]: 'x'.repeat(100) })[key].length, 100);
  }
});

test('maps exact backend response { doctors, specialties }', () => {
  const result = mapDoctorDirectory({ doctors: [doctor], specialties: ['Cardiologie'] });
  assert.equal(result.doctors[0].id, 'doc-1');
  assert.deepEqual(result.specialties, ['Cardiologie']);
  assert.deepEqual(result.doctors[0].modes, ['home','teleconsultation']);
});

test('preserves empty directory and specialties as valid API success', () => {
  assert.deepEqual(mapDoctorDirectory({ doctors: [], specialties: [] }), { doctors: [], specialties: [] });
});

test('rejects paginated or malformed responses rather than silently rendering fake emptiness', () => {
  for (const value of [null, [], { items: [doctor], total: 1 }, { doctors: [], specialties: 'Cardio' },
    { doctors: [{ id: 'no-valid-doctor' }], specialties: [] }, { doctors: [], specialties: [null] }]) {
    assert.throws(() => mapDoctorDirectory(value), /invalide|invalides/);
  }
});

test('shows location from known address, service city, then district; never invents a location', () => {
  assert.equal(doctorLocation(doctor), 'Yaoundé');
  assert.equal(doctorLocation({ ...doctor, professionalAddress: 'Rue 12, Yaoundé' }), 'Rue 12, Yaoundé');
  assert.equal(doctorLocation({ ...doctor, serviceCity: null, serviceDistricts: ['Bastos'] }), 'Bastos');
  assert.equal(doctorLocation({ ...doctor, serviceCity: null, serviceDistricts: [] }), 'Secteur non renseigné');
});

test('ratings and modes are mapped from API without invented ratings', () => {
  assert.equal(doctorRating(doctor), 'Nouveau profil');
  assert.equal(doctorRating({ ...doctor, rating: 4.5, reviewsCount: 8 }), '4,5 (8 avis)');
  assert.deepEqual(doctorModes(doctor), ['À domicile', 'Téléconsultation']);
});
