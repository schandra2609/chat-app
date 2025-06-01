import { generatePrime, gcd } from "./math.js";


const select_e = (phi_n) => {
    let e = 2n;
    while (e < phi_n) {
        if (gcd(e, phi_n) === 1n) { return e; }
        e += 1n;
    }
    return null;
}

const mod_inverse = (e, phi_n) => {
    const original_phi = phi_n;
    let x0 = 0n, x1 = 1n;
    let a = e, m = phi_n;

    if (m === 1n) { return 0n; }

    while (a > 1n) {
        if (m === 0n) { return null; }
        const q = a / m;
        let t = m;
        m = a % m;
        a = t;
        t = x0;
        x0 = x1 - q * x0;
        x1 = t;
    }
    if (x1 < 0n) { x1 += original_phi };
    return x1;
}

const encrypt_char = (char_code, e_str, n_str) => {
    const m = BigInt(char_code);
    const e = BigInt(e_str);
    const n = BigInt(n_str);
    return (m ** e % n).toString();
}

const decrypt_char = (encrypted_char_code_str, d_str, n_str) => {
    const c = BigInt(encrypted_char_code_str);
    const d = BigInt(d_str);
    const n = BigInt(n_str);
    return (c ** d % n).toString();
}



class RSA {
    static generate_rsa_keys(primeRange = 5000) {
        let p = generatePrime(primeRange);
        let q = generatePrime(primeRange);
        while(p === q) { q = generatePrime(primeRange); }

        const n = p * q;
        const phi_n = (p - 1n) * (q - 1n);

        const e = select_e(phi_n);
        if (e === null) {
            console.warn("Could not find suitable 'e' (phi_n might be too small or primes too small), retrying key generation.");
            return this.generate_rsa_keys(primeRange + 500);
        }

        const d = mod_inverse(e, phi_n);
        if(d === null) {
            console.warn("Could not compute modInverse for 'd', retrying key generation.");
            return this.generate_rsa_keys(primeRange + 500);
        }

        return {
            public_key: { e: e.toString(), n: n.toString() },
            private_key: { d: d.toString(), n: n.toString() }
        }
    }

    static encrypt_message(msg, public_key) {
        return msg.split('').map((char) => {
            const code = char.charCodeAt(0);
            return encrypt_char(code, public_key.e, public_key.n);
        });
    }

    static decrypt_message(encrypted_msg_array, private_key) {
        return encrypted_msg_array.map((encrypted_char) => {
            const decryptedCode = decrypt_char(encrypted_char, private_key.d, private_key.n);
            return String.fromCharCode(Number(decryptedCode));
        }).join('');
    }
};

export default RSA;