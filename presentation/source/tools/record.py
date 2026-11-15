# Graba un clip por sesión; imprime marcas de tiempo relativas al inicio del vídeo.
import asyncio, sys, time, json
from playwright.async_api import async_playwright
URL="https://agrospace-w8ej.onrender.com/"; OUT=sys.argv[1]; CLIP=sys.argv[2]
marks={}
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=False, args=["--use-angle=metal","--enable-gpu","--ignore-gpu-blocklist"])
        ctx = await b.new_context(viewport={"width":1600,"height":900}, record_video_dir=f"{OUT}/{CLIP}", record_video_size={"width":1600,"height":900})
        pg = await ctx.new_page(); t0=time.time()
        mark=lambda k: marks.__setitem__(k, round(time.time()-t0,2))
        await pg.goto(URL, wait_until="networkidle", timeout=90000); await pg.wait_for_timeout(5000)
        s = pg.get_by_placeholder("SIGPAC parcel or municipality")
        async def still(n):
            pass
        if CLIP=="A":
            await pg.mouse.move(700,450); await pg.wait_for_timeout(300)
            mark("start"); await pg.mouse.move(930,590,steps=30); await pg.wait_for_timeout(1500)
            await pg.mouse.click(930,590); mark("click"); await pg.wait_for_timeout(9000); mark("end")
        else:
            await pg.mouse.click(930,590); await pg.wait_for_timeout(9000)
            await s.click(); await s.type("Antequera", delay=60); await pg.wait_for_timeout(800); await s.press("Enter")
            await pg.wait_for_timeout(12000)
            if CLIP=="B":
                mark("start"); await s.click(); await s.fill(""); await s.type("29:15:2:18", delay=70); await pg.wait_for_timeout(700)
                await s.press("Enter"); mark("enter"); await pg.wait_for_timeout(16000); mark("end")
            else:
                await s.click(); await s.fill(""); await s.type("29:15:2:18", delay=40); await pg.wait_for_timeout(500); await s.press("Enter")
                await pg.wait_for_timeout(18000); await pg.mouse.move(1300,700); await pg.wait_for_timeout(1000)
                mark("start"); await pg.mouse.click(53,591); mark("play"); await pg.wait_for_timeout(9000)
                mark("model"); await pg.mouse.click(1094,37); await pg.wait_for_timeout(5000)
                await pg.mouse.click(1235,37); await pg.wait_for_timeout(4000); mark("end")
                await pg.mouse.click(1031,37); await pg.wait_for_timeout(500)
        print(json.dumps(marks), flush=True)
        await ctx.close(); await b.close()
asyncio.run(main())
