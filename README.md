# Situations: a customer's server

An example of the server side of Agent Studio situations. Two HTTP tools for a collections agent:

| Tool               | What it does                                             | Situation change                |
| ------------------ | -------------------------------------------------------- | ------------------------------- |
| `verify_identity`  | Checks the last 4 digits of the account and the ZIP code | Starts `negotiation` on a match |
| `record_agreement` | Records the payment plan the caller agreed               | Resolves `negotiation`          |

`negotiation` is an **Only your server** situation. The model can't see it or start it, so the agent can't discuss the
debt or record an agreement until your server has verified the caller. This is the one hard guarantee situations give.

A tool starts or resolves a situation by adding `actions` to its JSON result:

```json
{ "verified": true, "customer_name": "Jordan Lee", "actions": { "situation": "negotiation" } }
{ "recorded": true, "reference": "AGR-1234", "actions": { "resolve_situation": "negotiation" } }
```

Studio applies the change before the model sees the result, and removes `actions` from what the model sees.

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

## Logging

The server logs one line per tool call at `info`: the tool, whether it succeeded, and any situation change. Caller
details stay out of it. To see every request and response in full while troubleshooting, set `LOG_LEVEL=debug`:

```bash
LOG_LEVEL=debug npm run dev
```

That logs each request's method, path, `X-Studio-Signature` and raw body as `received`, and each response's status and
body as `sent`. Those bodies hold what the caller said, such as account digits and ZIP codes, so keep debug logging to
test calls.

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

## Set up the agent in Studio

1. **Tools: add `verify_identity`.** HTTP, `POST https://<your tunnel>/verify_identity`, sent as JSON.
   - Description: "Verify the caller before discussing their account. Ask for the last 4 digits of their account
     number and their ZIP code."
   - Parameters: `account_last4` (string), `zip` (string), both required.
2. **Tools: add `record_agreement`.** HTTP, `POST https://<your tunnel>/record_agreement`, sent as JSON.
   - Description: "Record the payment plan the caller agreed to, before confirming it aloud."
   - Parameters: `plan` (string: `full`, `3_payments` or `6_payments`), `monthly_amount` (number), `plan` required.
3. **Situations: add `negotiation`.**
   - Who can start it: **Only your server**.
   - Instructions: "The caller is verified. Their balance and minimum monthly payment are in the verify_identity result.
     Offer to settle in full first. If they can't, offer 3 payments, then 6. Never go below the minimum monthly payment.
     Record any agreement with record_agreement before confirming it aloud."
   - Tools offered only while active: `record_agreement`.
4. **Prompt.** Tell the agent it calls about an overdue account, and must verify the caller with `verify_identity`
   before discussing anything about it.

## What to look for on a test call

- Before verification, `record_agreement` isn't offered to the model. If it calls it anyway, the gateway refuses it.
- After a correct verification the timeline shows **Started negotiation · by tool verify_identity**, and the agent
  starts talking about the balance and plans.
- A wrong ZIP code gets `verified: false` and nothing starts.
- After an agreement, **Resolved negotiation · by tool record_agreement**.

## License

MIT
