import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { intensity, duration } = await req.json()

  const response = await fetch('https://api.lovense-api.com/api/lan/v2/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: process.env.LOVENSE_DEV_TOKEN,
      uid: 'emily',
      command: 'Function',
      action: `Vibrate:${intensity}`,
      timeSec: duration,
      apiVer: 1
    })
  })

  const data = await response.json()
  return NextResponse.json(data)
}
