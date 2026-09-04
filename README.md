# OPERATOR

**You are the machine.** An unseen guest sits in front of an arcade cabinet playing *MOON HOPPER* (1983), a merciless one-button platformer. You watch the game on the CRT and the cabinet's hardware dashboard below it. You secretly bend hitboxes, timing windows and speed, and for every obstacle you decide: do I protect them on the next jump, and if they die, do I let it happen? Win if the guest reaches the high score. Lose if their emotional tolerance hits zero through frustration, boredom or suspicion.

Design document: [`GDD.md`](GDD.md). Current milestone brief: [`BRIEF-M1.md`](BRIEF-M1.md).

## Play

Live: _coming with M1 step 8_ (Render.com). Test phase uses invite links: `https://<service>.onrender.com/?invite=<code>`.

## Run locally

```sh
bun install
bun run dev        # Vite dev server, also reachable in the LAN (--host)
bun run test       # vitest
bun run typecheck  # tsc --noEmit
bun run build      # vite build with git build hash
bun run serve      # Bun server serving dist/ + POST /feedback (needs .env, see .env.example)
```

## Give feedback

Use the **Feedback** button in the game (debrief screen or dashboard). It creates a public GitHub issue with your text, device info and the session log so the session can be replayed headlessly. Alternatively open an issue with the *Feedback* template.

## License

Code, design and assets: [CC BY-NC 4.0](LICENSE). Non-commercial use with attribution.
