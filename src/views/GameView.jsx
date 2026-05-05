import React, { useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, X, Check, Star } from 'lucide-react';
import { fbGet, fbSave } from '../firebase.js';
import { useApp } from '../context/AppContext';

export default function GameView() {
  const { setCurrentView } = useApp();

  const containerRef = useRef(null);
  const gRef = useRef(null);

  const handleBack = useCallback(() => {
    if (gRef.current) gRef.current.running = false;
    setCurrentView('menu');
  }, []);

  useEffect(() => {
    const box = containerRef.current;
    if (!box) return;
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;user-select:none;-webkit-user-select:none;';
    box.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 2, 2);

    let W = 0, H = 0, GW = 0, GX = 0;
    // Pre-created gradients (performance: created once, not per-frame)
    let skyGrad = null, seaGrad = null;

    const doResize = () => {
      const r = box.getBoundingClientRect();
      W = canvas.width = Math.max(1, Math.round(r.width * dpr));
      H = canvas.height = Math.max(1, Math.round(r.height * dpr));
      // ★ BLOCK 1.2 — game field max width for desktop
      GW = Math.min(W, H * 0.6);
      GX = (W - GW) / 2;
      // Recreate gradients on resize
      skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.42);
      skyGrad.addColorStop(0, '#87CEEB');
      skyGrad.addColorStop(1, '#E0F4FF');
      seaGrad = ctx.createLinearGradient(0, H * 0.07, 0, H * 0.15);
      seaGrad.addColorStop(0, '#3a7bd5');
      seaGrad.addColorStop(1, '#5a9fd4');
    };
    doResize();

    // ═══ Game state — plain JS, zero React ═══
    const g = {
      phase: 'menu', tx: 0.5,
      items: [], fx: [], dust: [], stars: [], confetti: [],
      score: 0, lives: 3, lvl: 1,
      wind: 0.8, wdir: 1, wt: 0,
      st: 0, sr: 110, f: 0, run: true,
      hs: parseInt(localStorage.getItem('likebird-game-highscore') || '0'),
      nr: false, mb: null, rb: null, hb: null,
      // ★ Catcher animation state
      catchScale: 1, catchScaleT: 0,
      shakeX: 0, shakeT: 0,
      // ★ Miss vignette
      vignetteT: 0,
      // ★ Menu preview items
      menuItems: [],
      // ★ Leaderboard
      lb: null, lbLoading: false,
      // ★ Level select
      lbb: null, lvlb: null, backb: null,
      // ★ Hover state for desktop
      hoverBtn: null,
      // ★ Start level
      startLvl: 1,
    };
    gRef.current = g;

    // ★ BLOCK 3.1 — Load leaderboard once
    try {
      g.lbLoading = true;
      fbGet('likebird-game-leaderboard').then(function(data) {
        g.lb = data || {};
        g.lbLoading = false;
      }).catch(function() { g.lb = {}; g.lbLoading = false; });
    } catch(e) { g.lb = {}; }

    // ═══ Types ═══
    const TPS = [
      {t:'b',p:10,c:'#f59e0b',fc:'#f59e0b'},{t:'b',p:10,c:'#ef4444',fc:'#ef4444'},{t:'b',p:10,c:'#3b82f6',fc:'#3b82f6'},
      {t:'b',p:10,c:'#ec4899',fc:'#ec4899'},{t:'b',p:10,c:'#8b5cf6',fc:'#8b5cf6'},
      {t:'y',p:20,c:'#d5ccc2',fc:'#d97706'},{t:'s',p:15,c:'#6B7DB3',fc:'#3b82f6'},
      {t:'l',p:15,c:'#4ade80',fc:'#22c55e'},{t:'o',p:12,c:'#ec4899',fc:'#ec4899'},{t:'m',p:12,c:'#d97706',fc:'#d97706'},
    ];

    // ═══ Safe drawing helpers ═══
    const ellipse = (x,y,rx,ry,rot) => {
      if(rx<=0||ry<=0) return;
      try{ctx.ellipse(x,y,rx,ry,rot||0,0,6.28);}catch(e){ctx.arc(x,y,Math.max(rx,ry),0,6.28);}
    };

    // ═══ Draw bird ═══
    const drawBird = (x,y,s,c,rot) => {
      ctx.save();ctx.translate(x,y);ctx.rotate(rot||0);
      ctx.fillStyle=c;ctx.beginPath();ellipse(0,0,s*0.52,s*0.62,0);ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.1)';ctx.lineWidth=1.5;ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,0.4)';ctx.beginPath();ellipse(0,s*0.13,s*0.3,s*0.34,0);ctx.fill();
      var eo=s*0.17,ey=-s*0.13,er=s*0.16;
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-eo,ey,er,0,6.28);ctx.fill();ctx.beginPath();ctx.arc(eo,ey,er,0,6.28);ctx.fill();
      ctx.fillStyle='#111';ctx.beginPath();ctx.arc(-eo+1,ey+2,er*0.45,0,6.28);ctx.fill();ctx.beginPath();ctx.arc(eo+1,ey+2,er*0.45,0,6.28);ctx.fill();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-eo-2,ey-2,er*0.15,0,6.28);ctx.fill();ctx.beginPath();ctx.arc(eo-2,ey-2,er*0.15,0,6.28);ctx.fill();
      ctx.fillStyle='#ff9500';ctx.beginPath();ctx.moveTo(-s*0.08,0);ctx.lineTo(0,s*0.13);ctx.lineTo(s*0.08,0);ctx.closePath();ctx.fill();
      ctx.fillStyle=c;ctx.globalAlpha=0.5;ctx.beginPath();ellipse(-s*0.48,s*0.05,s*0.2,s*0.3,-0.3);ctx.fill();ctx.beginPath();ellipse(s*0.48,s*0.05,s*0.2,s*0.3,0.3);ctx.fill();ctx.globalAlpha=1;
      ctx.strokeStyle=c;ctx.lineWidth=2.5;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(0,-s*0.56);ctx.quadraticCurveTo(-s*0.15,-s*0.8,0,-s*0.72);ctx.stroke();
      ctx.beginPath();ctx.moveTo(s*0.05,-s*0.56);ctx.quadraticCurveTo(s*0.22,-s*0.82,s*0.08,-s*0.7);ctx.stroke();
      ctx.fillStyle='rgba(255,150,150,0.25)';ctx.beginPath();ctx.arc(-s*0.3,s*0.04,s*0.09,0,6.28);ctx.fill();ctx.beginPath();ctx.arc(s*0.3,s*0.04,s*0.09,0,6.28);ctx.fill();
      ctx.restore();
    };

    const drawYeti = (x,y,s,rot) => {
      ctx.save();ctx.translate(x,y);ctx.rotate(rot||0);
      ctx.fillStyle='#e8e0d8';ctx.beginPath();ellipse(0,0,s*0.54,s*0.63,0);ctx.fill();
      ctx.strokeStyle='#cfc4b8';ctx.lineWidth=1.5;for(var a=0;a<6.28;a+=0.4){ctx.beginPath();ctx.moveTo(Math.cos(a)*s*0.52,Math.sin(a)*s*0.61);ctx.lineTo(Math.cos(a+0.12)*s*0.63,Math.sin(a+0.12)*s*0.72);ctx.stroke();}
      ctx.fillStyle='#f5efe8';ctx.beginPath();ellipse(0,s*0.06,s*0.32,s*0.32,0);ctx.fill();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-s*0.13,-s*0.05,s*0.12,0,6.28);ctx.fill();ctx.beginPath();ctx.arc(s*0.13,-s*0.05,s*0.12,0,6.28);ctx.fill();
      ctx.fillStyle='#3a2a1a';ctx.beginPath();ctx.arc(-s*0.11,-s*0.03,s*0.06,0,6.28);ctx.fill();ctx.beginPath();ctx.arc(s*0.15,-s*0.03,s*0.06,0,6.28);ctx.fill();
      ctx.strokeStyle='#8B7355';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,s*0.13,s*0.08,0.3,2.84);ctx.stroke();
      ctx.fillStyle='#c0aa90';ctx.beginPath();ctx.moveTo(-s*0.26,-s*0.46);ctx.lineTo(-s*0.36,-s*0.72);ctx.lineTo(-s*0.13,-s*0.52);ctx.fill();ctx.beginPath();ctx.moveTo(s*0.26,-s*0.46);ctx.lineTo(s*0.36,-s*0.72);ctx.lineTo(s*0.13,-s*0.52);ctx.fill();
      ctx.restore();
    };

    const drawShark = (x,y,s,rot) => {
      ctx.save();ctx.translate(x,y);ctx.rotate(rot||0);
      ctx.fillStyle='#6B7DB3';ctx.beginPath();ellipse(0,0,s*0.58,s*0.36,0);ctx.fill();
      ctx.fillStyle='#dde';ctx.beginPath();ellipse(0,s*0.09,s*0.42,s*0.2,0);ctx.fill();
      ctx.fillStyle='#556699';ctx.beginPath();ctx.moveTo(0,-s*0.34);ctx.lineTo(-s*0.12,-s*0.6);ctx.lineTo(s*0.14,-s*0.34);ctx.fill();
      ctx.beginPath();ctx.moveTo(s*0.5,-s*0.05);ctx.lineTo(s*0.74,-s*0.27);ctx.lineTo(s*0.74,s*0.2);ctx.lineTo(s*0.5,s*0.05);ctx.fill();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-s*0.28,-s*0.09,s*0.1,0,6.28);ctx.fill();
      ctx.fillStyle='#222';ctx.beginPath();ctx.arc(-s*0.26,-s*0.07,s*0.05,0,6.28);ctx.fill();
      ctx.restore();
    };

    const drawLizard = (x,y,s,rot) => {
      ctx.save();ctx.translate(x,y);ctx.rotate(rot||0);
      ctx.fillStyle='#4ade80';ctx.beginPath();ellipse(0,0,s*0.38,s*0.53,0);ctx.fill();
      ctx.fillStyle='#22c55e';for(var i=0;i<5;i++){ctx.beginPath();ctx.arc(Math.cos(i*1.2)*s*0.15,-s*0.2+i*s*0.12,s*0.055,0,6.28);ctx.fill();}
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-s*0.14,-s*0.3,s*0.11,0,6.28);ctx.fill();ctx.beginPath();ctx.arc(s*0.14,-s*0.3,s*0.11,0,6.28);ctx.fill();
      ctx.fillStyle='#222';ctx.beginPath();ctx.arc(-s*0.12,-s*0.28,s*0.055,0,6.28);ctx.fill();ctx.beginPath();ctx.arc(s*0.16,-s*0.28,s*0.055,0,6.28);ctx.fill();
      ctx.strokeStyle='#22c55e';ctx.lineWidth=2.5;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(-s*0.3,-s*0.26);ctx.lineTo(-s*0.46,-s*0.4);ctx.stroke();ctx.beginPath();ctx.moveTo(s*0.3,-s*0.26);ctx.lineTo(s*0.46,-s*0.4);ctx.stroke();
      ctx.beginPath();ctx.moveTo(-s*0.3,s*0.26);ctx.lineTo(-s*0.46,s*0.4);ctx.stroke();ctx.beginPath();ctx.moveTo(s*0.3,s*0.26);ctx.lineTo(s*0.46,s*0.4);ctx.stroke();
      ctx.restore();
    };

    const drawGenToy = (x,y,s,c,em,rot) => {
      ctx.save();ctx.translate(x,y);ctx.rotate(rot||0);
      ctx.fillStyle=c;ctx.beginPath();ctx.arc(0,0,s*0.48,0,6.28);ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.08)';ctx.lineWidth=1.5;ctx.stroke();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-s*0.14,-s*0.09,s*0.12,0,6.28);ctx.fill();ctx.beginPath();ctx.arc(s*0.14,-s*0.09,s*0.12,0,6.28);ctx.fill();
      ctx.fillStyle='#222';ctx.beginPath();ctx.arc(-s*0.12,-s*0.07,s*0.06,0,6.28);ctx.fill();ctx.beginPath();ctx.arc(s*0.16,-s*0.07,s*0.06,0,6.28);ctx.fill();
      ctx.font=Math.round(s*0.5)+'px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(em,0,s*0.18);
      ctx.restore();
    };

    const drawFig = (it) => {
      var rot=it.rot*0.01745;
      switch(it.t){
        case'b':drawBird(it.x,it.y,it.s,it.c,rot);break;
        case'y':drawYeti(it.x,it.y,it.s,rot);break;
        case's':drawShark(it.x,it.y,it.s,rot);break;
        case'l':drawLizard(it.x,it.y,it.s,rot);break;
        case'o':drawGenToy(it.x,it.y,it.s,it.c,'🐙',rot);break;
        case'm':drawGenToy(it.x,it.y,it.s,it.c,'🧸',rot);break;
      }
    };

    // ═══ BLOCK 2.1 — Enhanced Background ═══
    const drawBg = () => {
      // Sky gradient (pre-created)
      ctx.fillStyle = skyGrad || '#a8ddf0';
      ctx.fillRect(0, 0, W, H * 0.42);

      // ★ Sun in top-right of game area
      var sunX = GX + GW * 0.88, sunY = H * 0.06, sunR = Math.max(W, H) * 0.028;
      ctx.fillStyle = '#FFD700';
      ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, 6.28); ctx.fill();
      // Sun glow
      ctx.globalAlpha = 0.15;
      ctx.beginPath(); ctx.arc(sunX, sunY, sunR * 2.2, 0, 6.28); ctx.fill();
      ctx.globalAlpha = 0.08;
      ctx.beginPath(); ctx.arc(sunX, sunY, sunR * 3.5, 0, 6.28); ctx.fill();
      ctx.globalAlpha = 1;
      // Sun rays
      ctx.strokeStyle = 'rgba(255,215,0,0.2)'; ctx.lineWidth = 2;
      for (var ra = 0; ra < 6.28; ra += 0.52) {
        ctx.beginPath();
        ctx.moveTo(sunX + Math.cos(ra + g.f * 0.005) * sunR * 1.5, sunY + Math.sin(ra + g.f * 0.005) * sunR * 1.5);
        ctx.lineTo(sunX + Math.cos(ra + g.f * 0.005) * sunR * 2.8, sunY + Math.sin(ra + g.f * 0.005) * sunR * 2.8);
        ctx.stroke();
      }

      // ★ 3 Clouds with parallax
      var clouds = [
        { speed: 0.3, y: H * 0.04, sz: 1.0, alpha: 0.5 },
        { speed: 0.5, y: H * 0.025, sz: 1.3, alpha: 0.35 },
        { speed: 0.15, y: H * 0.065, sz: 0.75, alpha: 0.55 },
      ];
      for (var ci = 0; ci < clouds.length; ci++) {
        var cl = clouds[ci];
        ctx.fillStyle = 'rgba(255,255,255,' + cl.alpha + ')';
        var cx1 = ((g.f * cl.speed + ci * W * 0.4) % (W + 400 * cl.sz)) - 200 * cl.sz;
        var csz = 22 * cl.sz;
        ctx.beginPath(); ctx.arc(cx1, cl.y, csz, 0, 6.28); ctx.arc(cx1 + 28 * cl.sz, cl.y - 8 * cl.sz, csz * 1.2, 0, 6.28); ctx.arc(cx1 + 58 * cl.sz, cl.y, csz * 0.9, 0, 6.28); ctx.fill();
      }

      // Sea with gradient
      ctx.fillStyle = seaGrad || '#4a90d9';
      ctx.fillRect(0, H * 0.07, W, H * 0.08);

      // ★ Animated waves in 2 layers + foam
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
      for (var ww = 0; ww < 3; ww++) {
        ctx.beginPath();
        for (var x = 0; x < W; x += 6) {
          var wy = H * 0.085 + ww * H * 0.015 + Math.sin((x + g.f * 1.5 + ww * 35) / 30) * 3;
          ctx.lineTo(x, wy);
        }
        ctx.stroke();
      }
      // Foam — white dots on wave crests
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (var fx = 0; fx < W; fx += 18) {
        var foamY = H * 0.08 + Math.sin((fx + g.f * 1.5) / 30) * 3;
        if (Math.sin((fx + g.f * 1.5) / 30) > 0.5) {
          ctx.beginPath(); ctx.arc(fx, foamY, 1.5, 0, 6.28); ctx.fill();
        }
      }

      // ★ Ground with tile texture
      ctx.fillStyle = '#b5a07a';
      ctx.fillRect(0, H * 0.15, W, H);
      // Tile stripes alternating
      var tileH = H * 0.025;
      for (var ty2 = H * 0.15; ty2 < H; ty2 += tileH) {
        var tileRow = Math.floor((ty2 - H * 0.15) / tileH);
        ctx.fillStyle = tileRow % 2 === 0 ? '#C4A882' : '#B8976E';
        ctx.fillRect(0, ty2, W, tileH);
      }
      // Tile vertical lines
      ctx.strokeStyle = 'rgba(0,0,0,0.04)'; ctx.lineWidth = 1;
      var ts = GW / 6;
      for (var x2 = GX; x2 < GX + GW; x2 += ts) { ctx.beginPath(); ctx.moveTo(x2, H * 0.15); ctx.lineTo(x2, H); ctx.stroke(); }
      // Tile horizontal lines
      for (var y2 = H * 0.15; y2 < H; y2 += tileH) { ctx.beginPath(); ctx.moveTo(0, y2); ctx.lineTo(W, y2); ctx.stroke(); }
    };

    // ═══ BLOCK 2.2 — Enhanced Table ═══
    const drawTable = () => {
      var ty = H * 0.17, th = H * 0.06;
      var tl = GX + GW * 0.08, tr = GX + GW * 0.92;
      var ttl = GX + GW * 0.15, ttr = GX + GW * 0.85;

      // ★ Blurred shadow under table (multiple semi-transparent strips)
      for (var si = 0; si < 4; si++) {
        ctx.fillStyle = 'rgba(0,0,0,' + (0.06 - si * 0.012) + ')';
        ctx.beginPath();
        ctx.moveTo(tl + si * 3, ty + th + 3 + si * 2);
        ctx.lineTo(tr - si * 3, ty + th + 3 + si * 2);
        ctx.lineTo(tr - si * 3 - 4, ty + th + 6 + si * 2);
        ctx.lineTo(tl + si * 3 + 4, ty + th + 6 + si * 2);
        ctx.fill();
      }

      // ★ Table legs
      var legW = GW * 0.03, legH = H * 0.04;
      ctx.fillStyle = '#3a2210';
      ctx.fillRect(GX + GW * 0.2 - legW / 2, ty + th, legW, legH);
      ctx.fillRect(GX + GW * 0.8 - legW / 2, ty + th, legW, legH);

      // Table top (trapezoid)
      ctx.fillStyle = '#4a2e14'; ctx.beginPath();
      ctx.moveTo(tl, ty + th);
      ctx.lineTo(tr, ty + th);
      ctx.lineTo(ttr, ty);
      ctx.lineTo(ttl, ty);
      ctx.closePath(); ctx.fill();

      // ★ Wood grain lines
      ctx.strokeStyle = 'rgba(120,80,40,0.2)'; ctx.lineWidth = 1;
      for (var gi = 0; gi < 5; gi++) {
        var gy = ty + th * (0.15 + gi * 0.17);
        ctx.beginPath();
        ctx.moveTo(ttl + GW * 0.02, gy);
        ctx.lineTo(ttr - GW * 0.02, gy);
        ctx.stroke();
      }

      // Table edge highlight
      ctx.strokeStyle = '#e8ddd0'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tl, ty + th); ctx.lineTo(tr, ty + th);
      ctx.lineTo(ttr, ty); ctx.lineTo(ttl, ty); ctx.closePath();
      ctx.stroke();

      // ★ White tablecloth stripe along front edge
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(tl + 2, ty + th - 2); ctx.lineTo(tr - 2, ty + th - 2); ctx.stroke();

      // ★ Mini birds on table — adaptive size
      var tbs = Math.max(W, H) * 0.018;
      var cols = ['#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6', '#4ade80'];
      for (var i = 0; i < cols.length; i++) {
        var ix = GX + GW * 0.18 + i * (GW * 0.64 / cols.length);
        var wb = Math.sin((g.f * 0.025 + i * 1.4) * Math.max(0.5, g.wind * 0.3)) * g.wind * 0.4;
        drawBird(ix + wb, ty + th * 0.15, tbs, cols[i], wb * 0.01);
      }
    };

    // ═══ Death line ═══
    const DEATH_Y = () => H * 0.87;
    const drawDeathLine = () => {
      var dy = DEATH_Y();
      ctx.fillStyle = 'rgba(239,68,68,0.05)'; ctx.fillRect(GX, dy, GW, H - dy);
      ctx.strokeStyle = 'rgba(239,68,68,0.15)'; ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(GX, dy); ctx.lineTo(GX + GW, dy); ctx.stroke(); ctx.setLineDash([]);
    };

    // ═══ Wind particles ═══
    const drawDust = () => {
      for (var i = 0; i < g.dust.length; i++) {
        var p = g.dust[i];
        ctx.fillStyle = 'rgba(255,255,255,' + Math.max(0, p.l / p.m) * 0.25 + ')';
        ctx.fillRect(p.x, p.y, p.z * 6, 1);
      }
    };

    // ═══ BLOCK 2.3 — Enhanced Catcher ═══
    const CATCH_Y = () => H * 0.77;
    const CATCH_HW = () => GW * 0.15;
    const drawCatcher = () => {
      var cx = GX + g.tx * GW + g.shakeX, hw = CATCH_HW(), cy = CATCH_Y(), ch = H * 0.055;

      // ★ Apply catch scale animation
      var sc = g.catchScale;
      ctx.save();
      if (sc !== 1) { ctx.translate(cx, cy + ch * 0.3); ctx.scale(sc, sc); ctx.translate(-cx, -(cy + ch * 0.3)); }

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.beginPath();
      ctx.moveTo(cx - hw * 0.7, cy + ch + 3); ctx.lineTo(cx + hw * 0.7, cy + ch + 3);
      ctx.lineTo(cx + hw * 0.6, cy + ch + 6); ctx.lineTo(cx - hw * 0.6, cy + ch + 6); ctx.fill();

      // ★ Arms (arc lines on sides)
      ctx.strokeStyle = '#e0a87a'; ctx.lineWidth = Math.max(3, hw * 0.06); ctx.lineCap = 'round';
      // Left arm
      ctx.beginPath();
      ctx.arc(cx - hw * 0.6, cy + ch * 0.1, hw * 0.55, -0.4, 0.8); ctx.stroke();
      // Right arm
      ctx.beginPath();
      ctx.arc(cx + hw * 0.6, cy + ch * 0.1, hw * 0.55, 2.34, 3.54); ctx.stroke();

      // Body
      ctx.fillStyle = '#fcd9b6'; ctx.beginPath();
      ctx.moveTo(cx - hw, cy + ch * 0.3);
      ctx.lineTo(cx - hw * 0.65, cy - ch * 0.5);
      ctx.lineTo(cx - hw * 0.25, cy - ch * 0.7);
      ctx.lineTo(cx + hw * 0.25, cy - ch * 0.7);
      ctx.lineTo(cx + hw * 0.65, cy - ch * 0.5);
      ctx.lineTo(cx + hw, cy + ch * 0.3);
      ctx.quadraticCurveTo(cx, cy + ch * 1.1, cx - hw, cy + ch * 0.3);
      ctx.fill(); ctx.strokeStyle = '#e0a87a'; ctx.lineWidth = 1.5; ctx.stroke();

      // Blue stripes on sides
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(cx - hw - 3, cy, 12, ch * 0.8);
      ctx.fillRect(cx + hw - 9, cy, 12, ch * 0.8);

      ctx.restore();
    };

    // ═══ BLOCK 2.4 — Enhanced Effects ═══
    const drawFx = () => {
      // Star particles
      var si = g.stars.length;
      while (si--) {
        var st = g.stars[si]; st.l--; st.x += st.vx; st.y += st.vy;
        if (st.l <= 0) { g.stars.splice(si, 1); continue; }
        var sa = st.l / st.m;
        ctx.fillStyle = 'rgba(' + st.cr + ',' + st.cg + ',' + st.cb + ',' + sa + ')';
        // Draw star shape
        ctx.save(); ctx.translate(st.x, st.y); ctx.rotate(st.rot);
        var ssr = st.sz;
        ctx.beginPath();
        for (var sp = 0; sp < 5; sp++) {
          var ang = sp * 1.2566 - 1.5708;
          ctx.lineTo(Math.cos(ang) * ssr, Math.sin(ang) * ssr);
          ctx.lineTo(Math.cos(ang + 0.6283) * ssr * 0.4, Math.sin(ang + 0.6283) * ssr * 0.4);
        }
        ctx.closePath(); ctx.fill(); ctx.restore();
        st.rot += 0.1;
      }

      // Text effects
      var i = g.fx.length;
      while (i--) {
        var e = g.fx[i]; e.l--;
        if (e.l <= 0) { g.fx.splice(i, 1); continue; }
        var a = e.l / e.m;
        if (e.k === 'c') {
          ctx.font = 'bold ' + Math.round(22 * dpr) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          // ★ Color matches figure type
          ctx.fillStyle = e.fc ? e.fc.replace(')', ',' + a + ')').replace('rgb', 'rgba') : 'rgba(34,197,94,' + a + ')';
          if (!e.fc || e.fc[0] === '#') {
            // Hex color — just use alpha overlay
            ctx.globalAlpha = a;
            ctx.fillStyle = e.fc || '#22c55e';
          }
          ctx.fillText('+' + e.p, e.x, e.y - (e.m - e.l) * 2);
          ctx.globalAlpha = 1;
        } else {
          ctx.font = 'bold ' + Math.round(18 * dpr) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(239,68,68,' + a + ')'; ctx.fillText('✗', e.x, e.y - (e.m - e.l) * 1.2);
        }
      }

      // ★ Miss vignette (red flash around edges)
      if (g.vignetteT > 0) {
        g.vignetteT--;
        var va = (g.vignetteT / 15) * 0.35;
        ctx.fillStyle = 'rgba(239,68,68,' + va + ')';
        ctx.fillRect(0, 0, W, H * 0.04);
        ctx.fillRect(0, H - H * 0.04, W, H * 0.04);
        ctx.fillRect(0, 0, W * 0.03, H);
        ctx.fillRect(W - W * 0.03, 0, W * 0.03, H);
      }
    };

    // ★ Spawn star particles on catch
    const spawnStars = (x, y, color) => {
      var count = 5 + Math.floor(Math.random() * 4);
      if (g.stars.length > 35) count = 3; // cap
      // Parse hex color
      var r2 = 255, g2 = 215, b2 = 0;
      if (color && color[0] === '#') {
        var hx = color.length === 4 ? color[1] + color[1] + color[2] + color[2] + color[3] + color[3] : color.slice(1);
        r2 = parseInt(hx.substring(0, 2), 16) || 255;
        g2 = parseInt(hx.substring(2, 4), 16) || 215;
        b2 = parseInt(hx.substring(4, 6), 16) || 0;
      }
      for (var i = 0; i < count; i++) {
        var ang = Math.random() * 6.28;
        var spd = (1.5 + Math.random() * 2.5) * dpr;
        g.stars.push({
          x: x, y: y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 1,
          l: 18 + Math.random() * 10, m: 28, sz: (3 + Math.random() * 4) * dpr,
          cr: r2, cg: g2, cb: b2, rot: Math.random() * 6.28
        });
      }
    };

    // ★ Spawn confetti for new record
    const spawnConfetti = () => {
      var count = 25;
      var colors = ['#f59e0b', '#ef4444', '#3b82f6', '#22c55e', '#ec4899', '#8b5cf6', '#06b6d4'];
      for (var i = 0; i < count; i++) {
        g.confetti.push({
          x: W * 0.2 + Math.random() * W * 0.6,
          y: -20 - Math.random() * 100,
          vx: (Math.random() - 0.5) * 4 * dpr,
          vy: (1 + Math.random() * 3) * dpr,
          w: (4 + Math.random() * 6) * dpr,
          h: (8 + Math.random() * 10) * dpr,
          rot: Math.random() * 6.28,
          rs: (Math.random() - 0.5) * 0.2,
          c: colors[Math.floor(Math.random() * colors.length)],
          l: 120 + Math.random() * 60, m: 180,
        });
      }
    };

    const drawConfetti = () => {
      var i = g.confetti.length;
      while (i--) {
        var c = g.confetti[i]; c.l--; c.x += c.vx; c.y += c.vy; c.rot += c.rs;
        if (c.l <= 0 || c.y > H + 50) { g.confetti.splice(i, 1); continue; }
        ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot);
        ctx.fillStyle = c.c;
        ctx.globalAlpha = Math.min(1, c.l / 30);
        ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    };

    // ═══ HUD ═══
    const drawHUD = () => {
      var p = W * 0.02, fs = Math.round(W * 0.038), hh = fs * 2.2;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(p, p, W - p * 2, hh);
      var my = p + hh / 2;
      ctx.font = 'bold ' + fs + 'px sans-serif'; ctx.textBaseline = 'middle';
      ctx.textAlign = 'left'; ctx.fillStyle = '#fbbf24'; ctx.fillText('⭐ ' + g.score, p * 3, my);
      ctx.textAlign = 'center'; ctx.fillStyle = '#93c5fd'; ctx.fillText('Ур.' + g.lvl, W / 2, my);
      ctx.textAlign = 'right'; ctx.fillStyle = '#fca5a5';
      var h = ''; for (var i = 0; i < 3; i++) h += i < g.lives ? '❤' : '♡';
      ctx.fillText(h, W - p * 3, my);
      ctx.font = Math.round(fs * 0.55) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillText('💨 ' + (g.wdir > 0 ? '→' : '←'), W / 2, p + hh + fs * 0.5);
    };

    // ═══ Rounded rect helper ═══
    const rRect = (x, y, w, h2, r, col) => {
      ctx.fillStyle = col; ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h2 - r); ctx.arcTo(x + w, y + h2, x + w - r, y + h2, r);
      ctx.lineTo(x + r, y + h2); ctx.arcTo(x, y + h2, x, y + h2 - r, r);
      ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.fill();
    };

    // ═══ BLOCK 2.5 — Enhanced Menu screen ═══
    const drawMenu = () => {
      drawBg(); drawTable();

      // ★ Animated preview figures falling in background
      if (g.menuItems.length < 3 && g.f % 90 === 0) {
        var tp = TPS[Math.floor(Math.random() * TPS.length)];
        var mbs = Math.max(W, H) * 0.05;
        g.menuItems.push({
          t: tp.t, c: tp.c, s: mbs, x: GX + GW * 0.15 + Math.random() * GW * 0.7,
          y: H * 0.25, vy: 0.5 * dpr, rot: Math.random() * 360, rs: (Math.random() - 0.5) * 1.5,
        });
      }
      for (var mi = g.menuItems.length - 1; mi >= 0; mi--) {
        var mit = g.menuItems[mi]; mit.y += mit.vy; mit.rot += mit.rs;
        if (mit.y > H * 0.7) { g.menuItems.splice(mi, 1); continue; }
        ctx.globalAlpha = 0.35; drawFig(mit); ctx.globalAlpha = 1;
      }

      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 0, W, H);
      var cw = Math.min(W * 0.88, 480 * dpr), ch = Math.min(H * 0.78, 620 * dpr);
      var cx = (W - cw) / 2, cy = (H - ch) / 2;
      rRect(cx, cy, cw, ch, 18, '#fff');
      var mid = W / 2, yy = cy + 22 * dpr;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.font = Math.round(36 * dpr) + 'px serif'; ctx.fillStyle = '#333'; ctx.fillText('🌊🐦💨', mid, yy); yy += 48 * dpr;
      ctx.font = 'bold ' + Math.round(19 * dpr) + 'px sans-serif'; ctx.fillStyle = '#1f2937'; ctx.fillText('Ветер на набережной', mid, yy); yy += 28 * dpr;
      ctx.font = Math.round(11 * dpr) + 'px sans-serif'; ctx.fillStyle = '#6b7280';
      ctx.fillText('Ветер сдувает товар со стола!', mid, yy); yy += 16 * dpr;
      ctx.fillText('Двигай палец и лови фигурки!', mid, yy); yy += 26 * dpr;
      ctx.textAlign = 'left'; var col = cx + cw * 0.1;
      var info = ['🐦 Птички — 10 очк', '🧌 Йети — 20 очк', '🦈 Акула / 🦎 Ящерка — 15', '🐙🧸 Другие — 12 очк', '❤️ 3 жизни, промах = −1'];
      for (var i = 0; i < info.length; i++) { ctx.fillStyle = '#374151'; ctx.fillText(info[i], col, yy); yy += 17 * dpr; }
      yy += 8 * dpr;
      if (g.hs > 0) { ctx.textAlign = 'center'; ctx.font = 'bold ' + Math.round(13 * dpr) + 'px sans-serif'; ctx.fillStyle = '#d97706'; ctx.fillText('🏆 Рекорд: ' + g.hs, mid, yy); yy += 24 * dpr; }

      // ★ Buttons: Start, Leaderboard, Levels
      var bw = cw * 0.65, bh = 42 * dpr, bx = mid - bw / 2;
      var btnY = cy + ch - bh * 3.6 - 12 * dpr;

      // Start button with gradient-like hover
      var isHoverStart = g.hoverBtn === 'start';
      rRect(bx, btnY, bw, bh, 14, isHoverStart ? '#0e7490' : '#0891b2');
      ctx.font = 'bold ' + Math.round(15 * dpr) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
      ctx.fillText('▶  Начать игру', mid, btnY + bh / 2);
      g.mb = { x: bx / dpr, y: btnY / dpr, w: bw / dpr, h: bh / dpr };
      btnY += bh + 8 * dpr;

      // ★ Leaderboard button
      var isHoverLb = g.hoverBtn === 'lb';
      rRect(bx, btnY, bw, bh, 14, isHoverLb ? '#d97706' : '#f59e0b');
      ctx.fillStyle = '#fff'; ctx.fillText('🏆  Таблица', mid, btnY + bh / 2);
      g.lbb = { x: bx / dpr, y: btnY / dpr, w: bw / dpr, h: bh / dpr };
      btnY += bh + 8 * dpr;

      // ★ Level select button
      var isHoverLvl = g.hoverBtn === 'lvl';
      rRect(bx, btnY, bw, bh, 14, isHoverLvl ? '#7c3aed' : '#8b5cf6');
      ctx.fillStyle = '#fff'; ctx.fillText('⚡  Уровни', mid, btnY + bh / 2);
      g.lvlb = { x: bx / dpr, y: btnY / dpr, w: bw / dpr, h: bh / dpr };
    };

    // ═══ BLOCK 3.1 — Leaderboard screen ═══
    const drawLeaderboard = () => {
      drawBg();
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H);
      var cw = Math.min(W * 0.92, 500 * dpr), ch = Math.min(H * 0.82, 640 * dpr);
      var cx = (W - cw) / 2, cy = (H - ch) / 2;
      rRect(cx, cy, cw, ch, 18, '#fff');
      var mid = W / 2, yy = cy + 18 * dpr;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.font = 'bold ' + Math.round(20 * dpr) + 'px sans-serif'; ctx.fillStyle = '#1f2937';
      ctx.fillText('🏆 Таблица рекордов', mid, yy); yy += 36 * dpr;

      if (g.lbLoading || !g.lb) {
        ctx.font = Math.round(13 * dpr) + 'px sans-serif'; ctx.fillStyle = '#9ca3af';
        ctx.fillText('Загрузка...', mid, yy);
      } else {
        // Sort by score
        var entries = [];
        try {
          Object.keys(g.lb).forEach(function(k) {
            var v = g.lb[k];
            if (v && typeof v.score === 'number') entries.push({ login: k, score: v.score, date: v.date || '', level: v.level || 1 });
          });
        } catch (e) { /* silent */ }
        entries.sort(function(a, b) { return b.score - a.score; });
        var top10 = entries.slice(0, 10);

        var auth2 = {};
        try { auth2 = JSON.parse(localStorage.getItem('likebird-auth') || '{}'); } catch (e) { /* silent */ }
        var myLogin = auth2.login || '';

        if (top10.length === 0) {
          ctx.font = Math.round(13 * dpr) + 'px sans-serif'; ctx.fillStyle = '#9ca3af';
          ctx.fillText('Пока нет записей', mid, yy);
        } else {
          var rowH = Math.min(36 * dpr, (ch - 120 * dpr) / 10);
          var colL = cx + cw * 0.08, colR = cx + cw * 0.92;
          for (var li = 0; li < top10.length; li++) {
            var e2 = top10[li];
            var ry = yy + li * rowH;
            // Highlight current player
            if (e2.login === myLogin) {
              ctx.fillStyle = 'rgba(251,191,36,0.15)';
              ctx.fillRect(cx + 8, ry - 2, cw - 16, rowH - 2);
            }
            ctx.font = 'bold ' + Math.round(12 * dpr) + 'px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            ctx.fillStyle = li < 3 ? '#d97706' : '#4b5563';
            var medal = li === 0 ? '🥇' : li === 1 ? '🥈' : li === 2 ? '🥉' : (li + 1) + '.';
            ctx.fillText(medal + ' ' + e2.login, colL, ry + 2);
            ctx.textAlign = 'right'; ctx.fillStyle = '#1f2937';
            ctx.fillText(e2.score + ' очк  Ур.' + e2.level, colR, ry + 2);
            ctx.font = Math.round(9 * dpr) + 'px sans-serif'; ctx.fillStyle = '#9ca3af';
            ctx.fillText(e2.date, colR, ry + 16 * dpr);
          }
        }
      }
      // Back button
      var bw = cw * 0.5, bh = 40 * dpr, bx = mid - bw / 2, by = cy + ch - bh - 14 * dpr;
      rRect(bx, by, bw, bh, 13, '#6b7280');
      ctx.font = 'bold ' + Math.round(14 * dpr) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
      ctx.fillText('← Назад', mid, by + bh / 2);
      g.backb = { x: bx / dpr, y: by / dpr, w: bw / dpr, h: bh / dpr };
    };

    // ═══ BLOCK 3.2 — Level select screen ═══
    const drawLevelSelect = () => {
      drawBg();
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H);
      var cw = Math.min(W * 0.92, 500 * dpr), ch = Math.min(H * 0.85, 680 * dpr);
      var cx = (W - cw) / 2, cy = (H - ch) / 2;
      rRect(cx, cy, cw, ch, 18, '#fff');
      var mid = W / 2, yy = cy + 18 * dpr;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.font = 'bold ' + Math.round(18 * dpr) + 'px sans-serif'; ctx.fillStyle = '#1f2937';
      ctx.fillText('⚡ Выбор уровня', mid, yy); yy += 34 * dpr;

      var maxLevel = parseInt(localStorage.getItem('likebird-max-level') || '1');
      var cols2 = 5, rows2 = 10, totalLvls = 50;
      var pad = cw * 0.06;
      var cellW = (cw - pad * 2) / cols2;
      var cellH = Math.min(cellW, (ch - 100 * dpr) / rows2);
      var gridW = cellW * cols2, gridX = cx + (cw - gridW) / 2;

      g._lvlBtns = [];
      for (var lv = 1; lv <= totalLvls; lv++) {
        var row = Math.floor((lv - 1) / cols2);
        var colI = (lv - 1) % cols2;
        var lx = gridX + colI * cellW + 3;
        var ly = yy + row * cellH + 3;
        var lw = cellW - 6, lh = cellH - 6;
        var unlocked = lv <= maxLevel;

        rRect(lx, ly, lw, lh, 8, unlocked ? '#8b5cf6' : '#d1d5db');
        ctx.font = 'bold ' + Math.round(11 * dpr) + 'px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = unlocked ? '#fff' : '#9ca3af';
        ctx.fillText(unlocked ? '' + lv : '🔒', lx + lw / 2, ly + lh / 2);

        if (unlocked) g._lvlBtns.push({ lvl: lv, x: lx / dpr, y: ly / dpr, w: lw / dpr, h: lh / dpr });
      }

      // Back button
      var bw = cw * 0.5, bh = 40 * dpr, bx = mid - bw / 2, by = cy + ch - bh - 14 * dpr;
      rRect(bx, by, bw, bh, 13, '#6b7280');
      ctx.font = 'bold ' + Math.round(14 * dpr) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
      ctx.fillText('← Назад', mid, by + bh / 2);
      g.backb = { x: bx / dpr, y: by / dpr, w: bw / dpr, h: bh / dpr };
    };

    // ═══ Game over screen (enhanced) ═══
    const drawOver = () => {
      drawBg();
      // ★ Draw confetti
      drawConfetti();

      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H);
      var cw = Math.min(W * 0.85, 440 * dpr), ch = Math.min(H * 0.58, 460 * dpr);
      var cx = (W - cw) / 2, cy = (H - ch) / 2;
      rRect(cx, cy, cw, ch, 18, '#fff');
      var mid = W / 2, yy = cy + 18 * dpr;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.font = Math.round(34 * dpr) + 'px serif'; ctx.fillStyle = '#333'; ctx.fillText(g.nr ? '🎉🏆🎉' : '💨😅', mid, yy); yy += 45 * dpr;
      ctx.font = 'bold ' + Math.round(18 * dpr) + 'px sans-serif'; ctx.fillStyle = '#1f2937'; ctx.fillText(g.nr ? 'Новый рекорд!' : 'Ветер победил!', mid, yy); yy += 32 * dpr;
      var sw = 150 * dpr, sh = 52 * dpr, sx = mid - sw / 2;
      rRect(sx, yy, sw, sh, 12, g.nr ? '#eab308' : '#f59e0b');
      ctx.font = 'bold ' + Math.round(24 * dpr) + 'px sans-serif'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText('' + g.score, mid, yy + sh / 2);
      yy += sh + 14 * dpr; ctx.textBaseline = 'top';
      if (!g.nr && g.hs > 0) { ctx.font = Math.round(11 * dpr) + 'px sans-serif'; ctx.fillStyle = '#9ca3af'; ctx.fillText('Лучший: ' + g.hs, mid, yy); }
      var bw = cw * 0.6, bh = 44 * dpr, bx = mid - bw / 2;
      var b1y = cy + ch - bh * 2.2 - 8 * dpr;
      rRect(bx, b1y, bw, bh, 13, '#0891b2');
      ctx.font = 'bold ' + Math.round(15 * dpr) + 'px sans-serif'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText('🔄  Ещё раз', mid, b1y + bh / 2);
      g.rb = { x: bx / dpr, y: b1y / dpr, w: bw / dpr, h: bh / dpr };
      var b2y = b1y + bh + 8 * dpr;
      rRect(bx, b2y, bw, bh, 13, '#f0f0f0');
      ctx.fillStyle = '#666'; ctx.fillText('На главную', mid, b2y + bh / 2);
      g.hb = { x: bx / dpr, y: b2y / dpr, w: bw / dpr, h: bh / dpr };
    };

    // ═══ BLOCK 1.1 — Adaptive spawn ═══
    const spawn = () => {
      var tp = TPS[Math.floor(Math.random() * TPS.length)];
      // ★ Adaptive size relative to game field
      var baseSize = Math.max(GW, H) * 0.072;
      var sz = baseSize * (0.85 + Math.random() * 0.35);
      var margin = sz * 0.6;
      g.items.push({
        t: tp.t, c: tp.c, p: tp.p, s: sz, fc: tp.fc,
        // ★ BLOCK 1.2 — X within game field
        x: GX + margin + Math.random() * (GW - margin * 2),
        y: H * 0.17 + H * 0.06 + 2,
        vx: g.wdir * (0.15 + Math.random() * 0.4) * dpr,
        vy: (1.3 + Math.random() * 1.0 + g.lvl * 0.15) * dpr,
        rot: Math.random() * 360,
        rs: (Math.random() - 0.5) * 2.5,
      });
    };

    // ═══ Update gameplay ═══
    const update = () => {
      g.f++;
      // Wind changes
      g.wt++;
      if (g.wt > 250 + Math.random() * 300) { g.wt = 0; g.wdir = Math.random() > 0.5 ? 1 : -1; g.wind = 0.8 + Math.random() * 1.0 + g.lvl * 0.2; }
      // Spawn
      g.st++;
      if (g.st >= g.sr) { g.st = 0; spawn(); }
      // Dust particles
      if (g.f % 6 === 0 && g.dust.length < 50) g.dust.push({ x: g.wdir > 0 ? GX - 5 : GX + GW + 5, y: Math.random() * H * 0.6, vx: g.wdir * (2 + Math.random() * 2 + g.wind) * dpr, vy: 0.3 * dpr, l: 50 + Math.random() * 30, m: 80, z: 1 + Math.random() * 1.5 });
      var i = g.dust.length; while (i--) { var p = g.dust[i]; p.x += p.vx; p.y += p.vy; p.l--; if (p.l <= 0 || p.x < GX - 20 || p.x > GX + GW + 20) g.dust.splice(i, 1); }

      // ★ Catcher animation updates
      if (g.catchScaleT > 0) {
        g.catchScaleT--;
        var progress = 1 - g.catchScaleT / 10;
        g.catchScale = progress < 0.5 ? 1 + 0.15 * (progress * 2) : 1 + 0.15 * (1 - (progress - 0.5) * 2);
        if (g.catchScaleT <= 0) g.catchScale = 1;
      }
      if (g.shakeT > 0) {
        g.shakeT--;
        g.shakeX = (g.shakeT % 2 === 0 ? 5 : -5) * dpr * (g.shakeT / 6);
        if (g.shakeT <= 0) g.shakeX = 0;
      }

      // Items physics — ★ use GW/GX for bounds
      var ccx = GX + g.tx * GW, hw = CATCH_HW(), cy = CATCH_Y(), ch = H * 0.055, dy = DEATH_Y();
      var margin2 = GX + 30 * dpr;
      var marginR = GX + GW - 30 * dpr;

      i = g.items.length;
      while (i--) {
        var it = g.items[i];
        it.x += it.vx + g.wdir * g.wind * 0.1 * dpr;
        it.y += it.vy;
        it.rot += it.rs;

        // ★ Clamp to game field bounds
        if (it.x < margin2) { it.x = margin2; it.vx = Math.abs(it.vx) * 0.5; }
        if (it.x > marginR) { it.x = marginR; it.vx = -Math.abs(it.vx) * 0.5; }

        // Check catch
        if (it.y >= cy - it.s * 0.5 && it.y <= cy + ch + it.s * 0.3) {
          if (Math.abs(it.x - ccx) < hw + it.s * 0.3) {
            g.score += it.p;
            g.fx.push({ k: 'c', x: it.x, y: it.y, p: it.p, l: 28, m: 28, fc: it.fc || it.c });
            // ★ Star particles on catch
            spawnStars(it.x, it.y, it.fc || it.c);
            // ★ Catcher scale animation
            g.catchScaleT = 10;
            g.items.splice(i, 1);
            continue;
          }
        }

        // Hit death line = miss
        if (it.y > dy) {
          g.lives--;
          g.fx.push({ k: 'm', x: it.x, y: dy, l: 22, m: 22 });
          // ★ Red vignette on miss
          g.vignetteT = 15;
          // ★ Catcher shake on miss
          g.shakeT = 6;
          g.items.splice(i, 1);
          continue;
        }
      }

      // ★ Level up — save max level
      var nl = Math.floor(g.score / 80) + 1;
      if (nl > g.lvl) {
        g.lvl = nl;
        g.sr = Math.max(40, 110 - g.lvl * 8);
        try {
          var saved = parseInt(localStorage.getItem('likebird-max-level') || '1');
          if (nl > saved) localStorage.setItem('likebird-max-level', '' + nl);
        } catch (e) { /* silent */ }
      }

      // Game over
      if (g.lives <= 0) {
        g.phase = 'over';
        g.nr = g.score > g.hs;
        if (g.nr) {
          g.hs = g.score;
          try { localStorage.setItem('likebird-game-highscore', '' + g.score); } catch (e) { /* silent */ }
          // ★ Confetti for new record
          spawnConfetti();
          // ★ BLOCK 3.1 — Save to leaderboard
          try {
            var auth3 = JSON.parse(localStorage.getItem('likebird-auth') || '{}');
            var login2 = auth3.login || 'Аноним';
            fbSave('likebird-game-leaderboard/' + login2, {
              score: g.score,
              date: new Date().toLocaleDateString('ru-RU'),
              level: g.lvl
            });
          } catch (e) { /* silent */ }
        }
      }
    };

    // ═══ Reset ═══
    const reset = () => {
      g.phase = 'play'; g.items = []; g.fx = []; g.dust = []; g.stars = []; g.confetti = [];
      g.score = 0; g.lives = 3; g.lvl = g.startLvl || 1;
      g.wind = 0.8 + (g.lvl - 1) * 0.15; g.wdir = 1; g.wt = 0;
      g.st = 0; g.sr = Math.max(40, 110 - g.lvl * 8); g.f = 0; g.nr = false;
      g.score = (g.lvl - 1) * 80;
      g.catchScale = 1; g.catchScaleT = 0; g.shakeX = 0; g.shakeT = 0; g.vignetteT = 0;
      g.startLvl = 1;
    };

    // ★ BLOCK 3.2 — Reset to specific level
    const resetToLevel = (lvl) => {
      g.startLvl = lvl;
      g.phase = 'play'; g.items = []; g.fx = []; g.dust = []; g.stars = []; g.confetti = [];
      g.score = (lvl - 1) * 80;
      g.lives = 3; g.lvl = lvl;
      g.wind = 0.8 + lvl * 0.15; g.wdir = 1; g.wt = 0;
      g.st = 0; g.sr = Math.max(40, 110 - lvl * 8); g.f = 0; g.nr = false;
      g.catchScale = 1; g.catchScaleT = 0; g.shakeX = 0; g.shakeT = 0; g.vignetteT = 0;
    };

    // ═══ MAIN LOOP — with try-catch safety net ═══
    var raf = 0;
    const loop = () => {
      if (!g.run) { return; }
      try {
        if (W < 2 || H < 2) { doResize(); }
        ctx.clearRect(0, 0, W, H);
        if (g.phase === 'menu') { drawMenu(); }
        else if (g.phase === 'play') { update(); drawBg(); drawTable(); drawDeathLine(); drawDust(); for (var i = 0; i < g.items.length; i++) drawFig(g.items[i]); drawCatcher(); drawFx(); drawHUD(); }
        else if (g.phase === 'over') { drawOver(); }
        else if (g.phase === 'leaderboard') { drawLeaderboard(); }
        else if (g.phase === 'levelselect') { drawLevelSelect(); }
      } catch(err) {
        try { console.error('Game render error:', err); } catch (e2) { /* silent */ }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // ═══ Input ═══
    var getP = function(e) { var r = canvas.getBoundingClientRect(); var t = e.touches ? (e.touches[0] || e.changedTouches[0]) : e; if (!t) return null; return { x: t.clientX - r.left, y: t.clientY - r.top }; };
    var hit = function(b, p) { return b && p && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h; };

    var onDown = function(e) {
      e.preventDefault();
      var p = getP(e); if (!p) return;
      if (g.phase === 'menu') {
        if (hit(g.mb, p)) reset();
        else if (hit(g.lbb, p)) { g.phase = 'leaderboard'; /* Refresh leaderboard */ try { fbGet('likebird-game-leaderboard').then(function(d) { g.lb = d || {}; }).catch(function() {}); } catch (e2) { /* silent */ } }
        else if (hit(g.lvlb, p)) { g.phase = 'levelselect'; }
      }
      else if (g.phase === 'over') {
        if (hit(g.rb, p)) reset();
        else if (hit(g.hb, p)) { g.run = false; setCurrentView('menu'); }
      }
      else if (g.phase === 'play') {
        var r = canvas.getBoundingClientRect();
        g.tx = Math.max(0.02, Math.min(0.98, (p.x - GX / dpr) / (GW / dpr)));
      }
      else if (g.phase === 'leaderboard') {
        if (hit(g.backb, p)) { g.phase = 'menu'; }
      }
      else if (g.phase === 'levelselect') {
        if (hit(g.backb, p)) { g.phase = 'menu'; }
        else if (g._lvlBtns) {
          for (var li = 0; li < g._lvlBtns.length; li++) {
            if (hit(g._lvlBtns[li], p)) { resetToLevel(g._lvlBtns[li].lvl); break; }
          }
        }
      }
    };

    var onMv = function(e) {
      e.preventDefault();
      var r = canvas.getBoundingClientRect();
      var t = e.touches ? e.touches[0] : e;
      if (!t) return;
      if (g.phase === 'play') {
        g.tx = Math.max(0.02, Math.min(0.98, (t.clientX - r.left - GX / dpr) / (GW / dpr)));
      }
      // ★ Hover detection for desktop
      if (g.phase === 'menu' && !e.touches) {
        var mp = { x: t.clientX - r.left, y: t.clientY - r.top };
        if (hit(g.mb, mp)) g.hoverBtn = 'start';
        else if (hit(g.lbb, mp)) g.hoverBtn = 'lb';
        else if (hit(g.lvlb, mp)) g.hoverBtn = 'lvl';
        else g.hoverBtn = null;
      }
    };

    canvas.addEventListener('touchstart', onDown, { passive: false });
    canvas.addEventListener('touchmove', onMv, { passive: false });
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMv);
    window.addEventListener('resize', doResize);

    return function() {
      g.run = false; cancelAnimationFrame(raf);
      canvas.removeEventListener('touchstart', onDown);
      canvas.removeEventListener('touchmove', onMv);
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mousemove', onMv);
      window.removeEventListener('resize', doResize);
      try { if (box.contains(canvas)) box.removeChild(canvas); } catch (e) { /* silent */ }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col" style={{touchAction:'none',userSelect:'none',WebkitUserSelect:'none'}}>
      <div className="bg-gradient-to-r from-cyan-600 to-sky-700 text-white p-2 flex items-center gap-3 shrink-0 z-10" style={{paddingTop:"max(0.5rem, env(safe-area-inset-top))"}}>
        <button onClick={handleBack} className="p-1"><ArrowLeft className="w-5 h-5" /></button>
        <span className="font-bold text-sm">🌊 Ветер на набережной</span>
      </div>
      <div ref={containerRef} className="flex-1 relative" />
    </div>
}
