(function(){
  // ===== Canvas / DPR =====
  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  function resize() {
    const logicalW = 900, logicalH = 260;
    canvas.width = logicalW * DPR;
    canvas.height = logicalH * DPR;
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  resize();
  addEventListener('resize', resize);

  // Device detection
  const IS_TOUCH = matchMedia('(hover: none), (pointer: coarse)').matches || ('ontouchstart' in window);
  let SWAY_SCALE = 1;

  const W = 900, H = 260;
  const GROUND_Y = H - 40;

  // ===== Physics (px & seconds) =====
  const GRAVITY = 2500;      // px/s^2
  const JUMP_V = -1000;      // px/s
  const FAST_DROP_MULT = 2.6;
  const MAX_FALL = 1600;

  const rand = (a,b)=>Math.random()*(b-a)+a;

  // ===== Audio with mute =====
  let muted = false;
  addEventListener('keydown', e => { if (e.code==='KeyM') muted = !muted; });
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const beep = (freq=880, time=0.06, type='square', gain=0.03)=>{
    if (muted) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + time);
  };
  function resumeAudio(){ if(audioCtx.state==='suspended'){ audioCtx.resume(); }}

  // ===== Color helper: dark by day, light by night =====
  let skyNight = false;
  function ink(){ return skyNight ? '#e5edf7' : '#111'; }

  // Theme lock: null (auto), 'light', or 'dark'
  let themeLock = null;

  // ===== Dino =====
  class Dino {
    constructor(){
      this.x = 58;
      this.y = GROUND_Y;
      this.baseY = GROUND_Y;
      this.vy = 0;
      this.onGround = true;
      this.ducking = false;
      this.fastDrop = false;
      this.anim = 0;
    }
    jump(){
      if(this.onGround){
        this.vy = JUMP_V;
        this.onGround = false;
        beep(740, .05);
      }
    }
    setDuck(d){
      this.ducking = d && this.onGround;   // визуальный присед на земле
      this.fastDrop = d && !this.onGround; // ускоренное падение в воздухе
    }
    update(dt){
      this.vy += GRAVITY * dt * (this.fastDrop ? FAST_DROP_MULT : 1);
      this.vy = Math.min(this.vy, MAX_FALL);
      this.y += this.vy * dt;
      if(this.y >= this.baseY){
        this.y = this.baseY;
        this.vy = 0;
        if(!this.onGround){ beep(550,.03); }
        this.onGround = true;
        this.fastDrop = false;
      }
      this.anim += 8*dt;
    }
    getHitbox(){
      if(this.ducking){ return {x:this.x-14, y:this.y-24, w:48, h:24}; }
      return {x:this.x-12, y:this.y-44, w:26, h:44};
    }
    draw(ctx){
      ctx.save();
      ctx.translate(this.x, this.y);
      if(this.ducking){ drawDinoDuck(ctx, this.anim); }
      else if(!this.onGround){ drawDinoJump(ctx); }
      else { drawDinoRun(ctx, this.anim); }
      ctx.restore();
    }
  }

  // ===== Procedural Dino sprites =====
  function drawEye(ctx, x, y){ ctx.fillStyle = ink(); ctx.fillRect(x, y, 2, 2); }
  function drawLeg(ctx, x, y, flip=false){
    ctx.fillStyle = ink();
    ctx.fillRect(x, y, 10, 4);
    if(flip){ ctx.fillRect(x+2, y-2, 6, 2); }
    else { ctx.fillRect(x+2, y+4, 6, 2); }
  }
  function drawDinoRun(ctx, t){
    ctx.fillStyle = ink();
    ctx.fillRect(-12,-44, 26, 24);
    ctx.fillRect( 10,-36, 12, 8);
    ctx.fillRect( 18,-46, 10, 12);
    ctx.fillRect( 26,-42, 8, 4);
    ctx.fillRect(-10,-24, 10, 6);
    ctx.fillRect(-16,-28, 10, 6);
    ctx.fillRect(-22,-32, 8, 6);
    drawEye(ctx, 18, -38);
    const phase = Math.sin(t);
    if(phase>0){ drawLeg(ctx, -10, -4, true); drawLeg(ctx, 6, -2, false); }
    else{ drawLeg(ctx, -10, -2, false); drawLeg(ctx, 6, -4, true); }
  }
  function drawDinoJump(ctx){
    ctx.fillStyle = ink();
    ctx.fillRect(-12,-44, 26, 24);
    ctx.fillRect( 10,-36, 12, 8);
    ctx.fillRect( 18,-46, 10, 12);
    ctx.fillRect( 26,-42, 8, 4);
    ctx.fillRect(-10,-24, 10, 6);
    ctx.fillRect(-16,-28, 10, 6);
    ctx.fillRect(-22,-32, 8, 6);
    drawEye(ctx, 18, -38);
    drawLeg(ctx, -10, -4, true);
    drawLeg(ctx, 6, -4, true);
  }
  function drawDinoDuck(ctx, t){
    ctx.fillStyle = ink();
    ctx.fillRect(-10,-28, 36, 18);
    ctx.fillRect( 20,-26, 10, 8);
    ctx.fillRect( 26,-32, 10, 12);
    ctx.fillRect( 34,-28, 8, 4);
    drawEye(ctx, 30, -28);
    const phase = Math.sin(t);
    if(phase>0){ drawLeg(ctx, -8, -4, true); drawLeg(ctx, 10, -2, false); }
    else{ drawLeg(ctx, -8, -2, false); drawLeg(ctx, 10, -4, true); }
  }

  // ===== Obstacles =====
  class Obstacle {
    constructor(type){
      this.type = type;
      if(type==='cactus'){
        const variant = Math.random();
        if(variant<0.45){ this.w=18; this.h=36; this.kind='small'; }
        else if(variant<0.9){ this.w=26; this.h=48; this.kind='big'; }
        else { this.w=44; this.h=48; this.kind='double'; }
        this.x = W + rand(0, 40);
        this.y = GROUND_Y;
        this.flap=0;
      } else {
        this.w = 32; this.h = 26; this.kind='bird';
        this.x = W + rand(0, 40);
        const levels = [GROUND_Y-80, GROUND_Y-50, GROUND_Y-20];
        this.y = levels[Math.floor(rand(0,levels.length))];
        this.flap=0;
      }
    }
    update(dt, speed){ this.x -= speed * dt * 60 * 2.2; this.flap += 3*dt; }
    offscreen(){ return this.x + this.w < -10; }
    hitbox(){ return {x:this.x, y:this.y - this.h, w:this.w, h:this.h}; }
    draw(ctx){
      ctx.fillStyle = ink();
      if(this.type==='cactus'){
        const x=this.x|0, y=this.y|0, w=this.w|0, h=this.h|0;
        ctx.fillRect(x+4, y-h, w-8, h);
        ctx.fillRect(x, y-h+10, 10, 8);
        ctx.fillRect(x+w-10, y-h+16, 10, 8);
        if(this.kind==='double'){
          ctx.fillRect(x+20, y-h, w-8, h-6);
          ctx.fillRect(x+16, y-h+10, 10, 8);
        }
      } else {
        const x=this.x|0, y=this.y|0, w=this.w|0, h=this.h|0;
        ctx.fillRect(x, y-h+10, w, 8);
        const wing = (Math.sin(this.flap)>0)? -10 : 8;
        ctx.fillRect(x+4, y-h+2+wing, 20, 6);
        ctx.fillRect(x+w-4, y-h+12, 4, 4);
      }
    }
  }

  // ===== Background =====
  class Ground {
    constructor(){ this.offset=0; }
    update(dt, speed){ this.offset = (this.offset + speed*dt*60*2.2) % 40; }
    draw(ctx){
      ctx.strokeStyle = ink();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y+2);
      ctx.lineTo(W, GROUND_Y+2);
      ctx.stroke();
      const step = 20;
      for(let x=-this.offset; x<W; x+=step){
        ctx.fillStyle=ink();
        ctx.fillRect(x, GROUND_Y+4, 10, 2);
      }
    }
  }
  class Cloud {
    constructor(){
      this.x = W + rand(0, 200);
      this.baseY = rand(20, 120);
      this.y = this.baseY;
      this.scale = rand(0.6, 1.2);
      this.speed = rand(12, 22);
      this.swayA = rand(2, 5);
      this.t = rand(0, 1000);
      this.depth = rand(0.6, 1.0); // параллакс
    }
    update(dt){
      this.x -= this.speed * dt * 60 * this.depth;
      this.t += dt;
      this.y = this.baseY + Math.sin(this.t * (0.6 + 0.6*this.depth)) * this.swayA * SWAY_SCALE;
    }
    offscreen(){ return this.x < -60; }
    draw(ctx){
      ctx.fillStyle = skyNight ? '#cbd5e1' : '#9aa0a6';
      const x=this.x, y=this.y, s=this.scale;
      ctx.beginPath();
      ctx.arc(x, y, 14*s, 0, Math.PI*2);
      ctx.arc(x+16*s, y-8*s, 12*s, 0, Math.PI*2);
      ctx.arc(x+32*s, y, 16*s, 0, Math.PI*2);
      ctx.fill();
    }
  }

  // ===== Simple Parallax Ridges =====
  class Parallax {
    constructor(){ this.offFar=0; this.offNear=0; }
    update(dt, speed){
      this.offFar = (this.offFar + speed*dt*60*0.35) % 200;
      this.offNear = (this.offNear + speed*dt*60*0.7) % 160;
    }
    draw(ctx){
      const stepFar = IS_TOUCH?40:32, stepNear = IS_TOUCH?32:26;
      this.drawRidge(ctx, GROUND_Y-54, stepFar, 10, this.offFar, skyNight ? 0.18 : 0.22);
      this.drawRidge(ctx, GROUND_Y-30, stepNear, 14, this.offNear, skyNight ? 0.28 : 0.35);
    }
    drawRidge(ctx, y, step, h, offset, alpha){
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ink();
      ctx.beginPath();
      ctx.moveTo(0, y);
      for(let x=-offset; x<=W+step; x+=step){
        const bump = (Math.sin((x+offset)*0.08)+Math.sin((x+offset)*0.03))*0.5;
        const yy = y - h*(0.6 + 0.4*bump);
        ctx.lineTo(x, yy);
      }
      ctx.lineTo(W, y+60); ctx.lineTo(0, y+60);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  
  // ===== Performance Adaptive Quality (FPS-based) =====
  class Perf {
    constructor(){
      this.fpsEMA = 60;
      this.lowTimer = 0;
      this.highTimer = 0;
      this.level = 2; // 0=low,1=med,2=high
    }
    update(dt){
      // exponential moving average of FPS
      const fps = dt>0 ? 1/dt : 60;
      const a = 0.1; // smoothing
      this.fpsEMA = this.fpsEMA*(1-a) + fps*a;

      // hysteresis: go down if <45 for 0.7s; go up if >57 for 1.5s
      if (this.fpsEMA < 45){ this.lowTimer += dt; } else { this.lowTimer = 0; }
      if (this.fpsEMA > 57){ this.highTimer += dt; } else { this.highTimer = 0; }

      if (this.lowTimer > 0.7 && this.level > 0){ this.level--; this.lowTimer = 0; }
      if (this.highTimer > 1.5 && this.level < 2){ this.level++; this.highTimer = 0; }
    }
    getProfile(){
      const P = Perf.PROFILES[this.level];
      return P;
    }
  }
  Perf.PROFILES = [
    // LOW
    { name:'low', maxClouds: IS_TOUCH?6:8, cloudSpawnProb: IS_TOUCH?0.012:0.018, starCount: IS_TOUCH?12:15,
      stepFar: IS_TOUCH?52:48, stepNear: IS_TOUCH?44:40, rays:0, glow:0.42, cloudSway:0.6 },
    // MED
    { name:'med', maxClouds: IS_TOUCH?8:12, cloudSpawnProb: IS_TOUCH?0.02:0.028, starCount: IS_TOUCH?18:25,
      stepFar: IS_TOUCH?44:40, stepNear: IS_TOUCH?34:32, rays:8, glow:0.5, cloudSway:0.85 },
    // HIGH
    { name:'high', maxClouds: IS_TOUCH?10:14, cloudSpawnProb: IS_TOUCH?0.025:0.035, starCount: IS_TOUCH?25:35,
      stepFar: IS_TOUCH?40:32, stepNear: IS_TOUCH?32:26, rays:12, glow:0.55, cloudSway:1.0 },
  ];

  const perf = new Perf();
let perfOverride = null; // null=auto, 0=low,1=med,2=high
function qualityName(l){return Perf.PROFILES[l].name;}
function qualityIcon(l){return ['🐢','🌀','⚡'][l];}
// ===== Sun & Moon animated along arc =====
  function drawSunMoon(ctx, phase, progress, profile){
    const margin = 60;
    const cx = margin + (W - margin*2) * progress;
    const arch = 16;
    const cy = 40 - Math.sin(progress * Math.PI) * arch;

    if(phase<=0.5){
      const R = 16;
      ctx.save();
      ctx.globalAlpha = (profile && profile.glow) ? profile.glow : 0.55;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath(); ctx.arc(cx, cy, R*1.8, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, R);
      g.addColorStop(0, '#fff7b2');
      g.addColorStop(0.55, '#fde047');
      g.addColorStop(1, '#f59e0b');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.fill();
      const t = performance.now() * 0.002;
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#fbbf24';
      for(let i=0;i<((profile&&profile.rays)||12);i++){
        const a = i * (Math.PI*2/12) + Math.sin(t + i)*0.06;
        const r1 = R*1.05, r2 = R*1.55 + Math.sin(t*1.3 + i)*1.2;
        const w = 2.0;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a-w/R)*r1, cy + Math.sin(a-w/R)*r1);
        ctx.lineTo(cx + Math.cos(a)*r2,     cy + Math.sin(a)*r2);
        ctx.lineTo(cx + Math.cos(a+w/R)*r1, cy + Math.sin(a+w/R)*r1);
        ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    } else {
      const R = 12;
      // soft glow
      ctx.save();
      ctx.globalAlpha = 0.45; ctx.fillStyle = '#dbeafe';
      ctx.beginPath(); ctx.arc(cx, cy, R*1.8, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
      // gradient disc
      const mg = ctx.createRadialGradient(cx-2, cy-2, 2, cx, cy, R);
      mg.addColorStop(0, '#ffffff');
      mg.addColorStop(0.6, '#e5efff');
      mg.addColorStop(1, '#bccbe8');
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.fill();
      // terminator and craters
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath(); ctx.arc(cx+4, cy-2, R*0.9, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath(); ctx.arc(cx-3, cy+2, 2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx+5, cy, 1.6, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  // ===== Game =====
  class Game {
    constructor(){ this.themeFlip=0; this.reset(); }
    reset(){
      this.state = 'ready';
      this.elapsed = 0;
      this.score = 0;
      this.high = parseInt(localStorage.getItem('dino_high')||'0',10);
      this.speed = 6;
      this.spawnTimer = 0;
      this.dino = new Dino();
      this.ground = new Ground();
      this.parallax = new Parallax();
      this.obstacles = [];
      this.clouds = Array.from({length: IS_TOUCH?6:8}, ()=>new Cloud());
      this.stars = Array.from({length: IS_TOUCH?25:35}, ()=>new Star());
      this.lastMilestonePlayed = false;
      this.skyPhase = 0;       // 0..1
      this.dayProgress = 0;    // 0..1
      this.profile = Perf.PROFILES[2];
    }
    start(){
      if(this.state==='ready' || this.state==='dead'){
        this.state='running';
        this.elapsed = 0; this.score = 0;
        this.obstacles.length=0;
        this.clouds = Array.from({length: IS_TOUCH?6:8}, ()=>new Cloud());
        this.dino = new Dino();
        this.speed = 6;
        this.lastMilestonePlayed = false;
        this.skyPhase = 0;
        this.dayProgress = 0;
      }
    }
    togglePause(){ if(this.state==='running'){ this.state='paused'; } else if(this.state==='paused'){ this.state='running'; } }
    update(dt){
      if(this.state!=='running') return;
      this.elapsed += dt;

      // Сложность
      this.speed = 6 + this.elapsed * 0.45;
      const sInt = Math.floor(this.score);
      if (sInt > 0 && sInt % 100 === 0 && !this.lastMilestonePlayed){
        beep(1320,.05,'square',0.03);
        this.speed += 0.3;
        this.lastMilestonePlayed = true;
      } else if (sInt % 100 === 1) {
        this.lastMilestonePlayed = false;
      }

      // Фон/облака/параллакс
      for(const c of this.clouds){ c.update(dt); }
      if(this.clouds.length < (IS_TOUCH?10:14) && Math.random() < (IS_TOUCH?0.025:0.035)){ this.clouds.push(new Cloud()); }
      this.clouds = this.clouds.filter(c=>!c.offscreen());
      this.parallax.update(dt, this.speed);
      this.ground.update(dt, this.speed);
      this.dino.update(dt);

      // Спавн препятствий
      this.spawnTimer -= dt;
      if(this.spawnTimer<=0){
        const type = (Math.random()<0.8)? 'cactus' : 'bird';
        this.obstacles.push(new Obstacle(type));
        const gap = rand(0.7, 1.2) * (16 / this.speed);
        this.spawnTimer = Math.max(0.45, gap);
      }
      for(const o of this.obstacles){ o.update(dt, this.speed); }
      this.obstacles = this.obstacles.filter(o=>!o.offscreen());

      // Очки
      this.score += (0.1 + this.speed*0.01) * (dt*60);

      // День/ночь
      const speedPhase = 1.5;
      const cycleLen = 400;
      const cycle = this.score / cycleLen;
      this.dayProgress = cycle - Math.floor(cycle);
      const targetNight = (((Math.floor(cycle) % 2) ^ this.themeFlip) === 1);
      this.skyPhase += ( (targetNight?1:0) - this.skyPhase ) * Math.min(1, speedPhase*dt);
      skyNight = this.skyPhase > 0.5;

      // Столкновения
      const hb = this.dino.getHitbox();
      for(const o of this.obstacles){
        const ob = o.hitbox();
        const pad = 3;
        if(hb.x+pad < ob.x+ob.w-pad &&
           hb.x+hb.w-pad > ob.x+pad &&
           hb.y+pad < ob.y+ob.h-pad &&
           hb.y+hb.h-pad > ob.y+pad){
          beep(200,.12,'sawtooth',0.04);
          this.state='dead';
          if(this.score>this.high){
            this.high = Math.round(this.score);
            localStorage.setItem('dino_high', String(this.high));
          }
          break;
        }
      }
    }
    draw(){
      // фон
      const mix = this.skyPhase;
      ctx.fillStyle = mix>0.5 ? '#0b1220' : '#ffffff';
      ctx.fillRect(0,0,W,H);

      // солнце/луна, звезды, облака, параллакс, земля
      drawSunMoon(ctx, mix, this.dayProgress || 0, this.profile);
      this.parallax.draw(ctx, this.profile);
      for(const c of this.clouds) c.draw(ctx);
      this.ground.draw(ctx);

      // объекты и динозавр
      for(const o of this.obstacles) o.draw(ctx);
      this.dino.draw(ctx);

      // HUD
      const score = Math.round(this.score).toString().padStart(5,'0');
      const high = this.high.toString().padStart(5,'0');
      ctx.fillStyle = mix>0.5 ? '#e2e8f0' : '#374151';
      ctx.font = '14px monospace';
      ctx.textAlign='right';
      ctx.fillText('HI '+high+'  '+score, W-12, 22);
      ctx.textAlign='center';
      if(this.state==='ready'){
        ctx.fillStyle = '#6b7280';
        ctx.font = '16px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
        ctx.fillText('Нажмите Space/↑ или коснитесь экрана, чтобы начать', W/2, H/2-6);
        ctx.fillText('M — звук, H — хитбоксы', W/2, H/2+16);
      } else if(this.state==='paused'){
        ctx.fillStyle = '#111';
        ctx.font = 'bold 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
        ctx.fillText('ПАУЗА', W/2, H/2);
      } else if(this.state==='dead'){
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
        ctx.fillText('ИГРА ОКОНЧЕНА — нажмите R, чтобы начать заново', W/2, H/2);
      }

      // debug hitboxes
      if (debugHB){
        const hb = this.dino.getHitbox();
        ctx.strokeStyle = '#22c55e'; ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);
        ctx.strokeStyle = '#ef4444';
        for (const o of this.obstacles){ const ob=o.hitbox(); ctx.strokeRect(ob.x, ob.y, ob.w, ob.h); }
      }
    }
  }

  // Simple twinkling stars (keep it after Game for array init)
  class Star {
    constructor(){ this.x = rand(0,W); this.y = rand(0,120); this.t = rand(0,Math.PI*2); }
    update(dt){ this.t += dt*2; }
    draw(ctx){ if(!skyNight) return;
      ctx.globalAlpha = 0.6 + 0.4*Math.sin(this.t);
      ctx.fillStyle='#eef2ff';
      ctx.fillRect(this.x, this.y, 2, 2);
      ctx.globalAlpha = 1;
    }
  }

  const game = new Game();

  // ===== Main loop with deltaTime =====
  let last = performance.now(); let hudTick = 0;
  function loop(now = performance.now()){
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;
    perf.update(dt);
    if(perfOverride!==null){ perf.level = Math.max(0, Math.min(2, perfOverride)); }
    game.profile = perf.getProfile();
    game.update(dt);
    game.draw();
    // update FPS/stat every few frames
    hudTick = (hudTick+1)%10; if(hudTick===0){ const el = document.getElementById('perfStat'); if(el){ el.textContent = `FPS: ${Math.round(perf.fpsEMA)} | Q: ${qualityName(perf.level)} ${perfOverride===null?'(auto)':'(manual)'}`; } }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ===== Controls =====
  let debugHB = false;
  addEventListener('keydown', (e)=>{
    if(['Space','ArrowUp','ArrowDown','KeyP','KeyR','KeyM','KeyH'].includes(e.code)) e.preventDefault();
    if(e.code==='KeyP'){ game.togglePause(); return; }
    if(e.code==='KeyR'){ game.reset(); game.start(); return; }
    if(e.code==='KeyH'){ debugHB = !debugHB; return; }
    if(game.state==='ready'){ if(e.code==='Space' || e.code==='ArrowUp'){ resumeAudio(); game.start(); } }
    else if(game.state==='running'){
      if(e.code==='Space' || e.code==='ArrowUp'){ resumeAudio(); game.dino.jump(); }
      if(e.code==='ArrowDown'){ game.dino.setDuck(true); }
    } else if(game.state==='dead'){
      if(e.code==='Space' || e.code==='ArrowUp'){ game.reset(); game.start(); }
    }
  });
  addEventListener('keyup', (e)=>{ if(e.code==='ArrowDown'){ game.dino.setDuck(false); } });

  // Touch / pointer: immediate jump on down; swipe down to duck
  let touchStartY = null; let touchActive=false;
  canvas.addEventListener('pointerdown', (e)=>{
    e.preventDefault(); resumeAudio();
    if(game.state==='ready'){ game.start(); return; }
    if(game.state==='dead'){ game.reset(); game.start(); return; }
    touchStartY = e.clientY; touchActive=true;
    if(game.state==='running' && game.dino.onGround){ game.dino.jump(); }
  });
  canvas.addEventListener('pointerup', (e)=>{
    if(!touchActive) return; e.preventDefault();
    game.dino.setDuck(false);
    touchActive=false; touchStartY=null;
  });
  canvas.addEventListener('pointermove', (e)=>{
    if(!touchActive) return; e.preventDefault();
    const dy = e.clientY - touchStartY;
    if(dy>20){ game.dino.setDuck(true); } else { game.dino.setDuck(false); }
  });

  // Mobile on-screen buttons (if present)
  const btnJump = document.getElementById('btnJump');
  const btnDuck = document.getElementById('btnDuck');
  const btnRestart = document.getElementById('btnRestart');
  const btnTheme = document.getElementById('btnTheme');
  const btnPerf = document.getElementById('btnPerf');
  if (btnJump){
    if(btnPerf){
      const cycle = ()=>{
        if(perfOverride===null) perfOverride=2; else if(perfOverride===2) perfOverride=1; else if(perfOverride===1) perfOverride=0; else perfOverride=null;
        btnPerf.textContent = perfOverride===null? '⚙️ Auto' : (qualityIcon(perfOverride)+' '+qualityName(perfOverride));
      };
      btnPerf.onclick = cycle;
    }


  // === Device-specific help text ===
  const isTouch = matchMedia('(hover: none), (pointer: coarse)').matches || ('ontouchstart' in window);
  const helpEl = document.getElementById('helpText');
  const mobileControls = document.querySelector('.mobile-controls');
  if (helpEl){
    if (isTouch){
      helpEl.textContent = 'Нажмите на экран (свайп вниз — пригнуться)';
      if (mobileControls) mobileControls.style.display = 'none';
    } else {
      helpEl.innerHTML = 'Управление: <kbd>Space</kbd>/<kbd>↑</kbd> — прыжок, <kbd>↓</kbd> — пригнуться, <kbd>P</kbd> — пауза, <kbd>R</kbd> — рестарт, <kbd>M</kbd> — звук, <kbd>H</kbd> — хитбоксы';
    }
  }

    if(btnTheme){ btnTheme.onclick = ()=>{ game.themeFlip ^= 1; }; }

    // Theme chooser buttons
    const chooser = document.getElementById('themeChooser');
    const chooseLight = document.getElementById('chooseLight');
    const chooseDark = document.getElementById('chooseDark');
    if(chooseLight && chooseDark && chooser){
      const pick = (mode)=>{
        chooser.style.display='none';
        game.themeFlip = (mode==='dark') ? 1 : 0; // только стартовый выбор
        game.reset();
      };
      chooseLight.onclick = ()=> pick('light');
      chooseDark.onclick  = ()=> pick('dark');
    }

    btnJump.onclick = ()=>{ if(game.state==='running') game.dino.jump(); else if(game.state!=='paused'){ game.reset(); game.start(); } };
    btnDuck.onpointerdown = ()=> game.dino.setDuck(true);
    btnDuck.onpointerup   = ()=> game.dino.setDuck(false);
    btnRestart.onclick = ()=>{ game.reset(); game.start(); };
  }

  // Auto-pause when tab hidden
  document.addEventListener('visibilitychange', ()=>{
    if (document.hidden && game.state==='running') game.togglePause();
  });
})();