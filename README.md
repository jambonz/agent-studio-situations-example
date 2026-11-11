# Situations: an example agent and its server

An example of Agent Studio [situations](https://docs.jambonz.org/agent-studio/situations/overview): a collections
agent you can import into Studio, and the customer's server its tools call.

The agent has three situations:

| Situation          | Who can start it      | What it does                                                                                                                 |
| ------------------ | --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `negotiation`      | **Only your server**  | Started by `verify_identity` on a match. Adds the plan rules and the `record_agreement` tool. Resolved by `record_agreement` |
| `hardship`         | **The agent decides** | Started by the model when the caller can't afford the plans, but **only once `negotiation` has started**. Ends with it       |
| `callback_request` | **The agent decides** | Started by the model at any time when the caller asks to be called back; resolved by the model once a time is confirmed      |

And the server has two HTTP tools:

| Tool               | What it does                                             | Situation change                |
| ------------------ | -------------------------------------------------------- | ------------------------------- |
| `verify_identity`  | Checks the last 4 digits of the account and the ZIP code | Starts `negotiation` on a match |
| `record_agreement` | Records the payment plan the caller agreed               | Resolves `negotiation`          |

`negotiation` is the hard guarantee: the model can't see it or start it, so the agent can't discuss the debt or record
an agreement until your server has verified the caller. `hardship` shows the softer kind, which the model judges for
itself, held back until the caller is verified.

A tool starts or resolves a situation by adding `actions` to its JSON result:

```json
{ "verified": true, "customer_name": "Jordan Lee", "actions": { "situation": "negotiation" } }
{ "recorded": true, "reference": "AGR-1234", "actions": { "resolve_situation": "negotiation" } }
```

Studio applies the change and removes `actions` from what the model sees.

## Run it

```bash
git clone https://github.com/jambonz/agent-studio-situations-example.git
cd agent-studio-situations-example
npm install
npm run dev     # build and start on port 3100 (PORT to change)
npm test        # signature check and both tools, end to end
```

Studio has to reach the server over public HTTPS. For a test, put a tunnel in front of it:

```bash
ngrok http 3100
```

The test account is last 4 digits `4321`, ZIP `02139`.

## Checking that requests come from Studio

Studio signs every tool request with HMAC-SHA256 in the `X-Studio-Signature` header:

```
X-Studio-Signature: t=<unix seconds>,v1=<hex>
v1 = HMAC-SHA256(signing secret, t + "." + METHOD + "." + path_with_query + "." + raw_body)
```

Each tool has its own signing secret, shown once when you create the tool in Studio (rotate it to see a new one).
Give each one to the server in its own variable:

```bash
export STUDIO_SIGNING_SECRET_VERIFY_IDENTITY=...
export STUDIO_SIGNING_SECRET_RECORD_AGREEMENT=...
```

A tool with a secret set rejects any request without a valid signature (401), or one whose timestamp is more than
300 seconds from now. A tool without one accepts every request, and the server warns about it at startup. That is
fine for a first try, not for anything real: anyone who finds the URL could start the `negotiation` situation.

## How it's laid out

| File                            | What it is                                                                  |
| ------------------------------- | --------------------------------------------------------------------------- |
| `src/situations.ts`             | `startSituation()` and `resolveSituation()`: the `actions` a result carries |
| `src/tools/verify-identity.ts`  | Checks the caller; starts `negotiation` on a match                          |
| `src/tools/record-agreement.ts` | Records the plan; resolves `negotiation`                                    |
| `src/tools/index.ts`            | Tool name to handler. Each is served at `POST /<name>`                      |
| `src/accounts.ts`               | Stand-in for your own systems                                               |
| `src/signature.ts`              | The `X-Studio-Signature` check                                              |
| `src/config.ts`                 | Port and per-tool signing secrets, from the environment                     |
| `src/app.ts`                    | The HTTP handler: route, read the raw body, verify, run the tool            |
| `src/index.ts`                  | Starts the server                                                           |

To add a tool: write a handler in `src/tools/`, add it to `TOOLS`, and point a Studio HTTP tool at
`POST https://<your server>/<tool name>`.

## Import the agent into Studio

[`agent/acme-collections.studio-agent.json`](agent/acme-collections.studio-agent.json) is the whole agent: prompt,
greeting, both tools and the three situations.

1. In Studio, **Agents**, then **Import**, and choose the file. Studio picks your own credentials for Deepgram
   (speech-to-text and voice) and OpenAI (gpt-4.1-mini), or asks you to choose them. Any other vendors work too.
2. **Tools**: change the URL of `verify_identity` and `record_agreement` from `https://your-server.example.com` to
   your server or tunnel.
3. Copy each tool's signing secret into the server's environment (see above). The import doesn't carry secrets:
   **Rotate secret…** on each tool shows a new one.
4. **Test call**.

To build it by hand instead, the file has every setting, and
[Starting situations from your server](https://docs.jambonz.org/agent-studio/situations/server-control) walks
through the same agent.

## What to look for on a test call

Each change shows on the call's timeline, and on the turn it happened in.

1. **Before verification.** Ask for a cheaper plan. The agent asks you to verify first. `record_agreement` isn't
   offered to the model, and `hardship` isn't offered in `enter_situation`.
2. **A wrong ZIP code** (`90210`) gets `verified: false`, and nothing starts.
3. **Verify** with `4321` and `02139`: **Started negotiation · by tool verify_identity**, and the agent offers to settle
   in full.
4. **Say you lost your job and can't afford that**: **Started hardship · by the agent**, and the agent offers the
   smallest plan.
5. **Accept the plan**: **Resolved negotiation · by tool record_agreement**, then **Resolved hardship**, with
   "negotiation ended". The agent reads the plan and its reference back before the change reaches it.
6. **Ask to be called back tomorrow** (at any point): **Started callback_request · by the agent**, then **Resolved
   callback_request** once you confirm a time.

## License

MIT
