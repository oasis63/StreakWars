const test = require('node:test');
const assert = require('node:assert/strict');
const { getSubmissionCredit, consumeFreshCapacity, getSubmissionWindowWarning } = require('./scoring');

test('new solves receive full credit only while fresh capacity remains', () => {
    const capacity = { easy: 0, medium: 1, hard: 0 };

    assert.deepEqual(getSubmissionCredit('Medium', capacity), {
        difficultyKey: 'medium', creditType: 'fresh', pointsAwarded: 3
    });
    consumeFreshCapacity(capacity, 'medium');
    assert.equal(capacity.medium, 0);
    assert.deepEqual(getSubmissionCredit('Medium', capacity), {
        difficultyKey: 'medium', creditType: 'resubmit', pointsAwarded: 1.5
    });
});

test('a difficulty without new solves receives half credit', () => {
    assert.deepEqual(getSubmissionCredit('Hard', { easy: 1, medium: 0, hard: 0 }), {
        difficultyKey: 'hard', creditType: 'resubmit', pointsAwarded: 2.5
    });
});

test('a full public submission window inside the challenge requires review', () => {
    const submissions = Array.from({ length: 20 }, (_, index) => ({ timestamp: 2_000 + index }));
    assert.match(getSubmissionWindowWarning(submissions, 1_000_000), /may be missing/);
});

test('a window that reaches before the challenge start is not truncated for this challenge', () => {
    const submissions = Array.from({ length: 20 }, (_, index) => ({ timestamp: 500 + index }));
    assert.equal(getSubmissionWindowWarning(submissions, 1_000_000), null);
});
