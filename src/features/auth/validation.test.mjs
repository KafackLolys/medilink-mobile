import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLogin, validateRegistration, authErrorMessage } from './validation.ts';

const makeForm = (role = 'patient') => ({
  role, firstName: 'Alice', lastName: 'Mbarga', email: 'alice@example.com',
  phone: '+237 670123456', password: 'Example123!',
  confirmPassword: 'Example123!', acceptedTerms: true,
  specialty: role === 'doctor' ? 'Cardiologie' : undefined,
  registrationNumber: role === 'doctor' ? 'CM-12345' : undefined,
});

test('login requires email syntax and nonempty password', () => {
  assert.deepEqual(validateLogin('alice@example.com', 'secret'), {});
  assert.ok(validateLogin('bad', '').email);
  assert.ok(validateLogin('alice@example.com', '').password);
  // The backend checks nonempty login passwords, not registration strength.
  assert.deepEqual(validateLogin('alice@example.com', 'x'), {});
});

test('patient registration accepts full valid fields without doctor credentials', () => {
  assert.deepEqual(validateRegistration(makeForm()), {});
});

test('doctor registration requires specialty and registration number', () => {
  assert.deepEqual(validateRegistration(makeForm('doctor')), {});
  const invalid = { ...makeForm('doctor'), specialty: '', registrationNumber: '' };
  assert.ok(validateRegistration(invalid).specialty);
  assert.ok(validateRegistration(invalid).registrationNumber);
});

test('admin public registration cannot pass validation', () => {
  assert.ok(validateRegistration(makeForm('admin')).role);
});

test('weak passwords, mismatch and consent are rejected', () => {
  const invalid = { ...makeForm(), password: '12345678', confirmPassword: 'different', acceptedTerms: false };
  const errors = validateRegistration(invalid);
  assert.ok(errors.password);
  assert.ok(errors.confirmPassword);
  assert.ok(errors.acceptedTerms);
});

test('registration requires names, email and phone', () => {
  const form = { ...makeForm(), firstName: ' ', lastName: '', email: 'a', phone: '123' };
  const errors = validateRegistration(form);
  assert.ok(errors.firstName);
  assert.ok(errors.lastName);
  assert.ok(errors.email);
  assert.ok(errors.phone);
});

test('clear messages for login errors', () => {
  assert.match(authErrorMessage({ status: 401 }, 'login'), /incorrect/);
  assert.match(authErrorMessage({ status: 403, message: 'Adresse non vérifiée' }, 'login'), /Vérifiez/);
  assert.match(authErrorMessage({ kind: 'network' }, 'login'), /réseau/);
  assert.match(authErrorMessage({ kind: 'timeout' }, 'login'), /temps/);
});

test('clear messages for registration conflicts and server errors', () => {
  assert.match(authErrorMessage({ status: 409 }, 'register'), /déjà/);
  assert.match(authErrorMessage({ status: 422 }, 'register'), /invalides/);
  assert.match(authErrorMessage({ status: 500 }, 'register'), /indisponible/);
});
