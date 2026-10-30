// Naz Paşalı's Bingo / passport / badge styling (prototype v3, CSS ~635–1011), ported as one
// scoped stylesheet: every class is prefixed `nb-` so nothing leaks into the rest of the app.
// Motion only runs when the person hasn't asked for reduced motion.
const CSS = String.raw`
.nb-scope{--mg:#E9A23B;--mg-ink:#241C22;--paperc:#EFE3CF;--nt:#f3ebdd;--nt-2:rgb(243 235 221 / .68);--nt-line:rgb(243 235 221 / .24);--plum:#2A1530;--plum-2:#36203B;--burg:#4A1426;--mo:#D9773A}
.nb-night{color:var(--nt)}
.nb-paper{background-color:var(--paperc);color:var(--mg-ink);position:relative;overflow:hidden}
.nb-paper::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.5;mix-blend-mode:multiply;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='p'><feTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0 0.3  0 0 0 0.35 0'/></filter><rect width='100%' height='100%' filter='url(%23p)'/></svg>")}
.nb-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 20px;border-radius:999px;border:0;font-size:15px;font-weight:600;line-height:1.1;text-align:center;cursor:pointer;transition:filter .2s ease,box-shadow .2s ease}
.nb-btn:focus-visible,.nb-focus:focus-visible{outline:2px solid var(--mg);outline-offset:3px}
.nb-btn svg{width:17px;height:17px;flex:none}
.nb-mg{background:var(--mg);color:var(--mg-ink)}
.nb-mg:hover{filter:brightness(1.05)}
.nb-nline{background:transparent;color:var(--nt);box-shadow:inset 0 0 0 1px var(--nt-line)}
.nb-nline:hover{box-shadow:inset 0 0 0 1px var(--nt)}
.nb-mono{font-family:var(--font-mono,"DM Mono",ui-monospace,monospace);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase}
.nb-poster{font-family:var(--font-display,"Archivo",sans-serif);font-stretch:62%;font-weight:900;line-height:.84;letter-spacing:-.02em}
:root:not([lang="tr"]) .nb-poster{overflow-wrap:break-word;hyphens:auto}

/* entry: a ticket stub in the home header */
.nb-tk{display:inline-flex;align-items:stretch;height:44px;border:0;padding:0;background:none;color:var(--nt);font-family:var(--font-mono,"DM Mono",monospace);font-size:10px;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;cursor:pointer}
.nb-tk span{display:inline-flex;align-items:center;padding:0 9px;box-shadow:inset 0 0 0 1px var(--mg)}
.nb-tk .a{border-radius:9px 2px 2px 9px;color:var(--mg);font-weight:500}
.nb-tk .b{border-radius:2px 9px 9px 2px;margin-inline-start:-1px;border-inline-start:1px dashed var(--mg);font-variant-numeric:tabular-nums}
.nb-tk:hover .a{background:var(--mg);color:var(--mg-ink)}
.nb-tk:focus-visible{outline:2px solid var(--mg);outline-offset:3px;border-radius:10px}

/* card */
.nb-pips{display:flex;gap:4px}
.nb-pips i{width:22px;height:12px;border-radius:3px;box-shadow:inset 0 0 0 1px var(--mg)}
.nb-pips i.on{background:var(--mg)}
.nb-pips i.pv{background:repeating-linear-gradient(135deg,rgba(233,162,59,.55) 0 2px,transparent 2px 5px)}
.nb-grid-wrap{position:relative;direction:ltr}
.nb-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.nb-bq{position:relative;aspect-ratio:1;min-width:0;width:100%;border:0;padding:0;border-radius:10px;overflow:hidden;background:#120E1C;color:var(--nt);text-align:start;box-shadow:inset 0 0 0 1px var(--nt-line);cursor:pointer}
.nb-bq:focus-visible{outline:2px solid var(--mg);outline-offset:2px}
.nb-vis{position:absolute;inset:0;background:radial-gradient(130% 95% at 78% 8%,rgba(var(--atm),.20),transparent 62%),radial-gradient(90% 80% at 10% 100%,rgba(var(--atm),.07),transparent 70%)}
.nb-art{position:absolute;inset:0;display:flex;flex-direction:column;padding:25px 8px 8px;pointer-events:none}
.nb-art-i{flex:1 1 auto;min-height:0;display:flex;align-items:center;justify-content:center;padding-bottom:3px;container-type:size}
.nb-ghost{position:static !important;visibility:hidden;flex:none}
.nb-bqa{display:block;width:100%;height:100%;max-height:46px;overflow:visible}
@container (max-height:20px){.nb-bqa{display:none}}
.nb-top{position:absolute;z-index:1;left:8px;right:8px;top:7px;display:flex;justify-content:space-between;align-items:center;font-family:var(--font-mono,"DM Mono",monospace);font-size:9.5px;letter-spacing:.08em;color:var(--nt-2)}
.nb-st{width:18px;height:18px;display:grid;place-items:center}
.nb-st svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.nb-t{position:absolute;z-index:1;left:8px;right:8px;bottom:8px;font-family:var(--font-display,"Archivo",sans-serif);font-stretch:75%;font-weight:800;font-size:14px;line-height:1.02;letter-spacing:-.005em;text-wrap:balance}
:root:not([lang="tr"]) .nb-t{overflow-wrap:anywhere;hyphens:auto}
@media (max-width:359px){.nb-t{font-size:12.5px}}
.nb-bq::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:rgba(233,162,59,.14);opacity:0;transition:opacity .32s ease}
.nb-bq.st-progress{box-shadow:inset 0 0 0 1px var(--mg)}
.nb-bq.st-progress .nb-st{color:var(--mg)}
.nb-bq.st-done{box-shadow:inset 0 0 0 1.5px var(--mg)}
.nb-bq.st-done::after{opacity:1}
.nb-bq.st-done .nb-st{color:var(--mg)}
.nb-bq.free{background:var(--paperc);color:var(--mg-ink);box-shadow:none}
.nb-bq.free::after{display:none}
.nb-bq.free .nb-top{color:var(--mg-ink)}
.nb-free{position:absolute;inset:0;display:grid;place-content:center;text-align:center;gap:4px}
.nb-free img{width:64%;max-width:78px;height:auto;margin:0 auto}
.nb-free b{font-family:var(--font-mono,"DM Mono",monospace);font-size:10px;letter-spacing:.24em}
.nb-lines{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
.nb-lines path{fill:none;stroke:var(--mg);stroke-width:2.2;stroke-linecap:round}
.nb-lines path.pv{stroke-dasharray:.025 .02;opacity:.9}
.nb-legend{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:11.5px;color:var(--nt-2)}
.nb-legend span{display:inline-flex;align-items:center;gap:6px}
.nb-legend i{width:12px;height:12px;border-radius:3px;box-shadow:inset 0 0 0 1px var(--nt-line)}
.nb-legend i.p{box-shadow:inset 0 0 0 1px var(--mg)}
.nb-legend i.d{box-shadow:inset 0 0 0 1.5px var(--mg);background:rgba(233,162,59,.3)}
.nb-legend i.v{background:var(--mg);box-shadow:none;opacity:.45}
@media (prefers-reduced-motion:no-preference){
  .nb-bq{transition:box-shadow .26s ease,transform .2s ease}
  .nb-bq:hover{transform:translateY(-1px)}
  .nb-bq.flash{animation:nb-flash 1.6s cubic-bezier(.16,1,.3,1)}
  .nb-bq.lit{animation:nb-lit 1.2s ease-out}
  .nb-lines path.draw{stroke-dasharray:1 1;stroke-dashoffset:1;animation:nb-draw .9s cubic-bezier(.65,0,.35,1) .25s forwards}
  .nb-lines path.draw.pv{animation:nb-draw-pv .9s cubic-bezier(.65,0,.35,1) .25s both}
  .nb-cz{animation:nb-fade .42s ease both}
  .nb-cz .h{animation:nb-rise .9s cubic-bezier(.16,1,.3,1) .12s both}
  .nb-cz .sub{animation:nb-fade .5s ease .45s both}
  .nb-cz .tkw .nb-ticket{transform-origin:50% 0%;animation:nb-flip 1.1s cubic-bezier(.2,.8,.2,1) .65s both}
  .nb-cz .acts{animation:nb-rise-s .5s ease 1.3s both}
  .nb-pass{transition:transform .22s cubic-bezier(.22,1,.36,1)}
  .nb-pass:hover{transform:translateY(-2px)}
  .nb-bdg{transition:background .2s ease}
}
@keyframes nb-flash{0%{transform:scale(.96)}35%{box-shadow:inset 0 0 0 2px var(--mg),0 0 0 6px rgba(233,162,59,.28);transform:scale(1.02)}100%{transform:none}}
@keyframes nb-lit{0%{filter:brightness(1)}30%{filter:brightness(1.45)}100%{filter:brightness(1)}}
@keyframes nb-draw{to{stroke-dashoffset:0}}
@keyframes nb-draw-pv{from{opacity:0}to{opacity:.9}}
@keyframes nb-fade{from{opacity:0}to{opacity:1}}
@keyframes nb-rise{from{opacity:0;transform:translateY(26px);letter-spacing:.06em}to{opacity:1;transform:none}}
@keyframes nb-rise-s{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes nb-flip{0%{opacity:0;transform:rotateX(-96deg)}5%{opacity:1;transform:rotateX(-96deg)}75%{transform:rotateX(8deg)}100%{opacity:1;transform:rotateX(0)}}

/* challenge sheet */
.nb-steps{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}
.nb-steps li{display:grid;gap:6px;font-size:11px;color:var(--nt-2);line-height:1.2}
.nb-steps li::before{content:"";height:3px;border-radius:2px;background:var(--nt-line)}
.nb-steps li.on{color:var(--nt)}
.nb-steps li.on::before{background:var(--mg)}
.nb-steps li.na{opacity:.55}
.nb-sec{margin-top:22px;border-top:1px solid var(--nt-line);padding-top:12px}
.nb-sec h3,.nb-sec h4{margin:0 0 10px;font-family:var(--font-mono,"DM Mono",monospace);font-size:10.5px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:var(--nt-2)}
.nb-rp{display:grid;gap:6px}
.nb-rp-line{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--nt-2)}
.nb-rp-line .cells{display:inline-flex;gap:3px;flex:none}
.nb-rp-line .cells i{width:12px;height:12px;border-radius:3px;box-shadow:inset 0 0 0 1px var(--nt-line)}
.nb-rp-line .cells i.ok{background:var(--mg);box-shadow:none}
.nb-rp-line .cells i.me{box-shadow:inset 0 0 0 1.5px var(--nt)}
.nb-vm{padding:12px 14px;border-radius:14px;box-shadow:inset 0 0 0 1px var(--nt-line);display:grid;gap:8px}
.nb-vm p{margin:0;font-size:13px;color:var(--nt-2);line-height:1.45}
.nb-vm h4{margin:0;font-size:15px;font-weight:600;color:var(--nt);text-transform:none;letter-spacing:0;font-family:inherit}

/* chips */
.nb-xs,.nb-xb{display:inline-flex;align-items:center;gap:5px;min-height:22px;padding:3px 8px;line-height:1.25;border-radius:999px;font-family:var(--font-mono,"DM Mono",monospace);font-size:9.5px;letter-spacing:.06em;text-transform:uppercase}
.nb-xs{box-shadow:inset 0 0 0 1px #C9842A;color:#8A5413;background:color-mix(in oklab,#E9A23B 14%,transparent)}
.nb-xb{box-shadow:inset 0 0 0 1px var(--border,#d8cfc0);color:var(--muted-foreground)}
.nb-dark .nb-xs{color:#E9A23B;background:transparent;box-shadow:inset 0 0 0 1px rgba(233,162,59,.6)}
.nb-dark .nb-xb{color:var(--nt-2);box-shadow:inset 0 0 0 1px var(--nt-line)}

/* rewards: tickets */
.nb-rw{display:grid;gap:10px}
.nb-ticket{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 84px;min-height:150px;border-radius:10px;overflow:hidden}
.nb-ticket::before,.nb-ticket::after{content:"";position:absolute;right:77px;width:14px;height:14px;border-radius:50%;background:var(--nb-hole,#0d0b1a);z-index:3}
.nb-ticket::before{top:-7px}.nb-ticket::after{bottom:-7px}
.nb-ticket .main{position:relative;padding:14px 16px;display:flex;flex-direction:column;justify-content:space-between;gap:8px;min-width:0}
.nb-ticket .stub{position:relative;border-inline-start:1.5px dashed rgba(36,28,34,.45);display:grid;place-items:center;padding:10px 6px;text-align:center;font-family:var(--font-mono,"DM Mono",monospace);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase}
.nb-ticket .k{font-family:var(--font-mono,"DM Mono",monospace);font-size:10px;letter-spacing:.14em;text-transform:uppercase;opacity:.75}
.nb-ticket .big{font-family:var(--font-display,"Archivo",sans-serif);font-stretch:62%;font-weight:900;line-height:.82;letter-spacing:-.02em}
.nb-ticket .sub{font-size:12.5px;opacity:.8;max-width:26ch}
.nb-ticket .stamp{position:absolute;z-index:4;right:96px;top:12px;padding:3px 7px;border:1px solid currentColor;border-radius:4px;font-family:var(--font-mono,"DM Mono",monospace);font-size:9px;letter-spacing:.14em;transform:rotate(6deg);opacity:.85}
.nb-ticket.t1{color:var(--mg-ink)}
.nb-ticket.t1 .big{font-size:clamp(52px,17vw,74px)}
.nb-ticket.t1 .big span{font-size:.5em;vertical-align:top}
.nb-ticket.t2{background:#1A1620;color:var(--nt)}
.nb-ticket.t2 .stub{background:var(--paperc);color:var(--mg-ink)}
.nb-ticket .cup{position:absolute;right:-24px;top:50%;width:150px;height:150px;margin-top:-75px;border-radius:50%;filter:grayscale(1);background:radial-gradient(circle at 50% 50%,#2a1f19 0 30%,#5b4637 31% 33%,#1f1814 34% 40%,#ddd3c4 41% 47%,#bdb2a2 48% 49%,#0f0c0a 50% 100%);box-shadow:inset 0 0 30px rgba(0,0,0,.8);opacity:.85}
.nb-ticket.t2 .main{z-index:1}
.nb-ticket.t2 .big{font-size:clamp(36px,12vw,46px);max-width:7ch}
.nb-ticket.t3{background:#0E0B16;color:var(--nt);box-shadow:inset 0 0 0 1px var(--mg)}
.nb-ticket.t3 .big{font-size:clamp(40px,13vw,52px);color:var(--mg)}
.nb-ticket.t3 .stub{color:var(--mg);border-inline-start-color:rgba(233,162,59,.5)}
.nb-ticket .bar{width:52px;height:72px;background:repeating-linear-gradient(90deg,currentColor 0 2px,transparent 2px 4px,currentColor 4px 5px,transparent 5px 8px,currentColor 8px 11px,transparent 11px 12px);opacity:.7}
.nb-rw.na .nb-ticket{filter:grayscale(1) brightness(.6);opacity:.7}
.nb-chip{display:inline-flex;align-items:center;min-height:26px;padding:2px 10px;border-radius:999px;font-size:12px;box-shadow:inset 0 0 0 1px var(--nt-line);color:var(--nt-2)}
.nb-chip.on{box-shadow:inset 0 0 0 1px var(--mg);color:var(--mg)}
.nb-facts{margin:0;display:grid;grid-template-columns:max-content minmax(0,1fr);gap:4px 12px;font-size:12.5px}
.nb-facts dt{color:var(--nt-2);font-family:var(--font-mono,"DM Mono",monospace);font-size:10px;letter-spacing:.1em;text-transform:uppercase;padding-top:2px}
.nb-facts dd{margin:0;color:var(--nt)}

/* çinko */
.nb-cz{position:fixed;inset:0;z-index:80;display:flex;flex-direction:column;justify-content:center;padding:24px 20px 30px;color:var(--nt);overflow-y:auto}
.nb-cz .bg{position:fixed;inset:0;background:radial-gradient(90% 60% at 50% 40%,rgba(233,162,59,.22),transparent 70%),rgba(13,11,26,.95);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.nb-cz > *:not(.bg){position:relative;width:100%;max-width:440px;margin-inline:auto}
.nb-cz .h{margin:16px 0 0;font-size:clamp(72px,24vw,104px);color:var(--mg);line-height:.8;letter-spacing:-.03em}
.nb-cz .sub{margin:12px 0 0;font-size:17px;font-weight:500;line-height:1.35}
.nb-cz .tkw{margin-top:22px;perspective:900px;opacity:.62;filter:grayscale(.85)}
.nb-cz .acts{margin-top:22px;display:grid;gap:8px}

/* profile: the Bingo passport, a dark membership card */
.nb-pass{position:relative;display:block;border-radius:20px;background:var(--burg);color:var(--nt);overflow:hidden}
.nb-pass::before,.nb-pass::after{content:"";position:absolute;top:118px;width:18px;height:18px;margin-top:-9px;border-radius:50%;background:var(--background,#f4efe7);z-index:2}
.nb-pass::before{left:-9px}.nb-pass::after{right:-9px}
.nb-pass .top{padding:16px 18px 14px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;min-height:118px}
.nb-pass .k{color:var(--mg)}
.nb-pass .t{margin:6px 0 0;font-size:34px;line-height:.86}
.nb-pass .no{margin-top:8px;color:var(--nt-2);font-size:10px}
.nb-pass-grid{display:grid;grid-template-columns:repeat(3,20px);gap:4px;align-self:start;direction:ltr}
.nb-pass-grid i{width:20px;height:20px;border-radius:4px;box-shadow:inset 0 0 0 1px rgba(243,235,221,.22)}
.nb-pass-grid i.progress{box-shadow:inset 0 0 0 1px var(--mg)}
.nb-pass-grid i.done{box-shadow:inset 0 0 0 1.5px var(--mg);background:rgba(233,162,59,.3)}
.nb-pass-grid i.free{background:var(--paperc);box-shadow:none}
.nb-pass .bot{border-top:1.5px dashed rgba(243,235,221,.25);padding:14px 18px 16px;display:grid;gap:12px}
.nb-pass .row{display:flex;justify-content:space-between;align-items:center;gap:6px 10px;flex-wrap:wrap;font-size:13px;color:var(--nt-2)}
.nb-pass .row b{color:var(--nt);font-weight:600}
.nb-pass .nb-pips i{width:18px;height:10px}
.nb-pass .acts{display:flex;gap:8px;flex-wrap:wrap}
.nb-pass .acts .nb-mg{flex:1 1 auto}

/* profile: badge band */
.nb-band{background:var(--plum);color:var(--nt)}
.nb-bdg-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.nb-bdg{border:0;padding:14px 14px 12px;border-radius:16px;background:var(--plum-2);color:var(--nt);text-align:start;display:grid;gap:4px;align-content:start;cursor:pointer;min-width:0}
.nb-bdg:hover{background:#40284A}
.nb-bdg:focus-visible{outline:2px solid var(--mg);outline-offset:2px}
.nb-bdg.wide{grid-column:1 / -1;grid-template-columns:96px minmax(0,1fr);column-gap:14px;align-items:center}
.nb-bdg.wide .nb-bdg-art{grid-row:span 4;margin:0}
.nb-bdg-art{width:96px;height:96px;display:block;margin-bottom:6px;max-width:100%}
.nb-bdg b{font-family:var(--font-mono,"DM Mono",monospace);font-size:11px;font-weight:500;letter-spacing:.12em;text-transform:uppercase}
.nb-bdg small{font-size:12.5px;color:var(--nt-2);line-height:1.3}
.nb-prog{display:flex;gap:3px;margin-top:4px}
.nb-prog i{flex:1;height:3px;border-radius:2px;background:rgba(243,235,221,.16)}
.nb-prog i.on{background:var(--mg)}
.nb-bdg .bp{font-family:var(--font-mono,"DM Mono",monospace);font-size:10px;letter-spacing:.08em;color:var(--nt-2);margin-top:2px}
.nb-bdg.done .bp{color:var(--mg)}
.nb-bdg.locked b{color:var(--nt-2)}
.ba{fill:none;stroke:var(--nt);stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}
.ba-f{fill:var(--nt);stroke:none}.ba-m{fill:var(--mg);stroke:none}.ba-o{fill:var(--mo);stroke:none}.ba-b{fill:var(--burg);stroke:none}
.ba-ml{fill:none;stroke:var(--mg);stroke-width:1.4;stroke-linecap:round}
.ba-ring{fill:none;stroke:rgba(243,235,221,.28);stroke-width:1}
.locked .ba,.locked .ba-ml{stroke:rgba(243,235,221,.4)}
.locked .ba-f,.locked .ba-m,.locked .ba-o{fill:rgba(243,235,221,.1)}
.locked .ba-b{fill:rgba(0,0,0,.18)}
.locked .ba-ring{stroke-dasharray:2 4}

/* profile: Deneyimlerim */
.nb-xf{flex:none;min-height:44px;padding:0 14px;border-radius:999px;border:0;background:transparent;box-shadow:inset 0 0 0 1px var(--border);color:var(--foreground);font-size:13.5px;font-weight:600;display:inline-flex;align-items:center;gap:6px;cursor:pointer}
.nb-xf small{font-family:var(--font-mono,"DM Mono",monospace);font-size:10px;color:var(--muted-foreground);font-weight:400}
.nb-xf[aria-pressed="true"]{background:var(--foreground);color:var(--background);box-shadow:none}
.nb-xf[aria-pressed="true"] small{color:inherit;opacity:.7}
.nb-xf:focus-visible{outline:2px solid var(--ring);outline-offset:2px}
.k-w{box-shadow:inset 0 0 0 1.2px var(--foreground)}
.k-d{background:color-mix(in oklab,#E9A23B 45%,transparent);box-shadow:inset 0 0 0 1.2px #C9842A}
.k-v{background:#E9A23B;opacity:.4}
`;

/** Render once per screen that uses Bingo, passport or badge classes. */
export function BingoStyles() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}
