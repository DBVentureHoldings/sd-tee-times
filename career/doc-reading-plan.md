# How to work through Cato's documentation as a seller

Cato's knowledge base is written for people who configure the product. You are not one of them. Read it the way an AE reads it: to build understanding you can translate for a buyer, not to become an implementer.

---

## The protocol (use this on every page)

1. **Write your question first.** One sentence, before you open the page. "How does a remote user reach a private app without a VPN?" Read until you can answer it, then stop.
2. **Skim the config steps. Read the overview, prerequisites, and limitations.** The limitations section is the most valuable and least read part of any doc. It tells you what the product cannot do, which is exactly what competitors attack and what blindsides sellers in technical evaluations.
3. **Run the altitude ladder.** Write three versions of what you learned:
   - **Engineer:** how it works
   - **Director:** what it changes operationally
   - **Executive:** what it saves in money, risk, or headcount
   If you cannot write all three, you learned a term, not a concept.
4. **Log it.** Three columns: what it says / what it means / what a customer would ask.

Twenty minutes a page, three or four pages a week. Slower than it sounds, and far better than binge-reading forty pages you cannot recall.

---

## Priority order

### Tier 1: comes up in nearly every deal (weeks 1 to 3)

- **Zero trust access to private applications (ZTNA).** The most sellable use case. Replaces the legacy VPN. Learn how a user is authenticated, how access is scoped to an application rather than the whole network, and what the user experience is.
- **Site connectivity: Socket, vSocket, IPsec.** The three ways a location or cloud environment joins the network, and when each is used.
- **Security stack overview.** Firewall (internet and WAN), IPS, anti-malware, web filtering. You need what each one does and the pain it removes, not the rule syntax.
- **Cloud connectivity (Azure, AWS).** Already covered in Lesson 2b. Use the docs to confirm and add specifics.

### Tier 2: what makes you useful on technical calls and demos (weeks 4 to 6)

- **The management application.** Navigation, where policies live, where analytics live. This is the doc set to read with a lab tenant open, not on its own.
- **Identity integration.** Entra ID / Active Directory, SSO and SAML. How user and group identity becomes policy. This is what makes zero trust actually zero trust.
- **Network rules, QoS, bandwidth management.** How traffic gets prioritized and steered.
- **Monitoring, events, and analytics.** What a customer can actually see. Visibility is a major buying reason and a major demo moment.

### Tier 3: depth and edges (ongoing)

- **Limitations and prerequisites of everything in Tier 1 and 2.** Go back and read only these sections. An afternoon here is worth more than a week of feature reading.
- **Release notes, weekly.** Deeply underrated. They tell you what shipped recently, which is competitive ammunition, evidence of platform velocity, and legitimate reason to reach back out to a prospect.
- **API and automation, lightly.** You need to know it exists and roughly what it enables. Nothing more.

---

## What docs will not give you

Positioning, competitive framing, pricing posture, and what is approved to share with a customer. That comes from enablement, your SE, and win/loss notes in the CRM. Docs build understanding. They do not build pitches, and quoting them at a prospect is a good way to sound like a manual.

## The weekly loop

- 3 to 4 pages, protocol above
- 1 altitude-ladder writeup you could actually say out loud
- Bring the single fuzziest thing to your SE session as a sanity-check question
