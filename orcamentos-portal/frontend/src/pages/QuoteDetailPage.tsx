import { useNavigate, useParams } from 'react-router-dom'
import QuoteBuilderPage from './QuoteBuilderPage'

export default function QuoteDetailPage() {
  const navigate = useNavigate()
  const { requestId, quoteId } = useParams<{ requestId: string; quoteId: string }>()

  if (!requestId || !quoteId) {
    navigate('/requests', { replace: true })
    return null
  }

  return (
    <QuoteBuilderPage
      requestId={requestId}
      quoteId={quoteId}
      onBack={() => navigate(`/requests/${requestId}`)}
    />
  )
}
