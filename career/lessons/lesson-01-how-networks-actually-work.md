# Lesson 1: How networks actually work (the foundation for everything Cato sells)

Read time: 25 to 30 minutes. Goal: after this lesson you can follow any conversation about "traffic," "routing," "latency," and "tunnels" without nodding along blindly. Every Cato concept in later lessons stands on this one.

---

## 1. The single most important mental model: everything is packets

When a user in your prospect's Chicago office opens Salesforce, their computer does not open a magic pipe to Salesforce. It chops the request into thousands of small chunks called **packets**. Each packet is like an envelope:

- **Outside of the envelope:** the destination address, the return address, and a number so the receiver can reassemble them in order
- **Inside the envelope:** a small piece of the actual data

Each packet travels independently across many networks and gets reassembled at the far end. That is the whole internet. Every product Cato sells is, at its core, a machine for moving, steering, inspecting, or blocking envelopes.

**Why a seller cares:** "Traffic" just means "the flow of packets." When a network engineer says "we backhaul all our traffic to the data center," they mean "every envelope from every office takes a detour through one building before reaching the internet." You can already feel why that is slow.

## 2. IP addresses and DNS: the addressing system

- An **IP address** (like 172.217.4.46) is the street address on the envelope. Every device on a network has one.
- **DNS** is the phone book. Humans type salesforce.com; DNS translates that name into an IP address before any packets get sent.

Two details worth knowing:

