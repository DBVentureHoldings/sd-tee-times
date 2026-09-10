# Lesson 2b: Inside the PoP, and into the VNet

A deep dive prompted by a real customer question: "how would we connect to our Azure tenant?" This follows one packet from a user's laptop all the way to a specific server inside Azure, and back.

---

## 1. What a VNet actually is

When a company runs servers in Azure, those servers still need a network to sit on. Azure gives them a **VNet** (virtual network): a private IP address range they choose, for example `10.50.0.0/16`. Inside it they carve **subnets**, smaller slices that group things by role:

- `10.50.0.0/24` for infrastructure
- `10.50.1.0/24` for application servers
- `10.50.2.0/24` for databases

It behaves exactly like the LAN in an office, except it is software-defined and it lives in Microsoft's data center. Nothing inside a VNet is reachable from the internet unless somebody deliberately exposes it. That is the whole point, and it is also why connecting to it takes deliberate work.

**Tenant vs subscription vs VNet.** Loosely: the **tenant** is the company's whole identity and directory footprint in Microsoft's cloud, **subscriptions** are billing and management containers under it, and **VNets** live inside subscriptions. When a customer says "our Azure tenant" they usually mean "our Azure environment" in general. You do not need to correct them.

## 2. What happens inside the PoP

The packet arrives at the PoP inside a tunnel. Three things happen:

**Decrypt.** The outer envelope is stripped off, exposing the original packet (see Lesson 1 on tunnels).

**Single pass.** This is Cato's core architectural claim, and it is worth being precise about. The packet is parsed **once**, and from that one parse every security engine evaluates it: who the user is (via the identity integration, Entra ID in a Microsoft shop), what application this is, then firewall, IPS, anti-malware, web filtering, CASB, DLP. Contrast this with **service chaining**, the legacy and competitor approach, where traffic gets handed appliance to appliance, each one decrypting, parsing, inspecting, re-encrypting, and passing along. Every hop adds latency and another thing to manage. Single pass is why Cato can add security engines without the customer paying for it in performance.

**Route lookup.** The PoP knows every site on that customer's account and which IP ranges live behind each one. The customer registered `10.50.0.0/16` as belonging to their Azure site. So when the destination is `10.50.2.15`, the PoP knows exactly where that lives, and sends it across the backbone to the PoP nearest the Azure region, which tunnels it into the VNet.

That routing table is the quiet thing that makes the whole platform work. Every site, every cloud environment, and every user is an entry in one global routing view.

## 3. How the packet actually enters the VNet

Three options, in order of how often they come up:

**vSocket.** A virtual machine deployed from the Azure marketplace into the customer's VNet, usually in its own small subnet. It is the same software as the physical Socket in a branch. It builds tunnels out to the nearest PoPs (two, for redundancy), and when traffic comes down the tunnel it unwraps it and forwards it onto the VNet as ordinary Azure traffic. Full feature set, full visibility, application-aware. This is the default answer.

**IPsec tunnel from Azure VPN Gateway.** Azure's own managed VPN service can build a standard IPsec tunnel to a Cato PoP. Nothing to deploy from Cato at all. Simpler to stand up, but fewer capabilities and Azure charges for the gateway with its own throughput tiers.

**Private cloud interconnect.** A dedicated private connection between Cato's PoP and Azure's edge, in the same family as Azure ExpressRoute. Highest throughput and most predictable, most cost and lead time. Reserved for heavy or latency-critical workloads.

## 4. The return path, and the mistake everyone makes

This is the detail that will make you sound like you have actually seen a deployment.

Getting traffic **in** is only half of it. The server at `10.50.2.15` now has to reply. By default, Azure sends anything not local out through its own default internet path. If that happens, the request came in through Cato and the response goes out somewhere else. The two halves of the conversation disagree about the path, and the connection breaks. This is called **asymmetric routing**, and it is the classic failure in every cloud connectivity project regardless of vendor.

The fix is a **route table**, which Azure calls a User Defined Route (UDR). You tell Azure: traffic destined for the company's other networks should use the vSocket as its next hop. Now the reply goes back the way it came.

The other easy miss: Azure blocks a VM from forwarding traffic that is not addressed to itself, so **IP forwarding** has to be enabled on the vSocket's network interface. Two settings, and skipping either produces a deployment that looks correct and does not work.

You do not need to be able to configure this. You need to be able to say "the piece teams usually miss is the return route" and watch a network engineer decide you are worth talking to.

## 5. Hub and spoke

Real enterprises rarely have one VNet. The common pattern is a **hub** VNet peered to many **spoke** VNets, with shared services in the hub. Put the vSocket in the hub, and every peered spoke reaches Cato through it. One deployment covers the whole Azure estate, which is a strong answer to "we have fourteen VNets, do we need fourteen of these?"

## 6. Why this beats the alternatives

Without something like Cato, the usual options are:

- **Backhaul to the data center, then ExpressRoute to Azure.** The Lesson 1 detour, now with a cloud circuit on the end of it.
- **A mesh of point-to-point VPN tunnels** between every site and Azure. Works at three sites, collapses at thirty.
- **Expose the app to the internet** and protect it with cloud-native tools. Now security policy lives in a second place with different rules.

With Cato, the Azure workload is not a special case. It is a site on the same network, under the same policy, reached over the same backbone as every office and every laptop. One place to write the rule, one place to see the traffic. And remote users reach it through ZTNA with no VPN concentrator anywhere in the path.

If the customer is multicloud, this gets stronger: connect Azure and AWS both, and the backbone becomes the interconnect between them, which is otherwise an expensive and annoying problem.

## 7. Self-test

1. What is a VNet, in one sentence, to a non-technical buyer?
2. Explain single pass versus service chaining, and why a customer should care.
3. How does a PoP know that `10.50.2.15` lives in the customer's Azure environment?
4. What is asymmetric routing, and what is the fix in Azure?
5. A customer says "we have fourteen VNets." What do you say?
6. Name the three ways to connect Azure to Cato and one tradeoff of each.
