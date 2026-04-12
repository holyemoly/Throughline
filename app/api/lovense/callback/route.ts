import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  console.log('Lovense callback received:', body)
  return NextResponse.json({ result: true, message: 'success' })
}
