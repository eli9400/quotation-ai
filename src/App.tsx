import { useState } from 'react'
import { ServiceProviderAuthPanel } from './components/auth/ServiceProviderAuthPanel'
import { ServiceProviderTopBar } from './components/auth/ServiceProviderTopBar'
import { ClientFormItemsEditorPanel } from './components/quotation/ClientFormItemsEditorPanel'
import { ClientFormPreviewPanel } from './components/quotation/ClientFormPreviewPanel'
import { DocumentsPanel } from './components/quotation/DocumentsPanel'
import { QuotesHistoryPanel } from './components/quotation/QuotesHistoryPanel'
import { TrainingPanel } from './components/quotation/TrainingPanel'
import { HeroSection } from './components/sections/HeroSection'
import { StepsSection } from './components/sections/StepsSection'
import { ToastMessage } from './components/ui/ToastMessage'
import { useClientFormPreview } from './hooks/useClientFormPreview'
import { useQuotationMvp } from './hooks/useQuotationMvp'
import { useServiceProviderAuth } from './hooks/useServiceProviderAuth'
import './App.css'

function App() {
  const [formPreviewRefreshTick, setFormPreviewRefreshTick] = useState(0)
  const {
    isLoading: isAuthLoading,
    isSigningIn,
    isSigningUp,
    isSigningOut,
    isAuthenticated,
    serviceProvider,
    idToken,
    errorMessage: authError,
    signIn,
    signUp,
    logout,
  } = useServiceProviderAuth()

  const {
    documents,
    trainingProgress,
    trainingStatus,
    trainingStages,
    isTraining,
    isUploading,
    isValidatingDocuments,
    canTrain,
    modelReady,
    showTrainingPanel,
    quoteHistory,
    isLoadingQuotes,
    errorMessage,
    documentValidationById,
    addDocuments,
    removeDocument,
    clearDocuments,
    startTraining,
  } = useQuotationMvp(idToken)
  const formPreview = useClientFormPreview(idToken, `${modelReady}-${formPreviewRefreshTick}`)

  if (isAuthLoading) {
    return (
      <main className="app" dir="rtl">
        <HeroSection />
        <p className="status-banner">טוען פרטי התחברות...</p>
      </main>
    )
  }

  return (
    <main className="app" dir="rtl">
      <HeroSection />

      {!isAuthenticated || !serviceProvider ? (
        <>
          <ServiceProviderAuthPanel
            isSigningIn={isSigningIn}
            isSigningUp={isSigningUp}
            onSignIn={signIn}
            onSignUp={signUp}
          />
          {authError ? <p className="error-banner">{authError}</p> : null}
        </>
      ) : (
        <>
          <ServiceProviderTopBar
            serviceProvider={serviceProvider}
            isSigningOut={isSigningOut}
            onSignOut={logout}
          />
          <StepsSection />

          <section className="content-grid">
            <DocumentsPanel
              documents={documents}
              documentValidationById={documentValidationById}
              isUploading={isUploading}
              isValidatingDocuments={isValidatingDocuments}
              onFilesSelected={addDocuments}
              onRemoveDocument={removeDocument}
              onClearDocuments={clearDocuments}
            />
            <div className="model-column">
              {showTrainingPanel ? (
                <TrainingPanel
                  status={trainingStatus}
                  progress={trainingProgress}
                  stages={trainingStages}
                  isTraining={isTraining}
                  isUploading={isUploading}
                  isValidatingDocuments={isValidatingDocuments}
                  canTrain={canTrain}
                  onStartTraining={startTraining}
                />
              ) : null}
              <ClientFormPreviewPanel
                schema={formPreview.schema}
                isLoading={formPreview.isLoading}
              />
              {isTraining ? null : (
                <ClientFormItemsEditorPanel
                  authToken={idToken}
                  onSaved={() => setFormPreviewRefreshTick((current) => current + 1)}
                />
              )}
            </div>
          </section>

          <section className="single-panel-grid">
            <QuotesHistoryPanel
              authToken={idToken}
              records={quoteHistory}
              isLoading={isLoadingQuotes}
            />
          </section>

          {formPreview.errorMessage ? <p className="error-banner">{formPreview.errorMessage}</p> : null}
          <ToastMessage message={errorMessage} tone="error" />
        </>
      )}
    </main>
  )
}

export default App
