import { DocumentsPanel } from './components/quotation/DocumentsPanel'
import { QuoteRequestPanel } from './components/quotation/QuoteRequestPanel'
import { QuoteResultPanel } from './components/quotation/QuoteResultPanel'
import { TrainingPanel } from './components/quotation/TrainingPanel'
import { HeroSection } from './components/sections/HeroSection'
import { StepsSection } from './components/sections/StepsSection'
import { useQuotationMvp } from './hooks/useQuotationMvp'
import './App.css'

function App() {
  const {
    documents,
    trainingProgress,
    trainingStatus,
    isTraining,
    isUploading,
    isGeneratingQuote,
    canTrain,
    modelReady,
    form,
    quote,
    quoteSource,
    errorMessage,
    addDocuments,
    removeDocument,
    startTraining,
    updateFormField,
    createQuoteFromForm,
  } = useQuotationMvp()

  return (
    <main className="app" dir="rtl">
      <HeroSection />
      <StepsSection />

      <section className="content-grid">
        <DocumentsPanel
          documents={documents}
          isUploading={isUploading}
          onFilesSelected={addDocuments}
          onRemoveDocument={removeDocument}
        />
        <TrainingPanel
          status={trainingStatus}
          progress={trainingProgress}
          isTraining={isTraining}
          canTrain={canTrain}
          onStartTraining={startTraining}
        />
        <QuoteRequestPanel
          form={form}
          disabled={!modelReady}
          isSubmitting={isGeneratingQuote}
          onFieldChange={updateFormField}
          onSubmit={createQuoteFromForm}
        />
        <QuoteResultPanel
          quote={quote}
          quoteSource={quoteSource}
          clientName={form.clientName}
        />
      </section>

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
    </main>
  )
}

export default App
