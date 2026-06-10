"use client";

import { useEffect, useRef, useState } from "react";

// เกม Dino แบบ Chrome (กระโดดข้ามกระบองเพชร) เล่นแก้เบื่อตอนรอผลค้นสด
// self-contained: canvas + requestAnimationFrame, กด space/↑/คลิก เพื่อกระโดด
export function DinoGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [over, setOver] = useState(false);

  // เก็บ state เกมใน ref เพื่อไม่ให้ re-render รบกวน loop
  const game = useRef({
    dinoY: 0, // ความสูงจากพื้น (px)
    vy: 0, // ความเร็วแนวตั้ง
    onGround: true,
    obstacles: [] as { x: number; w: number; h: number }[],
    speed: 2,
    tick: 0,
    score: 0,
    running: true,
    raf: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!; // canvas รองรับ 2d เสมอ (กัน TS null ใน closure)

    // โหลดรูป dino/cactus (SVG ใน public/dinorun) — วาดด้วย drawImage
    const dinoImg = new Image();
    dinoImg.src = "/dinorun/dino.svg";
    const cactusImg = new Image();
    cactusImg.src = "/dinorun/cactus1.svg";

    const W = canvas.width;
    const H = canvas.height;
    const GROUND = H - 20; // เส้นพื้น
    const DINO_X = 40;
    const DINO_W = 40; // รูป dino 1:1
    const DINO_H = 40;
    const GRAVITY = 0.45; // นุ่มขึ้น (กระโดดไม่ไว/ไม่สูงเกิน)
    const JUMP_V = -9;
    const START_SPEED = 2; // เริ่มช้ามาก แล้วค่อย ๆ ไวขึ้น

    const g = game.current;
    // reset
    g.dinoY = 0;
    g.vy = 0;
    g.onGround = true;
    g.obstacles = [];
    g.speed = START_SPEED;
    g.tick = 0;
    g.score = 0;
    g.running = true;

    const jump = () => {
      if (!g.running) {
        restart();
        return;
      }
      if (g.onGround) {
        g.vy = JUMP_V;
        g.onGround = false;
      }
    };

    function restart() {
      g.dinoY = 0;
      g.vy = 0;
      g.onGround = true;
      g.obstacles = [];
      g.speed = START_SPEED;
      g.tick = 0;
      g.score = 0;
      g.running = true;
      setOver(false);
      setScore(0);
      loop();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener("keydown", onKey);
    canvas.addEventListener("pointerdown", jump);

    function spawnObstacle() {
      const h = 26 + (g.tick % 2) * 8; // 26 หรือ 34 — กระโดดข้ามได้ทั้งคู่
      g.obstacles.push({ x: W, w: h, h }); // cactus เป็นรูป 1:1
    }

    function loop() {
      if (!g.running) return;
      g.tick++;

      // ฟิสิกส์ไดโน
      g.vy += GRAVITY;
      g.dinoY += g.vy;
      if (g.dinoY >= 0) {
        g.dinoY = 0;
        g.vy = 0;
        g.onGround = true;
      }

      // spawn กระบองเพชรเป็นช่วง ๆ (ถี่ขึ้นเล็กน้อยตามคะแนน)
      const gap = Math.max(60, 110 - Math.floor(g.score / 200));
      if (g.tick % gap === 0) spawnObstacle();

      // เลื่อน + ลบที่พ้นจอ + เช็คชน (hitbox แคบกว่ารูปจริง ~ padding ใน SVG = แฟร์ขึ้น)
      const PAD = 6; // กันชนรูปที่มีขอบใส
      const dinoL = DINO_X + PAD;
      const dinoR = DINO_X + DINO_W - PAD;
      const dinoFoot = GROUND + g.dinoY; // เท้าไดโน
      for (const o of g.obstacles) o.x -= g.speed;
      g.obstacles = g.obstacles.filter((o) => o.x + o.w > 0);
      for (const o of g.obstacles) {
        const oL = o.x + PAD;
        const oR = o.x + o.w - PAD;
        const hitX = dinoR > oL && dinoL < oR;
        const hitY = dinoFoot > GROUND - o.h + 4; // เท้าต่ำกว่ายอดกระบองเพชร = ชน
        if (hitX && hitY) {
          g.running = false;
          setOver(true);
          setBest((b) => Math.max(b, Math.floor(g.score / 10)));
          break;
        }
      }

      // คะแนน + เร่งความเร็วแบบค่อย ๆ ลื่น (ramp ตาม score, ไม่กระโดดเป็น step)
      g.score++;
      g.speed = START_SPEED + g.score / 1200; // 2.0 → ค่อย ๆ ไวขึ้นเรื่อย ๆ
      if (g.speed > 7) g.speed = 7; // เพดานกันเร็วเกินเล่นไม่ได้
      if (g.score % 5 === 0) setScore(Math.floor(g.score / 10));

      // ---- วาด ----
      // พื้นหลังอ่อน (ไดโนเป็นรูปสีดำ — ต้องมีพื้นสว่างถึงจะเห็น เหมือน Dino จริงของ Chrome)
      ctx.fillStyle = "#f1f3f5";
      ctx.fillRect(0, 0, W, H);
      // พื้น
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.moveTo(0, GROUND);
      ctx.lineTo(W, GROUND);
      ctx.stroke();

      // ---- ไดโน (รูป SVG) ----
      const dy = GROUND + g.dinoY; // ระดับเท้าไดโน ณ ตอนนี้
      if (dinoImg.complete && dinoImg.naturalWidth) {
        ctx.drawImage(dinoImg, DINO_X, dy - DINO_H, DINO_W, DINO_H);
      } else {
        // fallback ถ้ารูปยังโหลดไม่เสร็จ
        ctx.fillStyle = "#f47527";
        ctx.fillRect(DINO_X, dy - DINO_H, DINO_W, DINO_H);
      }

      // ---- กระบองเพชร (รูป SVG) ----
      for (const o of g.obstacles) {
        const top = GROUND - o.h;
        if (cactusImg.complete && cactusImg.naturalWidth) {
          ctx.drawImage(cactusImg, o.x, top, o.w, o.h);
        } else {
          ctx.fillStyle = "#7bd88f";
          ctx.fillRect(o.x, top, o.w, o.h);
        }
      }

      g.raf = requestAnimationFrame(loop);
    }

    loop();

    return () => {
      g.running = false;
      cancelAnimationFrame(g.raf);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("pointerdown", jump);
    };
  }, []);

  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="muted">🦖 กด Space / ↑ / แตะ เพื่อกระโดด · เล่นแก้เบื่อระหว่างรอ</span>
        <span className="muted">
          คะแนน <span className="text-brand-300">{score}</span>
          {best > 0 && <> · best {best}</>}
        </span>
      </div>
      <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-ink-850/60">
        <canvas
          ref={canvasRef}
          width={520}
          height={140}
          className="w-full cursor-pointer"
          style={{ touchAction: "none" }}
        />
        {over && (
          <div className="absolute inset-0 grid place-items-center bg-black/40 text-center text-sm">
            <div>
              <div className="font-semibold">เกมโอเวอร์ — คะแนน {score}</div>
              <div className="muted mt-1 text-xs">กด Space / แตะ เพื่อเล่นใหม่</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
