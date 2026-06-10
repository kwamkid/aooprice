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
    speed: 3,
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
    const DINO_W = 26;
    const DINO_H = 28;
    const GRAVITY = 0.55;
    const JUMP_V = -10;
    const START_SPEED = 3; // ช้าลงจากเดิม (5) — เล่นง่ายขึ้น

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
      if (g.score % 800 === 0) g.speed += 0.3;
      if (g.score % 5 === 0) setScore(Math.floor(g.score / 10));

      // ---- วาด ----
      ctx.clearRect(0, 0, W, H);
      // พื้น
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath();
      ctx.moveTo(0, GROUND);
      ctx.lineTo(W, GROUND);
      ctx.stroke();

      // ---- ไดโน (รูปทรงคล้าย T-Rex สีส้มแบรนด์) ----
      const dy = GROUND + g.dinoY; // ระดับเท้าไดโน ณ ตอนนี้
      ctx.fillStyle = "#f47527";
      // ลำตัว
      ctx.fillRect(DINO_X, dy - 18, 14, 14);
      // หาง (ชี้ไปข้างหลัง)
      ctx.fillRect(DINO_X - 6, dy - 14, 6, 5);
      // คอ + หัว (ชูขึ้นด้านหน้า)
      ctx.fillRect(DINO_X + 10, dy - 26, 8, 10);
      ctx.fillRect(DINO_X + 14, dy - 28, 12, 12); // หัว
      // ปาก
      ctx.fillRect(DINO_X + 26, dy - 22, 4, 4);
      // ตา (ขาว)
      ctx.fillStyle = "#fff";
      ctx.fillRect(DINO_X + 22, dy - 26, 3, 3);
      // ขา — สลับซ้าย/ขวาให้เหมือนวิ่ง (เฉพาะตอนอยู่บนพื้น)
      ctx.fillStyle = "#f47527";
      const stride = g.onGround && Math.floor(g.tick / 6) % 2 === 0;
      ctx.fillRect(DINO_X + 2, dy - 4, 4, stride ? 4 : 2);
      ctx.fillRect(DINO_X + 9, dy - 4, 4, stride ? 2 : 4);
      // แขนเล็ก
      ctx.fillRect(DINO_X + 12, dy - 14, 4, 3);

      // ---- กระบองเพชร (มีแขนข้าง ๆ) ----
      ctx.fillStyle = "#7bd88f";
      for (const o of g.obstacles) {
        const top = GROUND - o.h;
        ctx.fillRect(o.x + 3, top, 6, o.h); // ลำต้น
        ctx.fillRect(o.x, top + o.h * 0.35, 3, o.h * 0.3); // แขนซ้าย
        ctx.fillRect(o.x + 9, top + o.h * 0.2, 3, o.h * 0.3); // แขนขวา
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
