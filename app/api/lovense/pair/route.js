import { NextResponse } from 'next/server'

export async function GET() {
  const response = await fetch('https://api.lovense.com/api/lan/getQrCode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: process.env.LOVENSE_DEV_TOKEN,
      uid: 'emily',
      uname: 'emily',
      utoken: 'emily-verification-token',
      v: 2
    })
  })
  const data = await response.json()
  return NextResponse.json(data)
}
