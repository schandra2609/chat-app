import { randomInt as RandomIntegerGenerator } from "crypto";

/**
 * Checks if BigInt number is prime.
 * @param {bigint} num The number to check.
 * @returns {boolean} true if prime, false otherwise.
 */
const isPrime = (num) => {
    if (num <= 1n) { return false; }
    else if (num <= 3n) { return true; }
    else if (num % 2n === 0n || num % 3n === 0n) { return false; }
    else {
        for (let i = 5n; i * i <= num; i += 6n) {
            if (num % i === 0n || num % (i + 2n) === 0n) { return false; }
        }
        return true;
    }
};

/**
 * Generates a random prime BigInt number within a given range.
 * @param {number} range The upper bound for prime generation (inclusive).
 * @param {number} maxTries The maximum number of attempts to find a prime.
 * @returns {bigint} A prime BigInt
 * @throws {Error} If a prime cannot be found within maxTries
 */
const generatePrime = (range = 5000, maxTries = 1000) => {
    for (let i = 1; i <= maxTries; i++) {
        const num = BigInt(RandomIntegerGenerator(1, range + 1));
        if (isPrime(num)) {
            return num;
        }
    }
    throw new Error(`No prime number found in range up to ${range} after ${maxTries} attempts.`);
};

/**
 * Calculates the Greatest Common Divisor (GCD) of two BigInt numbers.
 * @param {bigint} a
 * @param {bigint} b
 * @returns {bigint} The GCD of a and b.
 */
const gcd = (a, b) => { return b === 0n ? a : gcd(b, a % b); };

export { generatePrime, gcd };