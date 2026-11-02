// crypto-utils.js: Cryptographic SHA-256, Bech32 npub formatting, and deterministic stat derivation

// Fast synchronous SHA-256 fallback (standard implementation)
function sha256Sync(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  var mathPow = Math.pow;
  var maxWord = mathPow(2, 32);
  var lengthProperty = 'length';
  var i, j;
  var result = '';
  var words = [];
  var asciiBitLength = ascii[lengthProperty] * 8;
  var hash = [];
  var k = [];
  var primeCounter = 0;
  var isComposite = {};
  for (var candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += '\x80';
  while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return;
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;
  for (j = 0; j < words[lengthProperty];) {
    var w = words.slice(j, (j += 16));
    var oldHash = hash;
    hash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      var w15 = w[i - 15], w2 = w[i - 2];
      var s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      var s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] = i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      var s1h = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      var ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      var temp1 = (hash[7] + s1h + ch + k[i] + w[i]) | 0;
      var s0h = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      var maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      var temp2 = (s0h + maj) | 0;
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }
  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      var b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? 0 : '') + b.toString(16);
    }
  }
  return result;
}

// Convert Hex string to Bech32 npub
function hexToNpub(hex) {
  if (!hex || hex.length !== 64) {
    return 'npub1' + (hex ? hex.substring(0, 8) : 'guest') + '...';
  }
  const ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  function polymod(values) {
    let chk = 1;
    for (let p = 0; p < values.length; ++p) {
      const top = chk >> 25;
      chk = ((chk & 0x1ffffff) << 5) ^ values[p];
      if (top & 1) chk ^= 0x3b6a57b2;
      if (top & 2) chk ^= 0x26508e6d;
      if (top & 4) chk ^= 0x1ea119fa;
      if (top & 8) chk ^= 0x3d4233dd;
      if (top & 16) chk ^= 0x2a1462b3;
    }
    return chk;
  }
  function convertBits(data, frombits, tobits, pad) {
    let acc = 0;
    let bits = 0;
    const ret = [];
    const maxv = (1 << tobits) - 1;
    for (let p = 0; p < data.length; ++p) {
      const value = data[p];
      if (value < 0 || value >> frombits !== 0) return null;
      acc = (acc << frombits) | value;
      bits += frombits;
      while (bits >= tobits) {
        bits -= tobits;
        ret.push((acc >> bits) & maxv);
      }
    }
    if (pad) {
      if (bits > 0) ret.push((acc << (tobits - bits)) & maxv);
    } else if (bits >= frombits || ((acc << (tobits - bits)) & maxv)) {
      return null;
    }
    return ret;
  }
  try {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    const words = convertBits(bytes, 8, 5, true);
    if (!words) return 'npub1' + hex.substring(0, 16);
    const hrp = 'npub';
    const hrpExpanded = [];
    for (let i = 0; i < hrp.length; ++i) hrpExpanded.push(hrp.charCodeAt(i) >> 5);
    hrpExpanded.push(0);
    for (let i = 0; i < hrp.length; ++i) hrpExpanded.push(hrp.charCodeAt(i) & 31);

    const values = hrpExpanded.concat(words).concat([0, 0, 0, 0, 0, 0]);
    const mod = polymod(values) ^ 1;
    const retChecksum = [];
    for (let p = 0; p < 6; ++p) {
      retChecksum.push((mod >> (5 * (5 - p))) & 31);
    }
    const combined = words.concat(retChecksum);
    let bech32 = hrp + '1';
    for (let i = 0; i < combined.length; ++i) {
      bech32 += ALPHABET.charAt(combined[i]);
    }
    return bech32;
  } catch (e) {
    return 'npub1' + hex.substring(0, 16) + '...';
  }
}

// Derive procedural stats from emoji SHA-256 hash
function deriveEmojiStats(shortcode, url) {
  const seedString = `${shortcode}:${url}`;
  const hash = sha256Sync(seedString);

  const byte0 = parseInt(hash.substring(0, 2), 16); // Base HP (20 - 100)
  const byte1 = parseInt(hash.substring(2, 4), 16); // Speed (1.2 - 3.2)
  const byte2 = parseInt(hash.substring(4, 6), 16); // Damage (6 - 26)
  const byte3 = parseInt(hash.substring(6, 8), 16); // Behavior (0: Swarmer, 1: Zigzag, 2: Brute, 3: Sniper)
  const byte4 = parseInt(hash.substring(8, 10), 16); // EXP & Mojo Drop Value (1 - 5)
  const byte5 = parseInt(hash.substring(10, 12), 16); // Color tint accent

  const hp = 20 + Math.floor((byte0 / 255) * 80);
  const speed = 1.1 + (byte1 / 255) * 2.1;
  const damage = 6 + Math.floor((byte2 / 255) * 20);
  const behaviorType = byte3 % 4; // 0: SWARMER, 1: ZIGZAG, 2: BRUTE, 3: SNIPER
  const expValue = 1 + Math.floor((byte4 / 255) * 4);
  const mojoValue = 1 + (byte4 > 200 ? 2 : byte4 > 100 ? 1 : 0);

  // Power rating determines score multiplier and tier
  const powerRating = Math.floor(hp * 0.45 + speed * 16 + damage * 2.2);
  
  let tier = 'COMMON';
  if (powerRating > 115) tier = 'APEX';
  else if (powerRating > 95) tier = 'EPIC';
  else if (powerRating > 75) tier = 'RARE';

  const behaviorNames = ['Swarm Rusher', 'Zigzag Stalker', 'Shockwave Brute', 'Orbiting Sniper'];

  return {
    hash,
    shortcode,
    url,
    hp,
    speed,
    damage,
    behaviorType,
    behaviorName: behaviorNames[behaviorType],
    expValue,
    mojoValue,
    powerRating,
    tier
  };
}

const SafeStorage = {
  store: {},
  getItem(k) {
    try {
      return (typeof localStorage !== 'undefined' && localStorage.getItem) ? localStorage.getItem(k) : (this.store[k] || null);
    } catch (e) {
      return this.store[k] || null;
    }
  },
  setItem(k, v) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.setItem) {
        localStorage.setItem(k, String(v));
      }
    } catch (e) {}
    this.store[k] = String(v);
  },
  removeItem(k) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.removeItem) {
        localStorage.removeItem(k);
      }
    } catch (e) {}
    delete this.store[k];
  }
};

window.SafeStorage = SafeStorage;

window.MojiCrypto = {
  sha256Sync,
  hexToNpub,
  deriveEmojiStats
};