- **Private vs public addresses.** Inside a company, devices use private addresses (they usually start with 10.x, 192.168.x, or 172.16-31.x). These do not work on the public internet. A device called a **NAT** (network address translation) at the edge of the office swaps the private return address for the company's public one on the way out, like a mailroom that puts the company's address on all outgoing mail.
- **DNS is a security control point.** If you control the phone book, you can refuse to look up malicious sites. Lots of security products (including parts of Cato's) hook in right there.

**Why a seller cares:** When someone says "we need visibility into our traffic," part of what they mean is "we want to see which names and addresses our users are talking to." DNS logs are often the first place a security team looks.

## 3. Ports and protocols: what kind of conversation is in the envelope

An IP address gets the envelope to the right building. The **port number** gets it to the right department. Port 443 is HTTPS (secure web, most of everything now), port 80 is old unencrypted web, port 53 is DNS, port 3389 is remote desktop.

Two delivery styles:

- **TCP:** reliable, ordered delivery. The receiver confirms every batch of packets and the sender re-sends anything lost. Used for web, email, file transfer. Reliability costs a bit of speed.
- **UDP:** fire and forget. No confirmations, no re-sending. Used for voice and video calls, where a lost packet is better skipped than re-sent late. This is why bad networks make calls robotic: lost UDP packets are just gone.

**Why a seller cares:** Voice and video quality is a classic pain point you can prospect on. Old firewalls also made decisions mostly by port number. Modern platforms like Cato identify the actual application inside the traffic, which matters because today almost everything hides inside port 443.

## 4. Routing: how envelopes find their way

Between the sender and receiver sit many **routers**. Each router looks at the destination address and forwards the packet to the next best hop. No single device knows the whole path; each hop just knows the next step, like asking directions city by city.

Key consequences:

- **The internet does not promise a good path, only a path.** Public internet routing optimizes for reachability and business relationships between carriers, not speed. Your packets from Chicago to Singapore might take an ugly path with congestion in the middle.
- **Latency** is the time an envelope takes to arrive, measured in milliseconds. It is governed mostly by distance and the number of hops, not bandwidth. This distinction matters constantly:
  - **Bandwidth** = how many lanes the highway has
  - **Latency** = how far away the destination is
  - Buying more bandwidth does not fix latency. A wider highway to a distant city is still a long drive.

**Why a seller cares:** This is the setup for Cato's private backbone story. Cato runs its own optimized global network of PoPs (points of presence). Instead of trusting the random public internet path from Chicago to Singapore, your traffic hops onto Cato's backbone at the nearest PoP and rides a managed, monitored route. That is a latency and consistency story, and it is one of Cato's most concrete differentiators. You now understand exactly why it works.

## 5. Encryption and tunnels: envelopes inside locked envelopes

- **Encryption** scrambles the contents so only the intended receiver can read them. HTTPS (the padlock in the browser) encrypts web traffic between the user and the website.
- A **tunnel** is a different trick: you take an entire packet, encrypt the whole thing (addresses and all), and stuff it inside a new packet addressed to a tunnel endpoint. The outside world sees only locked envelopes travelling between two points. At the far end, the outer envelope is removed and the original packet continues on its way.

Tunnels are how you build a private network over the public internet:

- **Site-to-site tunnel:** the Chicago office and the London office each have a device that tunnels all inter-office traffic. The offices behave as one private network even though the packets cross the public internet. The classic protocol for this is **IPsec**.
- **Remote-access VPN:** the same idea for one laptop. The employee's laptop builds a tunnel to a company VPN concentrator, and from then on the laptop acts like it is sitting in the office.

**Why a seller cares:** Cato's edge devices (Sockets) build tunnels from every site and every user to the nearest Cato PoP. That is the plumbing of the whole platform. And the weaknesses of the legacy remote-access VPN (once you are in, you can reach everything; concentrators get overloaded; appliances need patching and have had brutal vulnerabilities) set up the ZTNA story in a later lesson.

## 6. The legacy enterprise network: castle and moat

Now assemble the pieces into the world Cato disrupts. The classic enterprise design, roughly 1995 to 2015:

1. **Headquarters and a data center** hold the applications and the security stack: firewall, web proxy, VPN concentrator, intrusion prevention.
2. **Branch offices** connect to the data center over **MPLS**: private, carrier-managed lines. MPLS is reliable and predictable, and extremely expensive per megabit, often 10 to 50 times the cost of ordinary broadband. New sites take weeks or months to provision.
3. **All traffic backhauls.** A branch user opening a cloud app sends packets over MPLS to the data center, through the security stack, out to the internet, and the response takes the same detour back. This made sense when the apps lived in the data center. It makes no sense when the apps live in the cloud.
4. **Remote users** VPN into the same data center, adding load and the same detour.

Then three things broke it: apps moved to the cloud (Salesforce, 365, AWS), users went remote, and companies went global. Result: the expensive private network carries traffic that no longer needs to go where it goes, security appliances multiply at every site, and the team drowns in boxes, contracts, and inconsistent policies.

**Why a seller cares:** This broken picture is your discovery map. Nearly every question worth asking a prospect probes one of these pain points: What is your MPLS spend and when does the contract renew? How many appliances per site and when is the refresh? How do remote users get secured? How long does it take you to open a new site? You are not asking trivia; you are pressing on the exact places the old model bleeds money and risk.

## 7. Vocabulary check

You should now be able to define, in one plain sentence each: packet, IP address, DNS, NAT, port, TCP vs UDP, router, latency vs bandwidth, encryption, tunnel, IPsec, VPN, MPLS, backhaul, PoP.

If any of these still feels fuzzy, that is the one to ask your SE about this week. Asking "can you sanity-check my understanding of NAT" makes you look serious, not junior.

## 8. Self-test (answer out loud, no notes)

1. Explain to a CFO why buying more bandwidth will not fix their Singapore office's complaint that apps feel slow.
2. A prospect says "we backhaul everything through our Dallas data center." Describe what their users experience when they open Microsoft 365, and why.
3. What is the difference between HTTPS encryption and a tunnel?
4. Why do voice calls sound robotic on a bad network while web pages just load slowly?
5. Give two reasons a company would want to get rid of MPLS and one reason they might hesitate.
6. In one sentence: why does Cato running its own backbone of PoPs make apps faster than the public internet?

## Next lesson

Lesson 2: SD-WAN, what it actually does, why it was the first crack in the MPLS world, and where it falls short alone (which is the door SASE walks through).
