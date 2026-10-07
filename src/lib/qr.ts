const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

(() => {
  let value = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = value;
    LOG[value] = i;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function mul(a: number, b: number) {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a]! + LOG[b]!];
}

function rsEncode(data: number[], ecLength: number) {
  let generator = [1];
  for (let i = 0; i < ecLength; i++) {
    const next = new Array<number>(generator.length + 1).fill(0);
    for (let j = 0; j < generator.length; j++) {
      next[j] ^= generator[j]!;
      next[j + 1] ^= mul(generator[j]!, EXP[i]);
    }
    generator = next;
  }

  const result = data.concat(new Array(ecLength).fill(0));
  for (let i = 0; i < data.length; i++) {
    const factor = result[i]!;
    if (!factor) continue;
    for (let j = 0; j < generator.length; j++) {
      result[i + j] ^= mul(generator[j]!, factor);
    }
  }
  return result.slice(data.length);
}

type Version = {
  version: number;
  data: number;
  ec: number;
  blocks: Array<{ count: number; data: number }>;
  align: number[];
};

const VERSIONS: Version[] = [
  { version: 1, data: 19, ec: 7, blocks: [{ count: 1, data: 19 }], align: [] },
  { version: 2, data: 34, ec: 10, blocks: [{ count: 1, data: 34 }], align: [6, 18] },
  { version: 3, data: 55, ec: 15, blocks: [{ count: 1, data: 55 }], align: [6, 22] },
  { version: 4, data: 80, ec: 20, blocks: [{ count: 1, data: 80 }], align: [6, 26] },
  { version: 5, data: 108, ec: 26, blocks: [{ count: 1, data: 108 }], align: [6, 30] },
  { version: 6, data: 136, ec: 18, blocks: [{ count: 2, data: 68 }], align: [6, 34] },
  { version: 7, data: 156, ec: 20, blocks: [{ count: 2, data: 78 }], align: [6, 22, 38] },
  { version: 8, data: 194, ec: 24, blocks: [{ count: 2, data: 97 }], align: [6, 24, 42] },
  { version: 9, data: 232, ec: 30, blocks: [{ count: 2, data: 116 }], align: [6, 26, 46] },
  { version: 10, data: 274, ec: 18, blocks: [{ count: 2, data: 68 }, { count: 2, data: 69 }], align: [6, 28, 50] },
  { version: 11, data: 324, ec: 20, blocks: [{ count: 4, data: 81 }], align: [6, 30, 54] },
  { version: 12, data: 370, ec: 24, blocks: [{ count: 2, data: 92 }, { count: 2, data: 93 }], align: [6, 32, 58] },
  { version: 13, data: 428, ec: 26, blocks: [{ count: 4, data: 107 }], align: [6, 34, 62] },
  { version: 14, data: 461, ec: 30, blocks: [{ count: 3, data: 115 }, { count: 1, data: 116 }], align: [6, 26, 46, 66] },
  { version: 15, data: 523, ec: 22, blocks: [{ count: 5, data: 87 }, { count: 1, data: 88 }], align: [6, 26, 48, 70] },
  { version: 16, data: 589, ec: 24, blocks: [{ count: 5, data: 98 }, { count: 1, data: 99 }], align: [6, 26, 50, 74] },
  { version: 17, data: 647, ec: 28, blocks: [{ count: 1, data: 107 }, { count: 5, data: 108 }], align: [6, 30, 54, 78] },
  { version: 18, data: 721, ec: 30, blocks: [{ count: 5, data: 120 }, { count: 1, data: 121 }], align: [6, 30, 56, 82] },
  { version: 19, data: 795, ec: 28, blocks: [{ count: 3, data: 113 }, { count: 4, data: 114 }], align: [6, 30, 58, 86] },
  { version: 20, data: 861, ec: 28, blocks: [{ count: 3, data: 107 }, { count: 5, data: 108 }], align: [6, 34, 62, 90] },
];

function bits(value: number, length: number) {
  const out: number[] = [];
  for (let i = length - 1; i >= 0; i--) out.push((value >>> i) & 1);
  return out;
}

function chooseVersion(length: number) {
  return VERSIONS.find((version) => length <= version.data - 3) ?? null;
}

function encodeData(text: string, version: Version) {
  const bytes = Array.from(new TextEncoder().encode(text));
  const stream = [
    ...bits(0b0100, 4),
    ...bits(bytes.length, version.version < 10 ? 8 : 16),
  ];
  for (const byte of bytes) stream.push(...bits(byte, 8));
  const capacity = version.data * 8;
  stream.push(...bits(0, Math.min(4, capacity - stream.length)));
  while (stream.length % 8) stream.push(0);
  const data = [];
  for (let i = 0; i < stream.length; i += 8) {
    data.push(parseInt(stream.slice(i, i + 8).join(""), 2));
  }
  const pads = [0xec, 0x11];
  let pad = 0;
  while (data.length < version.data) data.push(pads[pad++ % 2]!);
  return data;
}

function interleave(data: number[], version: Version) {
  const blocks: number[][] = [];
  const ecc: number[][] = [];
  let offset = 0;
  for (const group of version.blocks) {
    for (let i = 0; i < group.count; i++) {
      const block = data.slice(offset, offset + group.data);
      offset += group.data;
      blocks.push(block);
      ecc.push(rsEncode(block, version.ec));
    }
  }
  const out: number[] = [];
  const max = Math.max(...blocks.map((block) => block.length));
  for (let i = 0; i < max; i++) {
    for (const block of blocks) if (i < block.length) out.push(block[i]!);
  }
  for (let i = 0; i < version.ec; i++) {
    for (const block of ecc) out.push(block[i]!);
  }
  return out;
}

