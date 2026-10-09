/**
 * Som de venda do admin: um "ka-ching" de caixa registradora sintetizado no
 * navegador — tecla e gaveta, sino e moedas chacoalhando —, no estilo do aviso
 * de venda da Shopify. Não usa o arquivo da Shopify, que é deles.
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

/** Toque metálico: parciais inarmônicos (como um sino) com ataque rápido e cauda. */
const ring = (ctx: AudioContext, out: AudioNode, at: number, base: number, volume: number, length = 1) => {
  const partials: Array<[ratio: number, gain: number, decay: number]> = [
    [1, 1, 1.1],
    [2.76, 0.5, 0.6],
    [5.4, 0.28, 0.32],
    [8.93, 0.14, 0.18],
  ];
  for (const [ratio, gain, decay] of partials) {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(base * ratio, at);
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.exponentialRampToValueAtTime(volume * gain, at + 0.003);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + decay * length);
    osc.connect(amp).connect(out);
    osc.start(at);
    osc.stop(at + decay * length + 0.05);
  }
};

/** Ruído curto com envelope de queda rápida (base dos estalos mecânicos). */
const noiseBurst = (ctx: AudioContext, seconds: number, random: () => number) => {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (random() * 2 - 1) * (1 - i / length) ** 4;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  return source;
};

/** "Ka": a tecla da registradora (estalo seco) e a gaveta abrindo (baque grave). */
const registerClunk = (ctx: AudioContext, out: AudioNode, at: number, random: () => number) => {
  const click = noiseBurst(ctx, 0.025, random);
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 3200;
  band.Q.value = 0.9;
  const clickAmp = ctx.createGain();
  clickAmp.gain.value = 0.55;
  click.connect(band).connect(clickAmp).connect(out);
  click.start(at);

  const thump = ctx.createOscillator();
  const thumpAmp = ctx.createGain();
  thump.type = "sine";
  thump.frequency.setValueAtTime(170, at + 0.012);
  thump.frequency.exponentialRampToValueAtTime(55, at + 0.11);
  thumpAmp.gain.setValueAtTime(0.0001, at + 0.012);
  thumpAmp.gain.exponentialRampToValueAtTime(0.4, at + 0.018);
  thumpAmp.gain.exponentialRampToValueAtTime(0.0001, at + 0.13);
  thump.connect(thumpAmp).connect(out);
  thump.start(at + 0.012);
  thump.stop(at + 0.16);

  // o trinco da gaveta: um segundo estalo, mais fraco
  const latch = noiseBurst(ctx, 0.018, random);
  const latchFilter = ctx.createBiquadFilter();
  latchFilter.type = "highpass";
  latchFilter.frequency.value = 1800;
  const latchAmp = ctx.createGain();
  latchAmp.gain.value = 0.25;
  latch.connect(latchFilter).connect(latchAmp).connect(out);
  latch.start(at + 0.045);
};

/** Moedas chacoalhando: pequenos tilintares agudos em sequência irregular. */
const coins = (ctx: AudioContext, out: AudioNode, at: number, random: () => number) => {
  let t = at;
  for (let i = 0; i < 11; i += 1) {
    t += 0.018 + random() * 0.04;
    const fade = 1 - i / 13;
    const base = 3900 + random() * 3300;
    const volume = (0.05 + random() * 0.07) * fade;
    for (const [ratio, gain] of [
      [1, 1],
      [1.47 + random() * 0.08, 0.55],
      [2.31 + random() * 0.1, 0.3],
    ] as const) {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      const decay = 0.05 + random() * 0.12;
      osc.type = "sine";
      osc.frequency.setValueAtTime(base * ratio, t);
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.exponentialRampToValueAtTime(volume * gain, t + 0.002);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      osc.connect(amp).connect(out);
      osc.start(t);
      osc.stop(t + decay + 0.02);
    }
    // o "tchk" do metal batendo
    const tick = noiseBurst(ctx, 0.006, random);
    const tickFilter = ctx.createBiquadFilter();
    tickFilter.type = "highpass";
    tickFilter.frequency.value = 6000;
    const tickAmp = ctx.createGain();
    tickAmp.gain.value = volume * 1.6;
    tick.connect(tickFilter).connect(tickAmp).connect(out);
    tick.start(t);
  }
};

/** Gerador pseudoaleatório com semente fixa: o som sai igual toda vez. */
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

/**
 * "Ka-ching" de caixa registradora: tecla + gaveta ("ka"), sino brilhante
 * ("ching") com um segundo toque por cima e moedas chacoalhando no fim.
 */
const playSynth = (ctx: AudioContext) => {
  const random = seeded(7);
  const master = ctx.createGain();
  master.gain.value = 0.85;
  // leve brilho e um compressor para o som sair cheio sem estourar
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.ratio.value = 4;
  master.connect(compressor).connect(ctx.destination);

  const now = ctx.currentTime + 0.02;
  registerClunk(ctx, master, now, random);
  ring(ctx, master, now + 0.085, 2093, 0.3, 1.15); // C7 — o "ching"
  ring(ctx, master, now + 0.15, 2637, 0.22, 0.9); // E7 por cima, como o sino duplo da registradora
  coins(ctx, master, now + 0.16, random);
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
