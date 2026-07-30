import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const ICON = readFileSync('/home/user/costly/docs/brand/costly-icon.svg', 'utf8')
  .replace(/<!--[\s\S]*?-->/g, '').trim()
  .replace(/width="\d+"/, 'width="80"').replace(/height="\d+"/, 'height="80"');

const BG='#0B0D0A', FG='#F2F4EF', MUTED='#98A090', ACCENT='#2EDB6A', LINE='#2A3124', RED='#EF4444';
const mono = "'DejaVu Sans Mono', ui-monospace, monospace";
const sans = "'DejaVu Sans', system-ui, sans-serif";
const b = (t) => `<b style="color:${FG}">${t}</b>`;
const dim = (t) => `<span style="color:${MUTED}">${t}</span>`;

const block = (label, lines) => `
  <div style="flex:1;border:2px solid ${LINE};border-radius:16px;padding:26px 24px;">
    <div style="font-family:${mono};font-size:14px;letter-spacing:3px;color:${ACCENT};">${label}</div>
    <div style="margin-top:15px;font-family:${sans};font-size:21px;line-height:1.45;color:${FG};">${lines}</div>
  </div>`;

const html = `<!doctype html><meta charset="utf-8"><style>
 html,body{margin:0;padding:0;background:${BG};width:1920px;height:1080px;
   font-family:${sans};-webkit-font-smoothing:antialiased;}
 .wrap{padding:58px 78px;height:100%;box-sizing:border-box;display:flex;flex-direction:column;}
</style><body><div class="wrap">

  <div style="display:flex;align-items:center;gap:22px;">
    ${ICON}
    <div style="font-family:${mono};font-size:16px;letter-spacing:5px;color:${ACCENT};">
      COSTLY&nbsp;&nbsp;/&nbsp;&nbsp;WHO AM I
    </div>
  </div>

  <div style="margin-top:34px;font-size:64px;font-weight:700;color:${FG};line-height:1.1;">
    I can build it, and I can prove it works.
  </div>
  <div style="margin-top:16px;font-size:25px;color:${MUTED};">
    Sina Dehesh &nbsp;·&nbsp; MSc Applied Experimental Psychological Sciences, Milano-Bicocca
  </div>

  <div style="margin-top:22px;border-left:4px solid ${ACCENT};padding-left:20px;font-size:23px;color:${FG};line-height:1.4;">
    I build products out of the literature, not out of competitors.
    <span style="color:${MUTED}">Costly's model is a deposit contract, straight from the behavioural research.</span>
  </div>

  <div style="margin-top:34px;display:flex;gap:22px;flex:1;">
    ${block('THE SCIENTIST', `Thesis: within-subjects, ${b('N=96')}, three conditions, RM-ANOVA, ${b('p=.009')}.<br><br>${dim('200 clinical interviews on compulsive behaviour.')}`)}
    ${block('THE BUILDER', `${b('20+ products and prototypes')} in the last year. The four that survived contact with users: OopsCupid, two Pipedrive products, Engineer Passway.<br><br>${dim('Costly is solo: the Stripe hold-and-capture lifecycle and the Android detection engine.')}`)}
    ${block('THE FOUNDER', `Co-founded ${b('Guardbar')}, accepted into Shiraz Science &amp; Technology Park.<br><br>${dim('9 cold user interviews for Costly. 6 changes shipped from them.')}`)}
  </div>

  <div style="margin-top:32px;border-left:5px solid ${RED};padding-left:24px;">
    <div style="font-size:29px;color:${MUTED};line-height:1.4;">
      Every competitor in this category makes a correlational claim.
    </div>
    <div style="font-size:33px;color:${ACCENT};font-weight:700;margin-top:5px;">
      I can run the trial.
    </div>
  </div>

</div></body>`;

const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const p = await br.newPage({ viewport:{width:1920,height:1080} });
await p.setContent(html, { waitUntil:'load' });
await p.waitForTimeout(200);
await p.screenshot({ path:'/home/user/costly/docs/brand/png/costly-slide-founder.png' });
await br.close();
console.log('rendered');
