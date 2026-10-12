/**
 * Som de venda do admin: um "ka-ching" de caixa registradora sintetizado no
 * navegador — tecla, gaveta correndo e batendo, sino de metal e moedas quicando,
 * com um reverb curto de sala —, no estilo do aviso de venda da Shopify e dos
 * apps de gateway. Não usa o arquivo da Shopify, que é deles.
 *
 * Para trocar por um som próprio, coloque um arquivo em public/sons/venda.mp3:
 * se ele existir, toca no lugar do sintetizado.
 *
 * Navegadores só liberam áudio depois de algum clique ou tecla na página.
 * `unlockSaleSound` é chamado no primeiro clique do admin; a partir daí o som
 * toca mesmo com a aba em segundo plano.
 */

const CUSTOM_SOUND_URL = "/sons/venda.mp3";

let context: AudioContext | null = null;
let customBuffer: AudioBuffer | null = null;
let customChecked = false;

const getContext = () => {
  if (context) return context;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context = new Ctor();
  return context;
};

const loadCustomSound = async (ctx: AudioContext) => {
  if (customChecked) return;
  customChecked = true;
  try {
    const response = await fetch(CUSTOM_SOUND_URL, { cache: "force-cache" });
    // sem o arquivo, o servidor devolve a página do app (HTML) em vez de áudio
    if (!response.ok || !(response.headers.get("content-type") ?? "").startsWith("audio")) return;
    customBuffer = await ctx.decodeAudioData(await response.arrayBuffer());
  } catch {
    customBuffer = null;
  }
};

/** Libera o áudio (precisa vir de um clique/tecla) e prepara o som próprio, se houver. */
export const unlockSaleSound = () => {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  void loadCustomSound(ctx);
};

export const isSaleSoundReady = () => context?.state === "running";

/** Gerador pseudoaleatório com semente fixa: o som sai igual toda vez. */
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

/** Ruído branco; `curve` > 0 faz ele cair rápido (estalos), 0 deixa constante. */
const noise = (ctx: AudioContext, seconds: number, random: () => number, curve = 4) => {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (random() * 2 - 1) * (1 - i / length) ** curve;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  return source;
};

/** Ruído passando por um filtro, com volume fixo — base de todos os estalos mecânicos. */
const filteredNoise = (
  ctx: AudioContext,
  out: AudioNode,
  at: number,
  random: () => number,
  { seconds, type, frequency, q = 1, volume, curve = 4 }: {
    seconds: number;
    type: BiquadFilterType;
    frequency: number;
    q?: number;
    volume: number;
    curve?: number;
  },
) => {
  const source = noise(ctx, seconds, random, curve);
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const amp = ctx.createGain();
  amp.gain.value = volume;
  source.connect(filter).connect(amp).connect(out);
  source.start(at);
  return amp;
};

/** Um modo de vibração: seno com ataque quase instantâneo e queda exponencial. */
const mode = (ctx: AudioContext, out: AudioNode, at: number, frequency: number, volume: number, decay: number) => {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, at);
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0002), at + 0.0015);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  osc.connect(amp).connect(out);
  osc.start(at);
  osc.stop(at + decay + 0.02);
};

/** Sala pequena: reverb curto gerado na hora, para o som não parecer "seco" de computador. */
const room = (ctx: AudioContext, seconds: number, random: () => number) => {
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) data[i] = (random() * 2 - 1) * Math.exp((-7 * i) / length);
  }
  const convolver = ctx.createConvolver();
  convolver.buffer = impulse;
  return convolver;
};

/**
 * "Ka": a tecla descendo, a gaveta correndo no trilho (com os estalos da
 * catraca) e batendo no fim do curso. Devolve o instante da batida.
 */
const drawer = (ctx: AudioContext, out: AudioNode, at: number, random: () => number) => {
  // a tecla
  filteredNoise(ctx, out, at, random, { seconds: 0.02, type: "bandpass", frequency: 2600, q: 1.2, volume: 0.6 });
  mode(ctx, out, at + 0.002, 1150, 0.06, 0.04);

  // a gaveta deslizando: chiado metálico que cresce e para na batida
  const slideStart = at + 0.025;
  const slideEnd = at + 0.115;
  const slide = filteredNoise(ctx, out, slideStart, random, {
    seconds: slideEnd - slideStart,
    type: "bandpass",
    frequency: 1500,
    q: 0.8,
    volume: 0,
    curve: 0,
  });
  slide.gain.setValueAtTime(0.0001, slideStart);
  slide.gain.exponentialRampToValueAtTime(0.16, slideEnd - 0.01);
  slide.gain.linearRampToValueAtTime(0, slideEnd);

  // a catraca do trilho: estalinhos cada vez mais rápidos
  let t = slideStart;
  for (let i = 0; i < 7; i += 1) {
    t += 0.016 - i * 0.0013;
    filteredNoise(ctx, out, t, random, { seconds: 0.005, type: "bandpass", frequency: 4200, q: 2, volume: 0.12 + i * 0.02 });
  }

  // a batida: baque grave + estalo + a carcaça de metal ressoando
  const hit = slideEnd;
  const thump = ctx.createOscillator();
  const thumpAmp = ctx.createGain();
  thump.type = "sine";
  thump.frequency.setValueAtTime(140, hit);
  thump.frequency.exponentialRampToValueAtTime(45, hit + 0.12);
  thumpAmp.gain.setValueAtTime(0.0001, hit);
  thumpAmp.gain.exponentialRampToValueAtTime(0.55, hit + 0.004);
  thumpAmp.gain.exponentialRampToValueAtTime(0.0001, hit + 0.16);
  thump.connect(thumpAmp).connect(out);
  thump.start(hit);
  thump.stop(hit + 0.18);
  filteredNoise(ctx, out, hit, random, { seconds: 0.06, type: "lowpass", frequency: 3000, volume: 0.45, curve: 3 });
  for (const [frequency, volume, decay] of [
    [330, 0.07, 0.12],
    [547, 0.05, 0.1],
    [881, 0.04, 0.08],
    [1393, 0.03, 0.06],
  ]) {
    mode(ctx, out, hit, frequency, volume, decay);
  }
  return hit;
};

