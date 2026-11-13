import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RESET_CONFIRMATION,
  validateRecoveryEmail,
  recoveryErrorMessage,
  loginAccountIssue,
  accountIssueMessage,
} from './account-states.ts';

test('recovery accepts a well-formed address without disclosing account status', () => {
  assert.equal(validateRecoveryEmail(' patient@example.com '), null);
  assert.match(validateRecoveryEmail('not-an-email'), /valide/);
  assert.match(validateRecoveryEmail(''), /valide/);
});

test('recovery results do not enumerate existing or nonexistent accounts', () => {
  for (const status of [400, 401, 403, 404, 409, 422]) {
    assert.equal(recoveryErrorMessage({ status, message: 'Account not found' }), RESET_CONFIRMATION);
    assert.equal(recoveryErrorMessage({ status, message: 'Account exists' }), RESET_CONFIRMATION);
  }
  assert.doesNotMatch(RESET_CONFIRMATION, /compte inexistant|adresse inconnue/i);
});

test('network and server problems are distinct, never contain raw backend errors', () => {
  assert.match(recoveryErrorMessage({ kind: 'network', message: 'EMAIL_NOT_FOUND' }), /connexion/i);
  assert.match(recoveryErrorMessage({ kind: 'timeout', message: 'private server details' }), /expiré/i);
  assert.match(recoveryErrorMessage({ status: 500, message: 'Database failed: secret' }), /indisponible/i);
  assert.doesNotMatch(recoveryErrorMessage({ status: 500, message: 'Database failed: secret' }), /secret/);
});

test('email verification requires an explicit backend 403 message', () => {
  assert.equal(loginAccountIssue({ status: 403, message: 'Votre adresse e-mail n’a pas encore été vérifiée.' }), 'verification');
  assert.equal(loginAccountIssue({ status: 403, message: 'This account is not active' }), 'restricted');
  assert.equal(loginAccountIssue({ status: 401, message: 'Invalid credentials' }), null);
  assert.equal(loginAccountIssue({ status: 409 }), null);
});

test('restricted-account screen is generic, with no existence disclosure', () => {
  const restricted = accountIssueMessage('restricted');
  assert.match(restricted.title, /indisponible/i);
  assert.doesNotMatch(restricted.description, /suspendu|supprimé|existe|n.existe pas/i);
  assert.match(accountIssueMessage('unauthorized').title, /autorisé/i);
  assert.match(accountIssueMessage('verification').description, /confirmation/i);
});
