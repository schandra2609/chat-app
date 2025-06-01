/**
 * Calculates parity bits for 4 data bits (d3, d5, d6, d7 in standard Hamming order)
 * p1 = d3 + d5 + d7 (XOR)
 * p2 = d3 + d6 + d7 (XOR)
 * p4 = d5 + d6 + d7 (XOR)
 * Codeword: [p1, p2, d3, p4, d5, d6, d7] (1-indexed positions)
 * @param {number[]} dataNibble - Array of 4 bits (0 or 1). Example: [d3, d5, d6, d7]
 * @returns {number[]} 7-bit codeword
 */
const encodeNibble = (nibble) => {
    if(nibble.length !== 4)
        throw new Error("Invalid nibble size");

    const [d3, d5, d6, d7] = nibble;
    const p1 = (d3 + d5 + d7) % 2;
    const p2 = (d3 + d6 + d7) % 2;
    const p4 = (d5 + d6 + d7) % 2;

    return [p1, p2, d3, p4, d5, d6, d7];
}

/**
 * Decodes a 7-bit received word, corrects single bit error.
 * @param {number[]} receivedWord - Array of 7 bits.
 * @returns {{ data: number[], errorCorrected: boolean, uncorrectableError: boolean }}
 * data: 4-bit corrected data nibble [d3,d5,d6,d7],
 * errorCorrected: true if a single bit error was corrected,
 * uncorrectableError: true if >1 bit error detected (or other issue)
 */
const decodeNibble = (receivedWord) => {
    if (receivedWord.length !== 7)
        throw new Error("Invalid word size received.");

    const [p1, p2, d3, p4, d5, d6, d7] = receivedWord;

    const s1 = (p1 + d3 + d5 + d7) % 2;
    const s2 = (p2 + d3 + d6 + d7) % 2;
    const s4 = (p4 + d5 + d6 + d7) % 2;

    const syndrome = (s4 << 2) | (s2 << 1) | s1;
    let errorCorrected = false, uncorrectableError = false;
    let corrected = [...receivedWord];

    if (syndrome !== 0) {
        if(syndrome >= 1 && syndrome <= 7) {
            corrected[syndrome - 1] = 1 - corrected[syndrome - 1];
            errorCorrected = true;
        } else {
            uncorrectableError = true;
        }
    }
    return [corrected[2], corrected[4], corrected[5], corrected[6]];
}


/**
 * (7,4) Hamming Code Implementation
 * Encodes a 4-bit data nibble into a 7-bit codeword.
 * Decodes a 7-bit codeword, correcting single-bit errors.
 */
class HammingCode74 {

    /**
     * Encodes a full message string. Each 8-bit char becomes two 7-bit Hamming codes.
     * These two 7-bit codes are then converted to character codes (0-127) and joined.
     * @param {string} message - The original message string.
     * @returns {string} A new string where each original char is represented by two "Hamming chars".
     */
    static encodeMessage(msg) {
        let encodedString = "";
        for (let ch of msg) {
            const code = ch.charCodeAt(0);
            const highNibble = [(code >> 7) & 1, (code >> 6) & 1, (code >> 5) & 1, (code >> 4) & 1];
            const lowNibble = [(code >> 3) & 1, (code >> 2) & 1, (code >> 1) & 1, code & 1];
            console.log("Binary Character: " + highNibble + "    " + lowNibble);

            const encodedHigh = encodeNibble(highNibble);
            const encodedLow = encodeNibble(lowNibble);
            console.log("Encoded binary: " + encodedHigh + "    " + encodedLow);

            const highChar = encodedHigh.reduce((acc, bit, idx) => acc | (bit << (6 - idx)), 0);
            const lowChar = encodedLow.reduce((acc, bit, idx) => acc | (bit << (6 - idx)), 0);

            encodedString += String.fromCharCode(highChar) + String.fromCharCode(lowChar);
        }
        return encodedString;
    }

    /**
     * Decodes a message string that was encoded by `encodeMessage`.
     * @param {string} encodedMessage - The Hamming-encoded string.
     * @returns {string} The original message, with single-bit errors per nibble corrected.
     */
    static decodeMessage(msg) {
        let decodedString = "";
        for (let i = 0; i < msg.length; i += 2) {
            const highCode = msg.charCodeAt(i);
            const lowCode = msg.charCodeAt(i + 1);

            const highBits = [];
            const lowBits = [];
            for (let b = 6; b >= 0; b--) {
                highBits.push((highCode >> b) & 1);
                lowBits.push((lowCode >> b) & 1);
            }

            const decodedHigh = decodeNibble(highBits);
            const decodedLow = decodeNibble(lowBits);

            const charCodeHigh = (decodedHigh[0] << 3) | (decodedHigh[1] << 2) | (decodedHigh[2] << 1) | decodedHigh[3];
            const charCodeLow = (decodedLow[0] << 3) | (decodedLow[1] << 2) | (decodedLow[2] << 1) | decodedLow[3];

            decodedString += String.fromCharCode((charCodeHigh << 4) | charCodeLow);
        }
        return decodedString;
    }

    /**
     * Flips a single random bit in a binary string.
     * @param {string} bitString - A string of '0' and '1' characters
     * @returns {string} A new binary string with one bit flipped
     */
    static generateError(bitString) {
        if (!/^[01]+$/.test(bitString))
            throw new Error("Input must be a binary string.");

        const index = Math.floor(Math.random() * bitString.length);
        const flippedBit = bitString[index] === '0' ? '1' : '0';

        return bitString.substring(0, index) + flippedBit + bitString.substring(index + 1);
    }
};

export default HammingCode74;