/**
 * Modos do sino da registradora (proporção, volume, duração). São
 * inarmônicos, como num sino de metal de verdade.
 */
const BELL_MODES: Array<[ratio: number, gain: number, decay: number]> = [
  [1, 1, 1.7],
  [1.51, 0.42, 1.1],
  [2.29, 0.4, 0.8],
  [3.13, 0.22, 0.5],
  [4.24, 0.13, 0.32],
  [5.53, 0.08, 0.2],
];

/**
 * "Ching": o martelinho batendo no sino. Cada modo vibra em par levemente
 * desafinado — o batimento entre os dois é o brilho trêmulo do sino de metal.
 */
const bell = (ctx: AudioContext, out: AudioNode, at: number, base: number, volume: number, random: () => number) => {
  for (const [ratio, gain, decay] of BELL_MODES) {
    const beat = 1.6 + ratio * 1.1;
    mode(ctx, out, at, base * ratio - beat / 2, volume * gain * 0.55, decay);
    mode(ctx, out, at, base * ratio + beat / 2, volume * gain * 0.45, decay * 0.9);
  }
  // o "tic" do martelo encostando no metal
  filteredNoise(ctx, out, at, random, { seconds: 0.008, type: "highpass", frequency: 5000, volume: volume * 0.9 });
};

/** Uma moeda caindo e quicando na gaveta, cada quique mais rápido e mais fraco. */
const coin = (ctx: AudioContext, out: AudioNode, at: number, volume: number, random: () => number) => {
  const base = 4300 + random() * 2600;
  const ratios = [1, 1.59 + random() * 0.05, 2.2 + random() * 0.06, 2.82 + random() * 0.08];
  let t = at;
  let gap = 0.05 + random() * 0.03;
  let level = volume;
  for (let bounce = 0; bounce < 5; bounce += 1) {
    ratios.forEach((ratio, i) => {
      mode(ctx, out, t, base * ratio, (level / (i + 1)) * (0.6 + random() * 0.4), 0.06 + random() * 0.14);
    });
    filteredNoise(ctx, out, t, random, { seconds: 0.004, type: "highpass", frequency: 6500, volume: level * 1.4 });
    t += gap;
    gap *= 0.62;
    level *= 0.6;
  }
};

/**
 * "Ka-ching" de caixa registradora: tecla e gaveta correndo ("ka"), sino
 * batido na hora que a gaveta abre ("ching") e moedas quicando na gaveta,
 * tudo dentro de uma sala pequena.
 */
const playSynth = (ctx: AudioContext) => {
  const random = seeded(7);

  // tudo passa por um compressor para sair cheio sem estourar
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -16;
  compressor.knee.value = 8;
  compressor.ratio.value = 5;
  compressor.attack.value = 0.002;
  compressor.release.value = 0.15;
  compressor.connect(ctx.destination);

  const dry = ctx.createGain();
  dry.gain.value = 0.8;
  dry.connect(compressor);

  const reverb = room(ctx, 0.8, random);
  const damping = ctx.createBiquadFilter();
  damping.type = "lowpass";
  damping.frequency.value = 6500;
  const wet = ctx.createGain();
  wet.gain.value = 0.2;
  dry.connect(reverb).connect(damping).connect(wet).connect(compressor);

  const now = ctx.currentTime + 0.03;
  const hit = drawer(ctx, dry, now, random);

  // o sino toca junto com a batida da gaveta; o martelo ainda quica uma vez
  bell(ctx, dry, hit + 0.004, 2350, 0.42, random);
  bell(ctx, dry, hit + 0.04, 2350, 0.12, random);

  // moedas, espalhadas um pouco entre os lados
  const coinsStart = hit + 0.07;
  [
    [0, -0.35, 0.09],
    [0.045, 0.3, 0.07],
    [0.11, -0.1, 0.06],
    [0.17, 0.45, 0.04],
  ].forEach(([delay, pan, volume]) => {
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(dry);
    coin(ctx, panner, coinsStart + delay, volume, random);
  });
};

/** Toca o som de venda. Devolve falso se o navegador ainda não liberou o áudio. */
export const playSaleSound = async (): Promise<boolean> => {
  const ctx = getContext();
  if (!ctx) return false;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return false;
    }
  }
  if (ctx.state !== "running") return false;
  await loadCustomSound(ctx);
  if (customBuffer) {
    const source = ctx.createBufferSource();
    source.buffer = customBuffer;
    source.connect(ctx.destination);
    source.start();
  } else {
    playSynth(ctx);
  }
  return true;
};
