import * as THREE from 'three';

/**
 * Procedural PBR Texture Generator
 * Produces paired CanvasTexture diffuse (map), bumpMap, and roughnessMap
 * with zero external image dependencies.
 */

function createCanvas(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return { canvas, ctx: canvas.getContext('2d') };
}

function seededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeTexturePair(size, repeatX, repeatY, drawFn) {
  const diff = createCanvas(size);
  const bump = createCanvas(size);
  const rough = createCanvas(size);

  drawFn(diff.ctx, bump.ctx, rough.ctx, size);

  const map = new THREE.CanvasTexture(diff.canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeatX, repeatY);
  map.anisotropy = 8;

  const bumpMap = new THREE.CanvasTexture(bump.canvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(repeatX, repeatY);
  bumpMap.anisotropy = 4;

  const roughnessMap = new THREE.CanvasTexture(rough.canvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(repeatX, repeatY);
  roughnessMap.anisotropy = 4;

  return { map, bumpMap, roughnessMap };
}

function addNoiseGrain(ctx, size, alpha, rand) {
  const img = ctx.getImageData(0, 0, size, size);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (rand() - 0.5) * alpha;
    data[i] = Math.max(0, Math.min(255, data[i] + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

const materialCache = new Map();

export function getProceduralMaterial(type, options = {}) {
  const rx = options.repeatX ?? 1;
  const ry = options.repeatY ?? 1;
  const key = `${type}_${rx}_${ry}_${options.tint ?? ''}_${options.bumpScale ?? ''}_${options.side ?? ''}`;
  if (materialCache.has(key)) {
    return materialCache.get(key);
  }

  let tex;
  let matParams = {
    roughness: options.roughness ?? 0.85,
    metalness: options.metalness ?? 0.04,
    bumpScale: options.bumpScale ?? 0.035,
  };
  if (options.side !== undefined) matParams.side = options.side;
  if (options.transparent) {
    matParams.transparent = true;
    matParams.opacity = options.opacity ?? 0.65;
  }

  switch (type) {
    case 'almasik': {
      // Traditional Seljuk/Ottoman alternating cut stone & red brick courses
      tex = makeTexturePair(512, rx, ry, (d, b, r, s) => {
        const rand = seededRand(1300);
        // Mortar bed
        d.fillStyle = '#c8bca6';
        d.fillRect(0, 0, s, s);
        b.fillStyle = '#383838';
        b.fillRect(0, 0, s, s);
        r.fillStyle = '#e6e6e6';
        r.fillRect(0, 0, s, s);

        // 8 horizontal bands: stone course, 2 thin brick courses, stone course, 2 thin brick courses...
        const bands = [
          { h: 92, kind: 'stone' },
          { h: 36, kind: 'brick' },
          { h: 36, kind: 'brick' },
          { h: 92, kind: 'stone' },
          { h: 36, kind: 'brick' },
          { h: 36, kind: 'brick' },
          { h: 92, kind: 'stone' },
          { h: 46, kind: 'brick' },
          { h: 46, kind: 'brick' },
        ];
        let y = 0;
        bands.forEach((band, bi) => {
          const mortar = 5;
          if (band.kind === 'stone') {
            const cols = 4;
            const w = s / cols;
            const offset = (bi % 2) * (w * 0.5);
            for (let c = -1; c <= cols; c++) {
              const bx = c * w + offset;
              const shade = Math.floor(rand() * 24 - 12);
              d.fillStyle = `rgb(${214 + shade}, ${196 + shade}, ${164 + shade})`;
              d.fillRect(bx + mortar, y + mortar, w - mortar * 2, band.h - mortar * 2);

              // Subtle chisel bevel
              d.strokeStyle = 'rgba(255,248,235,0.28)';
              d.lineWidth = 2;
              d.strokeRect(bx + mortar + 2, y + mortar + 2, w - mortar * 2 - 4, band.h - mortar * 2 - 4);

              const bv = Math.floor(180 + rand() * 55);
              b.fillStyle = `rgb(${bv},${bv},${bv})`;
              b.fillRect(bx + mortar, y + mortar, w - mortar * 2, band.h - mortar * 2);

              const rv = Math.floor(175 + rand() * 45);
              r.fillStyle = `rgb(${rv},${rv},${rv})`;
              r.fillRect(bx + mortar, y + mortar, w - mortar * 2, band.h - mortar * 2);
            }
          } else {
            const cols = 8;
            const w = s / cols;
            const offset = (bi % 2) * (w * 0.5);
            for (let c = -1; c <= cols; c++) {
              const bx = c * w + offset;
              const tone = rand();
              const cr = Math.floor(152 + tone * 32);
              const cg = Math.floor(68 + tone * 22);
              const cb = Math.floor(48 + tone * 14);
              d.fillStyle = `rgb(${cr},${cg},${cb})`;
              d.fillRect(bx + 3, y + 3, w - 6, band.h - 6);

              const bv = Math.floor(165 + rand() * 55);
              b.fillStyle = `rgb(${bv},${bv},${bv})`;
              b.fillRect(bx + 3, y + 3, w - 6, band.h - 6);

              const rv = Math.floor(205 + rand() * 35);
              r.fillStyle = `rgb(${rv},${rv},${rv})`;
              r.fillRect(bx + 3, y + 3, w - 6, band.h - 6);
            }
          }
          y += band.h;
        });

        addNoiseGrain(d, s, 18, rand);
        addNoiseGrain(b, s, 26, rand);
      });
      matParams.bumpScale = options.bumpScale ?? 0.045;
      break;
    }

    case 'seljukBrick': {
      // Iconic Tokat Alaca Mescit 1300 AD Seljuk diamond/baklava brick shaft texture
      tex = makeTexturePair(512, rx, ry, (d, b, r, s) => {
        const rand = seededRand(700);
        d.fillStyle = '#c9b496';
        d.fillRect(0, 0, s, s);
        b.fillStyle = '#404040';
        b.fillRect(0, 0, s, s);
        r.fillStyle = '#dcdcdc';
        r.fillRect(0, 0, s, s);

        const rows = 16;
        const cols = 8;
        const rh = s / rows;
        const cw = s / cols;

        for (let row = 0; row < rows; row++) {
          const shift = (row % 2) * (cw * 0.5);
          for (let col = -1; col <= cols; col++) {
            const x = col * cw + shift;
            const y = row * rh;
            // Alternate decorative raised diamond & recessed bricks
            const diag = ((row + col) % 4 === 0) || ((row - col + 16) % 4 === 0);
            const warm = rand() * 24;
            d.fillStyle = diag
              ? `rgb(${178 + warm}, ${76 + warm * 0.4}, ${48 + warm * 0.3})`
              : `rgb(${144 + warm}, ${62 + warm * 0.4}, ${42 + warm * 0.3})`;
            d.fillRect(x + 2, y + 2, cw - 4, rh - 4);

            const bv = diag ? 235 : 155;
            b.fillStyle = `rgb(${bv},${bv},${bv})`;
            b.fillRect(x + 2, y + 2, cw - 4, rh - 4);

            r.fillStyle = diag ? '#c8c8c8' : '#e4e4e4';
            r.fillRect(x + 2, y + 2, cw - 4, rh - 4);
          }
        }
        addNoiseGrain(d, s, 20, rand);
        addNoiseGrain(b, s, 22, rand);
      });
      matParams.bumpScale = options.bumpScale ?? 0.055;
      break;
    }

    case 'cutStone': {
      tex = makeTexturePair(512, rx, ry, (d, b, r, s) => {
        const rand = seededRand(402);
        d.fillStyle = '#9c9281';
        d.fillRect(0, 0, s, s);
        b.fillStyle = '#454545';
        b.fillRect(0, 0, s, s);
        r.fillStyle = '#d8d8d8';
        r.fillRect(0, 0, s, s);

        const rows = 6;
        const cols = 4;
        const rh = s / rows;
        const cw = s / cols;

        for (let row = 0; row < rows; row++) {
          const offset = (row % 2) * (cw * 0.5);
          for (let col = -1; col <= cols; col++) {
            const x = col * cw + offset;
            const y = row * rh;
            const shade = Math.floor(rand() * 26 - 13);
            const baseR = options.tint === 'dark' ? 148 : 206;
            const baseG = options.tint === 'dark' ? 140 : 192;
            const baseB = options.tint === 'dark' ? 128 : 168;
            d.fillStyle = `rgb(${baseR + shade}, ${baseG + shade}, ${baseB + shade})`;
            d.fillRect(x + 3, y + 3, cw - 6, rh - 6);

            const bv = Math.floor(175 + rand() * 55);
            b.fillStyle = `rgb(${bv},${bv},${bv})`;
            b.fillRect(x + 3, y + 3, cw - 6, rh - 6);

            const rv = Math.floor(185 + rand() * 45);
            r.fillStyle = `rgb(${rv},${rv},${rv})`;
            r.fillRect(x + 3, y + 3, cw - 6, rh - 6);
          }
        }
        addNoiseGrain(d, s, 18, rand);
        addNoiseGrain(b, s, 25, rand);
      });
      break;
    }

    case 'leadRoof': {
      // Patinated Ottoman dome lead panels with standing seams
      tex = makeTexturePair(512, rx, ry, (d, b, r, s) => {
        const rand = seededRand(812);
        d.fillStyle = '#5b636b';
        d.fillRect(0, 0, s, s);
        b.fillStyle = '#909090';
        b.fillRect(0, 0, s, s);
        r.fillStyle = '#9e9e9e';
        r.fillRect(0, 0, s, s);

        const strips = 12;
        const sw = s / strips;
        for (let i = 0; i < strips; i++) {
          const shade = Math.floor(rand() * 18 - 9);
          d.fillStyle = `rgb(${88 + shade}, ${96 + shade}, ${104 + shade})`;
          d.fillRect(i * sw + 3, 0, sw - 6, s);

          // Standing seam ridge
          d.fillStyle = '#3c4248';
          d.fillRect(i * sw, 0, 4, s);
          b.fillStyle = '#efefef';
          b.fillRect(i * sw, 0, 5, s);
          r.fillStyle = '#707070';
          r.fillRect(i * sw, 0, 4, s);
        }
        addNoiseGrain(d, s, 14, rand);
      });
      matParams.metalness = options.metalness ?? 0.35;
      matParams.roughness = options.roughness ?? 0.52;
      matParams.bumpScale = 0.03;
      break;
    }

    case 'kiremit': {
      // Alaturka terracotta barrel roof tiles
      tex = makeTexturePair(512, rx, ry, (d, b, r, s) => {
        const rand = seededRand(991);
        d.fillStyle = '#7d341f';
        d.fillRect(0, 0, s, s);
        b.fillStyle = '#303030';
        b.fillRect(0, 0, s, s);
        r.fillStyle = '#d4d4d4';
        r.fillRect(0, 0, s, s);

        const cols = 12;
        const rows = 8;
        const cw = s / cols;
        const rh = s / rows;

        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const x = col * cw;
            const y = row * rh;
            const v = rand();
            const cr = Math.floor(168 + v * 40);
            const cg = Math.floor(74 + v * 28);
            const cb = Math.floor(42 + v * 16);

            const grad = d.createLinearGradient(x, y, x + cw, y);
            grad.addColorStop(0, `rgb(${cr - 38},${cg - 22},${cb - 12})`);
            grad.addColorStop(0.48, `rgb(${cr},${cg},${cb})`);
            grad.addColorStop(1, `rgb(${cr - 45},${cg - 25},${cb - 15})`);
            d.fillStyle = grad;
            d.fillRect(x + 1, y + 2, cw - 2, rh - 3);

            // Row overlap shadow
            d.fillStyle = 'rgba(20, 8, 4, 0.35)';
            d.fillRect(x, y + rh - 5, cw, 5);

            const bGrad = b.createLinearGradient(x, y, x + cw, y);
            bGrad.addColorStop(0, '#444');
            bGrad.addColorStop(0.5, '#eaeaea');
            bGrad.addColorStop(1, '#444');
            b.fillStyle = bGrad;
            b.fillRect(x + 1, y + 2, cw - 2, rh - 3);
          }
        }
        addNoiseGrain(d, s, 16, rand);
      });
      matParams.bumpScale = 0.055;
      break;
    }

    case 'bagdadiPlaster': {
      // Traditional Tokat timber-frame plaster (cream/ochre stucco + dark oak beams)
      tex = makeTexturePair(512, rx, ry, (d, b, r, s) => {
        const rand = seededRand(515);
        let base = [228, 212, 182];
        if (options.tint === 'ochre') base = [219, 186, 134];
        if (options.tint === 'terracotta') base = [206, 152, 118];
        if (options.tint === 'sage') base = [196, 206, 182];

        d.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
        d.fillRect(0, 0, s, s);
        b.fillStyle = '#999999';
        b.fillRect(0, 0, s, s);
        r.fillStyle = '#e0e0e0';
        r.fillRect(0, 0, s, s);

        // Plaster weathering patches
        for (let i = 0; i < 45; i++) {
          const px = rand() * s;
          const py = rand() * s;
          const pr = 18 + rand() * 50;
          d.fillStyle = `rgba(140, 110, 75, ${0.04 + rand() * 0.06})`;
          d.beginPath();
          d.arc(px, py, pr, 0, Math.PI * 2);
          d.fill();
        }

        // Timber frame verticals & horizontals & diagonal brace
        const drawBeam = (x1, y1, x2, y2, w) => {
          d.strokeStyle = '#47301e';
          d.lineWidth = w;
          d.beginPath();
          d.moveTo(x1, y1);
          d.lineTo(x2, y2);
          d.stroke();

          b.strokeStyle = '#e8e8e8';
          b.lineWidth = w;
          b.beginPath();
          b.moveTo(x1, y1);
          b.lineTo(x2, y2);
          b.stroke();

          r.strokeStyle = '#b4b4b4';
          r.lineWidth = w;
          r.beginPath();
          r.moveTo(x1, y1);
          r.lineTo(x2, y2);
          r.stroke();
        };

        drawBeam(0, 14, s, 14, 24);
        drawBeam(0, s - 14, s, s - 14, 24);
        drawBeam(0, s * 0.5, s, s * 0.5, 16);
        drawBeam(14, 0, 14, s, 22);
        drawBeam(s * 0.5, 0, s * 0.5, s, 18);
        drawBeam(s - 14, 0, s - 14, s, 22);
        drawBeam(14, s - 14, s * 0.5, s * 0.5, 14);
        drawBeam(s - 14, s - 14, s * 0.5, s * 0.5, 14);

        addNoiseGrain(d, s, 16, rand);
        addNoiseGrain(b, s, 20, rand);
      });
      matParams.bumpScale = 0.04;
      break;
    }

    case 'agedWood': {
      tex = makeTexturePair(512, rx, ry, (d, b, r, s) => {
        const rand = seededRand(333);
        const dark = options.tint === 'light';
        d.fillStyle = dark ? '#8a5d3b' : '#4b311e';
        d.fillRect(0, 0, s, s);
        b.fillStyle = '#909090';
        b.fillRect(0, 0, s, s);
        r.fillStyle = '#b8b8b8';
        r.fillRect(0, 0, s, s);

        const planks = 6;
        const pw = s / planks;
        for (let p = 0; p < planks; p++) {
          const x = p * pw;
          const v = Math.floor(rand() * 20 - 10);
          d.fillStyle = dark
            ? `rgb(${138 + v}, ${92 + v}, ${58 + v})`
            : `rgb(${78 + v}, ${50 + v}, ${32 + v})`;
          d.fillRect(x + 2, 0, pw - 4, s);

          // Wood grain streaks
          for (let g = 0; g < 18; g++) {
            const gx = x + 4 + rand() * (pw - 8);
            d.strokeStyle = 'rgba(20, 10, 4, 0.25)';
            d.lineWidth = 1 + rand() * 1.5;
            d.beginPath();
            d.moveTo(gx, 0);
            d.bezierCurveTo(gx + (rand() - 0.5) * 8, s * 0.33, gx + (rand() - 0.5) * 8, s * 0.66, gx, s);
            d.stroke();
          }

          b.fillStyle = '#333';
          b.fillRect(x, 0, 3, s);
        }
        addNoiseGrain(d, s, 14, rand);
      });
      matParams.roughness = 0.78;
      break;
    }

    case 'floorWood': {
      tex = makeTexturePair(512, rx, ry, (d, b, r, s) => {
        const rand = seededRand(611);
        d.fillStyle = '#9f6c40';
        d.fillRect(0, 0, s, s);
        b.fillStyle = '#a0a0a0';
        b.fillRect(0, 0, s, s);
        r.fillStyle = '#757575';
        r.fillRect(0, 0, s, s);

        const planks = 8;
        const ph = s / planks;
        for (let i = 0; i < planks; i++) {
          const y = i * ph;
          const shade = Math.floor(rand() * 24 - 12);
          d.fillStyle = `rgb(${164 + shade}, ${110 + shade}, ${66 + shade})`;
          d.fillRect(0, y + 2, s, ph - 4);
          d.fillStyle = '#3e2614';
          d.fillRect(0, y, s, 2);
          b.fillStyle = '#383838';
          b.fillRect(0, y, s, 3);

          const seamX = ((i * 173) % (s - 60)) + 30;
          d.fillRect(seamX, y, 2, ph);
          b.fillRect(seamX, y, 2, ph);
        }
        addNoiseGrain(d, s, 10, rand);
      });
      matParams.roughness = 0.58;
      matParams.bumpScale = 0.02;
      break;
    }

    case 'interiorPlaster': {
      tex = makeTexturePair(512, rx, ry, (d, b, r, s) => {
        const rand = seededRand(218);
        d.fillStyle = '#efe6d5';
        d.fillRect(0, 0, s, s);
        b.fillStyle = '#989898';
        b.fillRect(0, 0, s, s);
        r.fillStyle = '#d0d0d0';
        r.fillRect(0, 0, s, s);
        // Subtle wooden wainscoting along bottom
        d.fillStyle = '#6c492d';
        d.fillRect(0, s * 0.82, s, s * 0.18);
        d.fillStyle = '#4e331e';
        d.fillRect(0, s * 0.82, s, 6);
        addNoiseGrain(d, s, 10, rand);
        addNoiseGrain(b, s, 12, rand);
      });
      matParams.bumpScale = 0.015;
      break;
    }

    case 'anatolianRug': {
      tex = makeTexturePair(512, 1, 1, (d, b, r, s) => {
        const rand = seededRand(1923);
        // Deep crimson Anatolian rug field
        d.fillStyle = '#7c1f1d';
        d.fillRect(0, 0, s, s);

        // Outer ivory & indigo borders
        d.strokeStyle = '#e9d9b8';
        d.lineWidth = 22;
        d.strokeRect(20, 20, s - 40, s - 40);
        d.strokeStyle = '#1d334c';
        d.lineWidth = 14;
        d.strokeRect(42, 42, s - 84, s - 84);
        d.strokeStyle = '#d49a3a';
        d.lineWidth = 6;
        d.strokeRect(58, 58, s - 116, s - 116);

        // Geometric diamond medallions
        const drawDiamond = (cx, cy, rad, color) => {
          d.fillStyle = color;
          d.beginPath();
          d.moveTo(cx, cy - rad);
          d.lineTo(cx + rad * 0.85, cy);
          d.lineTo(cx, cy + rad);
          d.lineTo(cx - rad * 0.85, cy);
          d.closePath();
          d.fill();
        };
        drawDiamond(s / 2, s / 2, 145, '#1d334c');
        drawDiamond(s / 2, s / 2, 112, '#e8d7b5');
        drawDiamond(s / 2, s / 2, 74, '#9a2a23');
        drawDiamond(s / 2, s / 2, 36, '#d69c3a');

        drawDiamond(120, 120, 34, '#d69c3a');
        drawDiamond(s - 120, 120, 34, '#d69c3a');
        drawDiamond(120, s - 120, 34, '#d69c3a');
        drawDiamond(s - 120, s - 120, 34, '#d69c3a');

        b.fillStyle = '#a0a0a0';
        b.fillRect(0, 0, s, s);
        r.fillStyle = '#ececec';
        r.fillRect(0, 0, s, s);
        addNoiseGrain(d, s, 22, rand);
        addNoiseGrain(b, s, 28, rand);
      });
      matParams.roughness = 0.94;
      matParams.bumpScale = 0.025;
      break;
    }

    case 'iznikTile': {
      tex = makeTexturePair(512, rx, ry, (d, b, r, s) => {
        const rand = seededRand(444);
        d.fillStyle = '#f2f0e9';
        d.fillRect(0, 0, s, s);
        b.fillStyle = '#e0e0e0';
        b.fillRect(0, 0, s, s);
        r.fillStyle = '#383838';
        r.fillRect(0, 0, s, s);

        const cells = 4;
        const cw = s / cells;
        for (let y = 0; y < cells; y++) {
          for (let x = 0; x < cells; x++) {
            const cx = x * cw + cw / 2;
            const cy = y * cw + cw / 2;
            // Iznik turquoise & cobalt rosette
            d.strokeStyle = '#155289';
            d.lineWidth = 4;
            d.beginPath();
            d.arc(cx, cy, cw * 0.34, 0, Math.PI * 2);
            d.stroke();

            d.fillStyle = '#1c8c9c';
            d.beginPath();
            d.moveTo(cx, cy - cw * 0.25);
            d.lineTo(cx + cw * 0.25, cy);
            d.lineTo(cx, cy + cw * 0.25);
            d.lineTo(cx - cw * 0.25, cy);
            d.closePath();
            d.fill();

            d.strokeStyle = '#b4b0a8';
            d.lineWidth = 4;
            d.strokeRect(x * cw, y * cw, cw, cw);
            b.strokeStyle = '#404040';
            b.lineWidth = 5;
            b.strokeRect(x * cw, y * cw, cw, cw);
          }
        }
        addNoiseGrain(d, s, 8, rand);
      });
      matParams.roughness = 0.22;
      matParams.bumpScale = 0.02;
      break;
    }

    case 'cobblestone': {
      tex = makeTexturePair(512, rx, ry, (d, b, r, s) => {
        const rand = seededRand(101);
        d.fillStyle = '#3f3d39';
        d.fillRect(0, 0, s, s);
        b.fillStyle = '#2d2d2d';
        b.fillRect(0, 0, s, s);
        r.fillStyle = '#e0e0e0';
        r.fillRect(0, 0, s, s);

        const rows = 12;
        const cols = 10;
        const rh = s / rows;
        const cw = s / cols;

        for (let row = 0; row < rows; row++) {
          const shift = (row % 2) * (cw * 0.5);
          for (let col = -1; col <= cols; col++) {
            const x = col * cw + shift;
            const y = row * rh;
            const v = Math.floor(88 + rand() * 44);
            const warm = Math.floor(rand() * 14);
            d.fillStyle = `rgb(${v + warm}, ${v + 4}, ${v - 4})`;
            d.beginPath();
            d.roundRect(x + 3, y + 3, cw - 6, rh - 6, 7);
            d.fill();

            const bv = Math.floor(170 + rand() * 65);
            b.fillStyle = `rgb(${bv},${bv},${bv})`;
            b.beginPath();
            b.roundRect(x + 3, y + 3, cw - 6, rh - 6, 7);
            b.fill();

            const rv = Math.floor(145 + rand() * 55);
            r.fillStyle = `rgb(${rv},${rv},${rv})`;
            r.beginPath();
            r.roundRect(x + 3, y + 3, cw - 6, rh - 6, 7);
            r.fill();
          }
        }
        addNoiseGrain(d, s, 16, rand);
      });
      matParams.bumpScale = 0.05;
      break;
    }

    case 'sidewalk': {
      tex = makeTexturePair(512, rx, ry, (d, b, r, s) => {
        const rand = seededRand(88);
        d.fillStyle = '#9b958b';
        d.fillRect(0, 0, s, s);
        b.fillStyle = '#555';
        b.fillRect(0, 0, s, s);
        r.fillStyle = '#d4d4d4';
        r.fillRect(0, 0, s, s);

        const grid = 6;
        const step = s / grid;
        for (let y = 0; y < grid; y++) {
          for (let x = 0; x < grid; x++) {
            const shade = Math.floor(rand() * 22 - 11);
            d.fillStyle = `rgb(${178 + shade}, ${170 + shade}, ${156 + shade})`;
            d.fillRect(x * step + 2, y * step + 2, step - 4, step - 4);
            b.fillStyle = `rgb(${180 + shade}, ${180 + shade}, ${180 + shade})`;
            b.fillRect(x * step + 2, y * step + 2, step - 4, step - 4);
          }
        }
        addNoiseGrain(d, s, 14, rand);
      });
      break;
    }

    case 'grassGround': {
      tex = makeTexturePair(512, rx, ry, (d, b, r, s) => {
        const rand = seededRand(777);
        d.fillStyle = '#566b3a';
        d.fillRect(0, 0, s, s);
        b.fillStyle = '#888';
        b.fillRect(0, 0, s, s);
        r.fillStyle = '#ececec';
        r.fillRect(0, 0, s, s);

        for (let i = 0; i < 650; i++) {
          const x = rand() * s;
          const y = rand() * s;
          const len = 5 + rand() * 8;
          d.strokeStyle = rand() > 0.35 ? '#6d8247' : '#85774b';
          d.lineWidth = 2;
          d.beginPath();
          d.moveTo(x, y);
          d.lineTo(x + (rand() - 0.5) * 4, y - len);
          d.stroke();
        }
        addNoiseGrain(d, s, 18, rand);
      });
      matParams.roughness = 0.95;
      break;
    }

    case 'windowGlass': {
      tex = makeTexturePair(256, 1, 1, (d, b, r, s) => {
        const grad = d.createLinearGradient(0, 0, s, s);
        grad.addColorStop(0, '#30495e');
        grad.addColorStop(0.5, '#587c96');
        grad.addColorStop(1, '#223646');
        d.fillStyle = grad;
        d.fillRect(0, 0, s, s);

        // Reflection highlight streak
        d.fillStyle = 'rgba(255, 245, 220, 0.22)';
        d.beginPath();
        d.moveTo(20, 0);
        d.lineTo(75, 0);
        d.lineTo(s, s - 55);
        d.lineTo(s, s);
        d.closePath();
        d.fill();

        b.fillStyle = '#c8c8c8';
        b.fillRect(0, 0, s, s);
        r.fillStyle = '#1c1c1c';
        r.fillRect(0, 0, s, s);
      });
      matParams.roughness = 0.12;
      matParams.metalness = 0.45;
      matParams.bumpScale = 0.005;
      break;
    }

    case 'wroughtIron': {
      tex = makeTexturePair(256, 1, 1, (d, b, r, s) => {
        const rand = seededRand(55);
        d.fillStyle = '#242629';
        d.fillRect(0, 0, s, s);
        b.fillStyle = '#a0a0a0';
        b.fillRect(0, 0, s, s);
        r.fillStyle = '#707070';
        r.fillRect(0, 0, s, s);
        addNoiseGrain(d, s, 12, rand);
      });
      matParams.metalness = 0.72;
      matParams.roughness = 0.42;
      break;
    }

    case 'brass': {
      tex = makeTexturePair(256, 1, 1, (d, b, r, s) => {
        const rand = seededRand(99);
        d.fillStyle = '#cfa042';
        d.fillRect(0, 0, s, s);
        b.fillStyle = '#b0b0b0';
        b.fillRect(0, 0, s, s);
        r.fillStyle = '#404040';
        r.fillRect(0, 0, s, s);
        addNoiseGrain(d, s, 10, rand);
      });
      matParams.metalness = 0.85;
      matParams.roughness = 0.28;
      break;
    }

    default: {
      return getProceduralMaterial('cutStone', options);
    }
  }

  const mat = new THREE.MeshStandardMaterial({
    map: tex.map,
    bumpMap: tex.bumpMap,
    roughnessMap: tex.roughnessMap,
    ...matParams,
  });

  materialCache.set(key, mat);
  return mat;
}
