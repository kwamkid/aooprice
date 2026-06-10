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
    speed: 5,
    tick: 0,
    score: 0,
    running: true,
    raf: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!; // canvas รองรับ 2d เสมอ (กัน TS null ใน closure)

    const W = canvas.width;
    const H = canvas.height;
    const GROUND = H - 20; // เส้นพื้น
    const DINO_X = 40;
    const DINO_W = 22;
    const DINO_H = 26;
    const GRAVITY = 0.7;
    const JUMP_V = -11;

    const g = game.current;
    // reset
    g.dinoY = 0;
    g.vy = 0;
    g.onGround = true;
    g.obstacles = [];
    g.speed = 5;
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
      g.speed = 5;
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
      const h = 16 + Math.floor((g.tick % 3) * 6); // สูงสลับ ๆ ตาม tick
      g.obstacles.push({ x: W, w: 12, h });
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

      // เลื่อน + ลบที่พ้นจอ + เช็คชน
      const dinoTop = GROUND - DINO_H + g.dinoY;
      const dinoBottom = GROUND + g.dinoY;
      for (const o of g.obstacles) o.x -= g.speed;
      g.obstacles = g.obstacles.filter((o) => o.x + o.w > 0);
      for (const o of g.obstacles) {
        const hitX = DINO_X + DINO_W > o.x && DINO_X < o.x + o.w;
        const hitY = dinoBottom > GROUND - o.h;
        if (hitX && hitY && dinoTop < GROUND) {
          g.running = false;
          setOver(true);
          setBest((b) => Math.max(b, Math.floor(g.score / 10)));
          break;
        }
      }

      // คะแนน + เร่งความเร็ว
      g.score++;
      if (g.score % 500 === 0) g.speed += 0.5;
      if (g.score % 5 === 0) setScore(Math.floor(g.score / 10));

      // ---- วาด ----
      ctx.clearRect(0, 0, W, H);
      // พื้น
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath();
      ctx.moveTo(0, GROUND);
      ctx.lineTo(W, GROUND);
      ctx.stroke();
      // ไดโน (สี่เหลี่ยมส้มแบรนด์ + ตา)
      ctx.fillStyle = "#f47527";
      ctx.fillRect(DINO_X, GROUND - DINO_H + g.dinoY, DINO_W, DINO_H);
      ctx.fillStyle = "#fff";
      ctx.fillRect(DINO_X + DINO_W - 7, GROUND - DINO_H + 5 + g.dinoY, 3, 3);
      // กระบองเพชร
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      for (const o of g.obstacles) ctx.fillRect(o.x, GROUND - o.h, o.w, o.h);

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
