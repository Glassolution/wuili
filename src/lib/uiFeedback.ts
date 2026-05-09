let audioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (typeof window === "undefined") return null;

  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  if (!audioContext) {
    audioContext = new AudioCtx();
  }

  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }

  return audioContext;
};

export const playSatisfyingClick = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.07, now + 0.012);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
  master.connect(ctx.destination);

  const body = ctx.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(280, now);
  body.frequency.exponentialRampToValueAtTime(220, now + 0.16);

  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(0.0001, now);
  bodyGain.gain.exponentialRampToValueAtTime(0.7, now + 0.016);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

  const pillow = ctx.createOscillator();
  pillow.type = "triangle";
  pillow.frequency.setValueAtTime(520, now + 0.004);
  pillow.frequency.exponentialRampToValueAtTime(380, now + 0.12);

  const pillowGain = ctx.createGain();
  pillowGain.gain.setValueAtTime(0.0001, now);
  pillowGain.gain.exponentialRampToValueAtTime(0.16, now + 0.012);
  pillowGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

  const mist = ctx.createOscillator();
  mist.type = "sine";
  mist.frequency.setValueAtTime(760, now + 0.01);
  mist.frequency.exponentialRampToValueAtTime(620, now + 0.08);

  const mistGain = ctx.createGain();
  mistGain.gain.setValueAtTime(0.0001, now);
  mistGain.gain.exponentialRampToValueAtTime(0.045, now + 0.012);
  mistGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

  body.connect(bodyGain);
  pillow.connect(pillowGain);
  mist.connect(mistGain);
  bodyGain.connect(master);
  pillowGain.connect(master);
  mistGain.connect(master);

  body.start(now);
  pillow.start(now + 0.003);
  mist.start(now + 0.01);
  body.stop(now + 0.22);
  pillow.stop(now + 0.15);
  mist.stop(now + 0.1);
};

export const playSoftTypeSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.028, now + 0.008);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
  master.connect(ctx.destination);

  const body = ctx.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(420, now);
  body.frequency.exponentialRampToValueAtTime(340, now + 0.08);

  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(0.0001, now);
  bodyGain.gain.exponentialRampToValueAtTime(0.65, now + 0.01);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

  const click = ctx.createOscillator();
  click.type = "triangle";
  click.frequency.setValueAtTime(760, now);
  click.frequency.exponentialRampToValueAtTime(520, now + 0.05);

  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(0.0001, now);
  clickGain.gain.exponentialRampToValueAtTime(0.085, now + 0.006);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

  body.connect(bodyGain);
  click.connect(clickGain);
  bodyGain.connect(master);
  clickGain.connect(master);

  body.start(now);
  click.start(now);
  body.stop(now + 0.1);
  click.stop(now + 0.06);
};

export const playSendSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.065, now + 0.012);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  master.connect(ctx.destination);

  const lift = ctx.createOscillator();
  lift.type = "triangle";
  lift.frequency.setValueAtTime(320, now);
  lift.frequency.exponentialRampToValueAtTime(520, now + 0.09);

  const liftGain = ctx.createGain();
  liftGain.gain.setValueAtTime(0.0001, now);
  liftGain.gain.exponentialRampToValueAtTime(0.52, now + 0.012);
  liftGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

  const shine = ctx.createOscillator();
  shine.type = "sine";
  shine.frequency.setValueAtTime(720, now + 0.01);
  shine.frequency.exponentialRampToValueAtTime(900, now + 0.08);

  const shineGain = ctx.createGain();
  shineGain.gain.setValueAtTime(0.0001, now);
  shineGain.gain.exponentialRampToValueAtTime(0.09, now + 0.018);
  shineGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);

  lift.connect(liftGain);
  shine.connect(shineGain);
  liftGain.connect(master);
  shineGain.connect(master);

  lift.start(now);
  shine.start(now + 0.01);
  lift.stop(now + 0.17);
  shine.stop(now + 0.13);
};
