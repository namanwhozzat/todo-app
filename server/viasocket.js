import { ViaSocket } from 'viasocket-apps'

for (const name of ['VIASOCKET_ORG_ID', 'VIASOCKET_PROJECT_ID', 'VIASOCKET_EMBED_SECRET']) {
  if (!process.env[name]) {
    console.error(`Missing ${name} in .env`)
    process.exit(1)
  }
}

export const viasocket = new ViaSocket({
  orgId: process.env.VIASOCKET_ORG_ID,
  projectId: process.env.VIASOCKET_PROJECT_ID,
  secret: process.env.VIASOCKET_EMBED_SECRET,
})
