import { FirebaseError } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { useEffect, useMemo, useState } from 'react'
import { firebaseAuth } from '../config/firebaseClient'
import {
  fetchServiceProviderMe,
  updateServiceProviderIndustry,
} from '../services/api/serviceProvidersApi'
import type { ServiceProviderIndustry, ServiceProviderProfile } from '../types/serviceProvider'

function getAuthErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return 'האימייל כבר רשום במערכת.'
      case 'auth/invalid-email':
        return 'כתובת האימייל לא תקינה.'
      case 'auth/weak-password':
        return 'הסיסמה חלשה מדי (לפחות 6 תווים).'
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'אימייל או סיסמה שגויים.'
      default:
        break
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return 'אירעה שגיאת אימות בלתי צפויה.'
}

export function useServiceProviderAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [idToken, setIdToken] = useState<string | null>(null)
  const [serviceProvider, setServiceProvider] = useState<ServiceProviderProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isSigningUp, setIsSigningUp] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(firebaseAuth, async (nextUser) => {
      setUser(nextUser)
      setErrorMessage(null)

      if (!nextUser) {
        setIdToken(null)
        setServiceProvider(null)
        setIsLoading(false)
        return
      }

      try {
        const token = await nextUser.getIdToken()
        const profile = await fetchServiceProviderMe(token)
        setIdToken(token)
        setServiceProvider(profile)
      } catch (error) {
        setIdToken(null)
        setServiceProvider(null)
        setErrorMessage(getAuthErrorMessage(error))
      } finally {
        setIsLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    setErrorMessage(null)
    setIsSigningIn(true)
    try {
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password)
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error))
    } finally {
      setIsSigningIn(false)
    }
  }

  const signUp = async (
    displayName: string,
    email: string,
    password: string,
    industry: ServiceProviderIndustry,
  ) => {
    setErrorMessage(null)
    setIsSigningUp(true)
    try {
      const credential = await createUserWithEmailAndPassword(
        firebaseAuth,
        email.trim(),
        password,
      )

      if (displayName.trim().length > 0) {
        await updateProfile(credential.user, { displayName: displayName.trim() })
      }

      const token = await credential.user.getIdToken(true)
      await updateServiceProviderIndustry(token, industry)
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error))
    } finally {
      setIsSigningUp(false)
    }
  }

  const logout = async () => {
    setErrorMessage(null)
    setIsSigningOut(true)
    try {
      await signOut(firebaseAuth)
      setIdToken(null)
      setServiceProvider(null)
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error))
    } finally {
      setIsSigningOut(false)
    }
  }

  const isAuthenticated = useMemo(
    () => Boolean(user && idToken && serviceProvider),
    [idToken, serviceProvider, user],
  )

  return {
    isLoading,
    isSigningIn,
    isSigningUp,
    isSigningOut,
    isAuthenticated,
    errorMessage,
    idToken,
    serviceProvider,
    signIn,
    signUp,
    logout,
  }
}
