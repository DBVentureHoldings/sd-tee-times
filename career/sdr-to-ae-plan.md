# SDR to AE at Cato Networks: A 12-Month Attack Plan

A working document for going from top SDR to Account Executive at Cato, with a technical foundation strong enough that SEs and CISOs take you seriously. Treat this like a quota: weekly commits, measurable outputs, reviewed monthly.

---

## Part 1: The honest diagnosis

You said three things, and each one maps to a fixable gap:

1. **"I want to be an AE at Cato."** That is a promotion problem. Promotions are won on evidence, not enthusiasm. You need a documented case that you already do AE-level work.
2. **"The best sellers are technical, which I lack."** That is a curriculum problem. Technical credibility in Cato's world is learnable in 6 to 9 months of deliberate study because the domain (SASE) is well defined.
3. **"I feel not confident in convos with high level people."** That is a reps problem, not a personality problem. Confidence with VPs and CISOs comes from (a) knowing their world better than they expect and (b) having had the conversation enough times that it stops being novel.

The plan below attacks all three in parallel.

---

## Part 2: Know Cato better than anyone (the technical curriculum)

### 2.1 The core story you must be able to tell cold

Before any feature knowledge, be able to whiteboard this in 3 minutes to a skeptical network engineer AND in 90 seconds to a CFO:

- Enterprises used to have a castle-and-moat: MPLS lines connecting branches to a data center, with a security stack (firewall, proxy, VPN concentrator) at the perimeter.
- Cloud apps, remote work, and global offices broke that model. Traffic now goes everywhere, so backhauling it through a data center adds latency and cost, and appliances at every site add complexity.
- Gartner named the answer SASE: converge networking (SD-WAN) and security (SSE: SWG, CASB, ZTNA, DLP, FWaaS) into a single cloud service.
- Cato's differentiator: it was built as a single cloud-native platform from day one (single-pass engine, one policy, one console, its own global private backbone of PoPs), versus competitors who stitched together acquisitions.
- Business outcome language: replace MPLS spend, retire appliance refresh cycles, one vendor instead of five, faster M&A integration, consistent security for every user everywhere.

If you can tell that story fluently at both altitudes, you are already ahead of most AEs in the industry.

### 2.2 The technical stack to actually learn (in order)

**Phase A: Networking fundamentals (months 1 to 2)**
You cannot fake this layer and everything else sits on it.
- TCP/IP, DNS, routing basics, NAT, what a tunnel is (IPsec, and why Cato uses DTLS/proprietary tunneling from the Socket)
- What MPLS actually is, what it costs, and why companies still have it
- SD-WAN mechanics: multiple last-mile links, packet loss mitigation, app-aware routing, QoS
- Resources: "Practical Networking" on YouTube, a CCNA study guide (you do not need the cert, you need the first third of the book), and one hour a week with a Cato SE asking "explain this to me like I am new."