function finder(matrix: Array<Array<boolean | null>>, row: number, col: number) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const y = row + r;
      const x = col + c;
      if (y < 0 || x < 0 || y >= matrix.length || x >= matrix.length) continue;
      const edge = r === -1 || c === -1 || r === 7 || c === 7;
      const outer = r === 0 || c === 0 || r === 6 || c === 6;
      const inner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      matrix[y]![x] = !edge && (outer || inner);
    }
  }
}

function reserved(size: number, version: Version) {
  const mask = Array.from({ length: size }, () => Array(size).fill(false));
  const mark = (r: number, c: number) => {
    if (r >= 0 && c >= 0 && r < size && c < size) mask[r]![c] = true;
  };
  for (const [row, col] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) mark(row + r, col + c);
  }
  for (let i = 0; i < size; i++) {
    mark(6, i);
    mark(i, 6);
  }
  for (const row of version.align) {
    for (const col of version.align) {
      if ((row === 6 && col === 6) || (row === 6 && col === size - 7) || (row === size - 7 && col === 6)) continue;
      for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) mark(row + r, col + c);
    }
  }
  mark(size - 8, 8);
  for (let i = 0; i < 9; i++) {
    mark(8, i);
    mark(i, 8);
  }
  for (let i = 0; i < 8; i++) {
    mark(8, size - 1 - i);
    mark(size - 1 - i, 8);
  }
  if (version.version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        mark(i, size - 11 + j);
        mark(size - 11 + j, i);
      }
    }
  }
  return mask;
}

function place(matrix: Array<Array<boolean | null>>, data: number[], skip: boolean[][]) {
  const size = matrix.length;
  const bits = data.flatMap((byte) => Array.from(bitsOf(byte)));
  let index = 0;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (const dx of [0, -1]) {
        const x = col + dx;
        if (skip[row]![x]) continue;
        matrix[row]![x] = index < bits.length ? bits[index] === 1 : false;
        index++;
      }
    }
    upward = !upward;
  }
}

function bitsOf(byte: number) {
  return bits(byte, 8);
}

function formatBits(mask: number) {
  let value = (0b01 << 3) | mask;
  let rest = value << 10;
  for (let i = 14; i >= 10; i--) if ((rest >>> i) & 1) rest ^= 0b10100110111 << (i - 10);
  const data = ((value << 10) | rest) ^ 0b101010000010010;
  return bits(data, 15);
}

function versionBits(version: number) {
  let rest = version << 12;
  for (let i = 17; i >= 12; i--) if ((rest >>> i) & 1) rest ^= 0b1111100100101 << (i - 12);
  return bits((version << 12) | rest, 18);
}

export function qrMatrix(text: string) {
  const version = chooseVersion(new TextEncoder().encode(text).length);
  if (!version) return null;
  const size = 21 + (version.version - 1) * 4;
  const matrix: Array<Array<boolean | null>> = Array.from({ length: size }, () => Array(size).fill(null));
  finder(matrix, 0, 0);
  finder(matrix, 0, size - 7);
  finder(matrix, size - 7, 0);
  for (let i = 8; i < size - 8; i++) {
    matrix[6]![i] = i % 2 === 0;
    matrix[i]![6] = i % 2 === 0;
  }
  matrix[size - 8]![8] = true;
  for (const row of version.align) {
    for (const col of version.align) {
      if ((row === 6 && (col === 6 || col === size - 7)) || (row === size - 7 && col === 6)) continue;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const edge = Math.abs(r) === 2 || Math.abs(c) === 2;
          matrix[row + r]![col + c] = edge || (r === 0 && c === 0);
        }
      }
    }
  }
  const skip = reserved(size, version);
  place(matrix, interleave(encodeData(text, version), version), skip);
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (skip[row]![col] || matrix[row]![col] === null) continue;
      if ((row + col) % 2 === 0) matrix[row]![col] = !matrix[row]![col];
    }
  }
  const format = formatBits(0);
  const positions = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  format.forEach((bit, index) => {
    const [row, col] = positions[index]!;
    matrix[row]![col] = bit === 1;
  });
  format.forEach((bit, index) => {
    const dark = bit === 1;
    if (index < 8) matrix[size - 1 - index]![8] = dark;
    else matrix[8]![size - 15 + index] = dark;
  });
  if (version.version >= 7) {
    const info = versionBits(version.version);
    for (let i = 0; i < 18; i++) {
      const bit = info[17 - i] === 1;
      const row = Math.floor(i / 3);
      const col = size - 11 + (i % 3);
      matrix[row]![col] = bit;
      matrix[col]![row] = bit;
    }
  }
  return matrix.map((row) => row.map((cell) => Boolean(cell)));
}

export function qrSvg(text: string) {
  const matrix = qrMatrix(text);
  if (!matrix) return null;
  const quiet = 4;
  const size = matrix.length + quiet * 2;
  const rects: string[] = [];
  matrix.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) rects.push(`<rect x="${x + quiet}" y="${y + quiet}" width="1" height="1"/>`);
    });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/>${rects.join("")}</svg>`;
}
