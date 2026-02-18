import { ServiceProviderAuthPanel } from './components/auth/ServiceProviderAuthPanel'
import { ServiceProviderTopBar } from './components/auth/ServiceProviderTopBar'
import { ClientFormPreviewPanel } from './components/quotation/ClientFormPreviewPanel'
import { DocumentsPanel } from './components/quotation/DocumentsPanel'
import { QuotesHistoryPanel } from './components/quotation/QuotesHistoryPanel'
import { TrainingPanel } from './components/quotation/TrainingPanel'
import { HeroSection } from './components/sections/HeroSection'
import { StepsSection } from './components/sections/StepsSection'
import { useClientFormPreview } from './hooks/useClientFormPreview'
import { useQuotationMvp } from './hooks/useQuotationMvp'
import { useServiceProviderAuth } from './hooks/useServiceProviderAuth'
import './App.css'

function App() {
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
    isTraining,
    isUploading,
    canTrain,
    modelReady,
    showTrainingPanel,
    quoteHistory,
    isLoadingQuotes,
    errorMessage,
    addDocuments,
    removeDocument,
    startTraining,
  } = useQuotationMvp(idToken)
  const formPreview = useClientFormPreview(idToken, modelReady)

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
              isUploading={isUploading}
              onFilesSelected={addDocuments}
              onRemoveDocument={removeDocument}
            />
            <div className="model-column">
              {showTrainingPanel ? (
                <TrainingPanel
                  status={trainingStatus}
                  progress={trainingProgress}
                  isTraining={isTraining}
                  canTrain={canTrain}
                  onStartTraining={startTraining}
                />
              ) : null}
              <ClientFormPreviewPanel
                schema={formPreview.schema}
                isLoading={formPreview.isLoading}
              />
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
          {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
        </>
      )}
    </main>
  )
}

export default App