**Phase B: The security side (months 2 to 4)**
- ZTNA and why it kills the legacy VPN (this is one of Cato's easiest wedge deals, know it cold)
- SWG, CASB (inline vs API), DLP, RBI, FWaaS: what each does, what problem it replaced
- Single-pass architecture: why inspecting traffic once for all engines beats service chaining. This is Cato's core technical moat, be able to explain it with a drawing.
- Cato's threat prevention: IPS, next-gen anti-malware, MDR/XDR offerings
- Resource: Cato's own Cato Academy and the SASE certification courses Cato publishes. Finish every internal enablement course and get the internal certifications. Ask enablement what SEs are required to complete, then complete it.

**Phase C: The Cato platform itself (months 3 to 6, hands on)**
- Get access to a demo tenant or lab tenant. Ask your SE team lead directly: "I want to learn the CMA (Cato Management Application) well enough to run a first-call demo. Can I get lab access and 30 minutes a week of your time?" SEs almost always say yes to SDRs who ask this.
- Learn to do the standard demo flow yourself: connect a site, show the policy engine, show real-time analytics, show a ZTNA policy for a remote user.
- Learn the Socket (Cato's edge device), vSocket, IPsec connections from third-party gear, and the Cato Client for remote users.
- Know the PoP map and why the private backbone matters for global accounts (China access, latency-sensitive apps, cloud on-ramps).

**Phase D: Competitive mastery (months 4 to 8, ongoing forever)**
Know the battlecards, then go deeper than the battlecards:
- Zscaler (SSE-strong, no real SD-WAN of its own, complexity of multiple products)
- Palo Alto Prisma SASE (breadth via acquisition, complexity, cost)
- Netskope, Fortinet (appliance DNA), Cisco (Meraki/Umbrella patchwork), Versa, HPE/Aruba (Silver Peak + Axis)
- For each: where they win, where Cato wins, the one question that exposes their weakness, and which buyer persona favors them.
- Read every competitive win/loss note in your CRM for closed deals in your segment. This is free education nobody uses.

**Phase E: The buyer's world (ongoing)**
- Learn how IT budgets work: capex vs opex, MPLS contract cycles, appliance refresh cycles, headcount pressure on network and security teams. Deals are timed to these events.
- Follow 10 CISOs and 10 network/infrastructure VPs on LinkedIn. Read what they share. Learn their vocabulary (risk, audit findings, board reporting, cyber insurance, consolidation).
- Read Cato's customer case studies, all of them, and be able to cite three by name per vertical you prospect into.

### 2.3 Certifications worth the time

- Every internal Cato certification and SE enablement track available to you
- Cato's public SASE certification courses
- Optional but high-signal: CompTIA Network+ or Security+ (pick one, Security+ if you sell to security buyers). You want the knowledge; the paper is a bonus for your promotion case.

---

## Part 3: Fixing the executive conversation problem

### 3.1 Why you feel shaky, and the reframe

You feel unconfident with VPs and CISOs because you suspect they know more than you. Correct, they do, about their own environment. But they do NOT know more than you about:
- What their peer companies are doing about MPLS costs and VPN replacement
- What Cato deployments actually look like and how long they take
- What the market is doing (vendor consolidation, SASE adoption curves)

Your job in an exec conversation is not to out-rank them. It is to bring outside information they cannot get elsewhere. Once you internalize that you are the expert on the pattern and they are the expert on their instance, the fear drops.

### 3.2 The exec conversation toolkit (build these, rehearse weekly)

1. **Three insight openers.** Example shape: "We are seeing companies your size cut network and security spend 30 to 40 percent by collapsing five vendors into one platform at MPLS renewal time. When does your MPLS contract come up?" Build three of these from real Cato case studies in your segment.
2. **The altitude ladder.** Practice explaining the same Cato concept at three levels: engineer (how), director (operational impact), C-level (money, risk, headcount). Pick one concept a week and write all three versions. This single exercise builds more exec confidence than anything else on this list.
3. **Question bank, not pitch bank.** Execs respect people who ask sharp questions. Build 15 questions like: "When you did your last audit, how many findings traced back to inconsistent policy across locations?" or "If you acquired a company tomorrow, how long until their users are inside your security stack?"
4. **The permission phrase.** When outranked and out of depth, say: "That is exactly the right question and I want my architect to answer it precisely rather than me giving you 80 percent. Can I bring them in Thursday?" Executives read this as strength. Memorize it. The willingness to say "I will bring the expert" is itself executive presence.

### 3.3 Reps: manufacture the conversations you fear

- **Shadow every exec-level call you can.** Ask AEs on your team: "Can I be a silent listener on your next VP+ call? I will send you my prospecting summary of the account as payment." Take notes on questions the exec asked, not what the AE said.
- **Record and review yourself.** If you have Gong/Chorus, review one of your own calls per week. Watch specifically for: talk ratio, filler, whether you asked or pitched. Painful, effective.
- **Roleplay monthly with an SE playing a hostile network architect** and with your manager playing a dismissive CISO. Ask them to be harder on you than reality will be.
- **Volunteer for anything customer-facing:** trade show booth duty, webinar Q&A moderation, user group events. Volume desensitizes.

---

## Part 4: The promotion campaign (SDR to AE)

### 4.1 Understand how the decision actually gets made

An SDR gets promoted to AE when sales leadership believes three things: (1) the SDR consistently overperforms in the current role, (2) the SDR already demonstrates AE skills, and (3) a seat is open or can be justified. You control the first two completely and can influence the third with timing and internal reputation.

### 4.2 The evidence file

Start a document today titled "AE Readiness" and update it every Friday:
- Quota attainment by month, pipeline generated, conversion rates, notable logos sourced
- Deals you sourced that closed, with revenue attached to your name
- AE-level actions: discovery calls you ran end to end, demos you gave, exec meetings you booked AND attended, deal strategy you contributed
- Technical milestones: certifications, demo sign-off from an SE, competitive knowledge checks
- Quotes and kudos: screenshot every piece of praise from AEs, SEs, managers, and prospects

This file becomes the promotion case. When you ask, you will not be requesting a favor, you will be presenting a record.

### 4.3 The sponsorship structure

- **Your manager:** Say the goal out loud in your next 1:1: "I want to be an AE here within 12 months. What would you need to see to pound the table for me?" Write down the answer verbatim. That answer is your real job description now. Revisit it quarterly and ask "what is still missing?"
- **Two AE mentors:** Pick the AE whose style you admire and the AE with the best technical chops. Ask each for a monthly 30 minutes. Bring specific questions, never "any advice?"
- **One SE ally:** The SE who teaches you the platform is also the person who will tell sales leadership "this SDR is technical." SEs' opinions carry unusual weight in promotion conversations at technical companies. Earn it by doing homework before every session.
- **Skip-level visibility:** Once a quarter, find a legitimate reason to be useful to your director or VP: a competitive intel writeup, a territory analysis, a summary of what messaging is landing in your outbound. Attach your name to insight.

### 4.4 Do AE work before you have the title

- Ask your AEs to let you run the first 10 minutes of discovery on meetings you sourced, then the full discovery, then a first demo with the SE present. Escalate scope as you prove out.
- Ask to co-own one or two small deals end to end under an AE's supervision if your org allows it.
- Build one thing that scales you: a vertical-specific outbound play, an MPLS-renewal targeting list, a ZTNA/VPN-replacement campaign. Something leadership can point to and say "that was theirs."

### 4.5 Timing and the ask

- Learn your company's promotion cycles and headcount planning calendar (ask your manager directly).
- Signal intent early (month 1), show evidence continuously, make the formal ask when a seat opens or 2 quarters before you want it, whichever comes first.
- If a seat opens elsewhere internally (different segment, different region), raise your hand. First AE seat beats perfect AE seat.

---

## Part 5: The 12-month calendar

### Months 1 to 3: Foundation
- Declare the goal to your manager, capture their criteria in writing
- Start the AE Readiness evidence file, update every Friday
- Networking fundamentals study, 45 minutes a day, 4 days a week
- Complete all available internal Cato enablement and certifications
- Recruit SE ally, get lab tenant access, weekly 30-minute SE session
- Shadow 2 exec-level calls per month, keep a question log
- Keep crushing SDR quota. Nothing below works if attainment slips. Top 20 percent of the SDR team, minimum, every quarter.

### Months 4 to 6: Credibility
- Security-side curriculum (ZTNA, SSE components, single-pass architecture)
- Give your first supervised demo, get written sign-off from the SE
- Run full discovery calls on your own sourced meetings
- Build and launch your signature outbound play (MPLS renewal or VPN replacement)
- Write your three insight openers and altitude-ladder scripts, rehearse in monthly roleplay
- First skip-level value delivery (competitive writeup or territory analysis)
- Optional: sit Security+ or Network+

### Months 7 to 9: AE in all but title
- Competitive mastery: run a lunch-and-learn for other SDRs on one competitor (teaching it cements it and makes you visible)
- Co-own a small deal or pilot end to end under AE supervision
- Quarterly check with manager: review the criteria list, ask what is missing, close those gaps specifically
- Attend or work one industry event, come back with 5 exec conversations logged

### Months 10 to 12: The ask
- Compile the evidence file into a 2-page promotion case: attainment record, AE-level work performed, technical certifications, sponsor quotes
- Formal ask, timed to headcount planning
- If the answer is "not yet," get the missing criteria in writing with a date, and decide consciously whether the timeline is real or whether an AE seat at a Cato competitor or partner is the faster route. Loyalty is good; a stalled 24-month promotion queue is not.

---

## Part 6: Weekly operating rhythm

| Day | Habit | Time |
|---|---|---|
| Mon to Thu | Technical study block | 45 min |
| Weekly | SE lab session | 30 min |
| Weekly | Review one recording of your own call | 30 min |
| Weekly | Shadow an AE or exec call (min 2 per month) | 30 to 60 min |
| Friday | Update AE Readiness evidence file | 15 min |
| Monthly | AE mentor sessions (x2) and one hostile roleplay | 90 min total |
| Quarterly | Manager criteria review and one skip-level value delivery | |

Total added load: roughly 5 hours a week. That is the price. It compounds fast because almost nobody else pays it.

---

## Part 7: Principles when it gets hard

1. **Attainment is the ticket, everything else is the upgrade.** A technical SDR at 80 percent of quota gets nothing. Protect the number first.
2. **You do not need to out-engineer the SE.** You need to never be the least informed person about Cato in the room, and to know exactly when to bring in the expert.
3. **Confidence is downstream of preparation and reps.** Every scary conversation you survive makes the next one 10 percent smaller.
4. **Make your ambition public and your progress visible.** Quiet grinding gets outworked by visible grinding every time.
5. **Keep score.** If it is not in the evidence file, it did not happen.
