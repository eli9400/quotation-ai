import type { DecodedIdToken } from 'firebase-admin/auth'
import type { NextFunction, Request, Response } from 'express'
import { getFirebaseAuth } from '../config/firebase.js'

export type AuthenticatedRequest = Request & {
  authUser: DecodedIdToken
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({
      ok: false,
      message: 'Missing Authorization header. Expected: Bearer <idToken>.',
    })
    return
  }

  const idToken = header.slice('Bearer '.length).trim()
  if (!idToken) {
    res.status(401).json({
      ok: false,
      message: 'Firebase ID token is empty.',
    })
    return
  }

  try {
    const decodedToken = await getFirebaseAuth().verifyIdToken(idToken)
    ;(req as AuthenticatedRequest).authUser = decodedToken
    next()
  } catch {
    res.status(401).json({
      ok: false,
      message: 'Invalid or expired Firebase ID token.',
    })
  }
}
