import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, FormField, PageLoader, Spinner } from '../components/ui'
import {
  useCreateProposalPending,
  useCreatePresalesReview,
  useGenerateProposal,
  useProposalPendings,
  useProposalRequest,
  useProposalAnswerVersions,
  useProposalAnswers,
  useProposalWizardSections,
  useProposalWizardSummary,
  useProposalWizardTemplate,
  useRecalculateProposalComposition,
  useRecalculateProposalPricing,
  useResolveProposalPending,
  useSaveProposalAnswers,
  useSubmitProposalRequest,
} from '../hooks/queries'
import { extractApiError } from '../lib/api'
import { useRole } from '../store/auth.store'

function isCommercial(role?: string) {
  return role === 'COMMERCIAL' || role === 'COMMERCIAL_MANAGER' || role === 'ADMIN' || role === 'SUPER_ADMIN'
}

function isPresales(role?: string) {
  return role === 'PRESALES' || role === 'PRESALES_MANAGER' || role === 'ADMIN' || role === 'SUPER_ADMIN'
}

type WizardField = {
  fieldCode: string
  required: boolean
  requiredWhen?: string
}

type WizardSection = {
  sectionCode: string
  title: string
  fields: WizardField[]
}

type DraftValue = string | boolean
type ReadinessIssue = {
  id: string
  label: string
  sectionCode?: string
}
const PROPOSAL_WIZARD_DRAFT_KEY = 'proposal-wizard-draft'

function labelFromFieldCode(fieldCode: string) {
  const last = fieldCode.split('.').pop() ?? fieldCode
  return last
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

function isBooleanField(fieldCode: string) {
  return /(has_|needs_|is_|uses_|auto_renew|high_density|remote_location|corporate_link|critical|_flag$|_enabled$)/.test(fieldCode)
}

function isNumericField(fieldCode: string) {
  return /(percent|days|months|total|mbps|m2|minutes|users|term|retention)/.test(fieldCode)
}

function evaluateRequiredWhen(rule: string | undefined, values: Record<string, DraftValue>) {
  if (!rule) return false
  const [left, right] = rule.split('=')
  if (!left || right === undefined) return false
  const value = values[left]
  if (right === 'true' || right === 'false') {
    if (typeof value === 'boolean') return value === (right === 'true')
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (normalized === 'true' || normalized === 'sim' || normalized === '1') {
        return right === 'true'
      }
      if (normalized === 'false' || normalized === 'nao' || normalized === 'não' || normalized === '0') {
        return right === 'false'
      }
    }
    return false
  }
  return String(value ?? '') === right
}

function isFilledValue(value: DraftValue | undefined) {
  if (typeof value === 'boolean') return true
  return String(value ?? '').trim().length > 0
}

function buildDraftFromAnswers(answers: any[]) {
  const latestMap = new Map<string, any>()
  for (const answer of answers) {
    if (!latestMap.has(answer.fieldCode)) {
      latestMap.set(answer.fieldCode, answer)
    }
  }
  const draft: Record<string, DraftValue> = {}
  latestMap.forEach((answer, fieldCode) => {
    if (typeof answer.valueBoolean === 'boolean') {
      draft[fieldCode] = answer.valueBoolean
    } else if (answer.valueNumber !== null && answer.valueNumber !== undefined) {
      draft[fieldCode] = String(answer.valueNumber)
    } else {
      draft[fieldCode] = answer.valueText ?? ''
    }
  })
  return draft
}

function isSameDraftValue(a: DraftValue | undefined, b: DraftValue | undefined) {
  if (a === undefined && b === undefined) return true
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    if (typeof a !== 'boolean' || typeof b !== 'boolean') return false
    return a === b
  }
  return String(a ?? '').trim() === String(b ?? '').trim()
}

function pluralizeEtapa(count: number) {
  return `${count} ${count === 1 ? 'etapa' : 'etapas'}`
}

export default function ProposalRequestDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const role = useRole()
  const [apiError, setApiError] = useState('')
  const [answerValue, setAnswerValue] = useState('')
  const [reviewDecision, setReviewDecision] = useState('APPROVED')
  const [reviewNotes, setReviewNotes] = useState('')
  const [pendingTitle, setPendingTitle] = useState('')
  const [pendingDescription, setPendingDescription] = useState('')
  const [activeSectionCode, setActiveSectionCode] = useState('')
  const [draftAnswers, setDraftAnswers] = useState<Record<string, DraftValue>>({})
  const [wizardError, setWizardError] = useState('')
  const [localDraftLoaded, setLocalDraftLoaded] = useState(false)
  const [isBatchSaving, setIsBatchSaving] = useState(false)
  const [highlightedSectionCode, setHighlightedSectionCode] = useState('')
  const focusHighlightTimeoutRef = useRef<number | null>(null)

  const { data, isLoading } = useProposalRequest(id)
  const { data: wizardSummary } = useProposalWizardSummary(id)
  const { data: wizardSections = [] } = useProposalWizardSections(id)
  const { data: wizardTemplate } = useProposalWizardTemplate()
  const { data: answerVersions = [] } = useProposalAnswerVersions(id)
  const { data: proposalAnswers = [] } = useProposalAnswers(id)
  const { data: pendings = [] } = useProposalPendings(id)
  const saveAnswers = useSaveProposalAnswers()
  const submitRequest = useSubmitProposalRequest()
  const recalcComposition = useRecalculateProposalComposition()
  const recalcPricing = useRecalculateProposalPricing()
  const generateProposal = useGenerateProposal()
  const createReview = useCreatePresalesReview()
  const createPending = useCreateProposalPending()
  const resolvePending = useResolveProposalPending()

  const templateSections: WizardSection[] = useMemo(
    () => (wizardTemplate?.sections ?? []) as WizardSection[],
    [wizardTemplate],
  )

  useEffect(() => {
    if (!activeSectionCode && templateSections.length > 0) {
      setActiveSectionCode(templateSections[0].sectionCode)
    }
  }, [activeSectionCode, templateSections])

  useEffect(() => {
    return () => {
      if (focusHighlightTimeoutRef.current) {
        window.clearTimeout(focusHighlightTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    setLocalDraftLoaded(false)
    try {
      const raw = localStorage.getItem(`${PROPOSAL_WIZARD_DRAFT_KEY}:${id}`)
      if (!raw) {
        setLocalDraftLoaded(true)
        return
      }
      const parsed = JSON.parse(raw) as Record<string, DraftValue>
      if (parsed && typeof parsed === 'object') {
        setDraftAnswers(parsed)
      }
    } catch {
      // ignora rascunho inválido no browser
    } finally {
      setLocalDraftLoaded(true)
    }
  }, [id])

  useEffect(() => {
    if (!localDraftLoaded) return
    const backendDraft = buildDraftFromAnswers(proposalAnswers as any[])
    setDraftAnswers((prev) => {
      const merged = { ...prev }
      Object.entries(backendDraft).forEach(([fieldCode, value]) => {
        if (merged[fieldCode] !== undefined) return
        merged[fieldCode] = value
      })
      return merged
    })
  }, [localDraftLoaded, proposalAnswers])

  useEffect(() => {
    if (!localDraftLoaded) return
    try {
      localStorage.setItem(`${PROPOSAL_WIZARD_DRAFT_KEY}:${id}`, JSON.stringify(draftAnswers))
    } catch {
      // sem ação: limite de storage ou indisponibilidade
    }
  }, [draftAnswers, id, localDraftLoaded])

  const activeSection = useMemo(
    () => templateSections.find((section) => section.sectionCode === activeSectionCode) ?? null,
    [activeSectionCode, templateSections],
  )
  const backendDraft = useMemo(
    () => buildDraftFromAnswers(proposalAnswers as any[]),
    [proposalAnswers],
  )

  const sectionChecklists = useMemo(() => {
    return templateSections.map((section) => {
      const requiredFields = section.fields.filter((field) =>
        field.required || evaluateRequiredWhen(field.requiredWhen, draftAnswers),
      )
      const filledRequired = requiredFields.filter((field) => isFilledValue(draftAnswers[field.fieldCode]))
      const missingRequired = requiredFields.filter((field) => !isFilledValue(draftAnswers[field.fieldCode]))
      return {
        sectionCode: section.sectionCode,
        title: section.title,
        requiredCount: requiredFields.length,
        filledCount: filledRequired.length,
        missingRequired,
        complete: requiredFields.length === 0 || missingRequired.length === 0,
      }
    })
  }, [draftAnswers, templateSections])

  const activeSectionChecklist = useMemo(
    () => sectionChecklists.find((item) => item.sectionCode === activeSectionCode) ?? null,
    [activeSectionCode, sectionChecklists],
  )

  const wizardReadyForSubmit = useMemo(() => {
    const blockersCount = wizardSummary?.blockersCount ?? 0
    const openPendingsCount = (wizardSummary?.openPendings ?? []).length
    const allChecklistComplete = sectionChecklists.every((item) => item.complete)
    return blockersCount === 0 && openPendingsCount === 0 && allChecklistComplete
  }, [sectionChecklists, wizardSummary])
  const incompleteSections = useMemo(
    () => sectionChecklists.filter((item) => !item.complete),
    [sectionChecklists],
  )

  const hasUnsyncedLocalDraft = useMemo(() => {
    const fieldCodes = new Set<string>()
    templateSections.forEach((section) => {
      section.fields.forEach((field) => fieldCodes.add(field.fieldCode))
    })
    for (const fieldCode of fieldCodes) {
      if (!isSameDraftValue(draftAnswers[fieldCode], backendDraft[fieldCode])) {
        return true
      }
    }
    return false
  }, [backendDraft, draftAnswers, templateSections])

  const activeSectionUnsynced = useMemo(() => {
    if (!activeSection) return false
    return activeSection.fields.some((field) =>
      !isSameDraftValue(draftAnswers[field.fieldCode], backendDraft[field.fieldCode]),
    )
  }, [activeSection, backendDraft, draftAnswers])

  const unsyncedSectionCodes = useMemo(() => {
    return templateSections
      .filter((section) => section.fields.some((field) =>
        !isSameDraftValue(draftAnswers[field.fieldCode], backendDraft[field.fieldCode]),
      ))
      .map((section) => section.sectionCode)
  }, [backendDraft, draftAnswers, templateSections])
  const readinessIssues = useMemo<ReadinessIssue[]>(() => {
    const issues: ReadinessIssue[] = []
    const blockers = wizardSummary?.blockers ?? []
    const openPendings = wizardSummary?.openPendings ?? []

    if (incompleteSections.length > 0) {
      issues.push({
        id: 'incomplete-sections',
        label: `${pluralizeEtapa(incompleteSections.length)} com checklist obrigatório incompleto`,
        sectionCode: incompleteSections[0]?.sectionCode,
      })
    }
    if (blockers.length > 0) {
      issues.push({
        id: 'critical-blockers',
        label: `${blockers.length} bloqueio(s) crítico(s) no levantamento`,
        sectionCode: blockers[0]?.sectionCode,
      })
    }
    if (openPendings.length > 0) {
      issues.push({
        id: 'open-pendings',
        label: `${openPendings.length} pendência(s) técnica(s) em aberto`,
        sectionCode: openPendings.find((p: any) => p.sectionCode)?.sectionCode,
      })
    }
    if (unsyncedSectionCodes.length > 0) {
      issues.push({
        id: 'unsynced-local',
        label: `${pluralizeEtapa(unsyncedSectionCodes.length)} com alterações locais não sincronizadas`,
        sectionCode: unsyncedSectionCodes[0],
      })
    }

    return issues
  }, [incompleteSections, unsyncedSectionCodes, wizardSummary])

  if (isLoading) return <PageLoader />
  if (!data) return <div className="page-body">Solicitação não encontrada.</div>

  const handleQuickAnswer = async () => {
    setApiError('')
    try {
      await saveAnswers.mutateAsync({
        id,
        data: {
          sectionCode: 'context',
          answers: [
            { fieldCode: 'context.solution_type', valueText: data.solutionType },
            { fieldCode: 'context.technology', valueText: data.technology },
            { fieldCode: 'context.corporate_link', valueBoolean: true },
            { fieldCode: 'usage.simultaneous_users', valueText: answerValue || '10' },
            { fieldCode: 'sites.total', valueText: '1' },
            { fieldCode: 'network.needs_failover', valueBoolean: false },
            { fieldCode: 'bandwidth.download_mbps', valueText: '200' },
            { fieldCode: 'bandwidth.upload_mbps', valueText: '40' },
            { fieldCode: 'security.compliance', valueText: 'NONE' },
            { fieldCode: 'wifi.high_density', valueBoolean: false },
            { fieldCode: 'operation.critical', valueBoolean: false },
            { fieldCode: 'infra.includes_installation', valueBoolean: true },
            { fieldCode: 'monitoring.wants_dashboard', valueBoolean: false },
            { fieldCode: 'logistics.remote_location', valueBoolean: false },
            { fieldCode: 'pricing.desired_discount_percent', valueText: '0' },
            { fieldCode: 'pricing.payment_term_days', valueText: '28' },
            { fieldCode: 'sla.support_window', valueText: '8x5' },
            { fieldCode: 'sla.response_time_target', valueText: '4h' },
            { fieldCode: 'contract.term_months', valueText: '12' },
            { fieldCode: 'contract.auto_renew', valueBoolean: true },
            { fieldCode: 'risk.main_constraint', valueText: 'Sem restrições adicionais.' },
            { fieldCode: 'delivery.target_date', valueText: '2026-05-30' },
            { fieldCode: 'governance.requester_authority', valueText: 'GERENTE_LOCAL' },
            { fieldCode: 'governance.approval_email', valueText: 'aprovacoes@cliente.com' },
            { fieldCode: 'attachments.has_topology_file', valueBoolean: false },
            { fieldCode: 'attachments.has_site_photos', valueBoolean: false },
          ],
        },
      })
    } catch (error) {
      setApiError(extractApiError(error))
    }
  }

  const handlePresalesDecision = async () => {
    setApiError('')
    try {
      await createReview.mutateAsync({
        id,
        data: {
          technicalComplexity: 'MEDIUM',
          technicalRisk: 'MEDIUM',
          logisticsRisk: 'LOW',
          commercialRisk: 'LOW',
          requiredVisit: false,
          technicalPremises: 'Premissas técnicas registradas no parecer.',
          technicalExclusions: 'Exclusões técnicas registradas no parecer.',
          decision: reviewDecision,
          justification: reviewNotes || 'Parecer registrado no fluxo interno.',
        },
      })
    } catch (error) {
      setApiError(extractApiError(error))
    }
  }

  const handleCreatePending = async () => {
    setApiError('')
    try {
      await createPending.mutateAsync({
        id,
        data: {
          title: pendingTitle,
          description: pendingDescription,
          severity: 'HIGH',
          sectionCode: 'context',
        },
      })
      setPendingTitle('')
      setPendingDescription('')
    } catch (error) {
      setApiError(extractApiError(error))
    }
  }

  const handleSectionFieldChange = (fieldCode: string, value: DraftValue) => {
    setDraftAnswers((prev) => ({ ...prev, [fieldCode]: value }))
  }

  const saveCurrentSection = async () => {
    if (!activeSection) return
    setApiError('')
    setWizardError('')

    const missingRequired = activeSection.fields.filter((field) => {
      const isRequired = field.required || evaluateRequiredWhen(field.requiredWhen, draftAnswers)
      if (!isRequired) return false
      const value = draftAnswers[field.fieldCode]
      if (typeof value === 'boolean') return false
      return String(value ?? '').trim().length === 0
    })

    if (missingRequired.length > 0) {
      setWizardError(`Preencha os campos obrigatórios: ${missingRequired.map((f) => labelFromFieldCode(f.fieldCode)).join(', ')}`)
      return false
    }

    const answersPayload = activeSection.fields
      .map((field) => {
        const value = draftAnswers[field.fieldCode]
        if (value === undefined || value === null || value === '') return null
        if (isBooleanField(field.fieldCode)) {
          return { fieldCode: field.fieldCode, valueBoolean: Boolean(value) }
        }
        if (isNumericField(field.fieldCode) && !Number.isNaN(Number(value))) {
          return { fieldCode: field.fieldCode, valueNumber: Number(value) }
        }
        return { fieldCode: field.fieldCode, valueText: String(value) }
      })
      .filter(Boolean)

    if (answersPayload.length === 0) {
      setWizardError('Nenhum campo preenchido para salvar nesta seção.')
      return false
    }

    try {
      await saveAnswers.mutateAsync({
        id,
        data: {
          sectionCode: activeSection.sectionCode,
          answers: answersPayload,
        },
      })
      return true
    } catch (error) {
      setApiError(extractApiError(error))
      return false
    }
  }

  const handleSaveSection = async () => {
    await saveCurrentSection()
  }

  const handleGoToNextSection = () => {
    if (!activeSection) return
    if (activeSectionChecklist && !activeSectionChecklist.complete) {
      setWizardError(
        `Complete os obrigatórios antes de avançar: ${activeSectionChecklist.missingRequired
          .map((f) => labelFromFieldCode(f.fieldCode))
          .join(', ')}`,
      )
      return
    }
    const idx = templateSections.findIndex((s) => s.sectionCode === activeSection.sectionCode)
    const next = templateSections[idx + 1]
    if (next) {
      setWizardError('')
      setActiveSectionCode(next.sectionCode)
    }
  }

  const handleSaveAndGoToNextSection = async () => {
    const saved = await saveCurrentSection()
    if (!saved || !activeSection) return
    const idx = templateSections.findIndex((s) => s.sectionCode === activeSection.sectionCode)
    const next = templateSections[idx + 1]
    if (next) {
      setWizardError('')
      setActiveSectionCode(next.sectionCode)
    }
  }

  const handleClearLocalDraft = () => {
    const confirmed = window.confirm('Deseja limpar o rascunho local desta solicitação?')
    if (!confirmed) return
    try {
      localStorage.removeItem(`${PROPOSAL_WIZARD_DRAFT_KEY}:${id}`)
    } catch {
      // segue mesmo que o browser bloqueie remoção
    }
    setWizardError('')
    setApiError('')
    setDraftAnswers(buildDraftFromAnswers(proposalAnswers as any[]))
  }

  const handleSaveAllChangedSections = async () => {
    setApiError('')
    setWizardError('')

    const changedSections = templateSections.filter((section) => unsyncedSectionCodes.includes(section.sectionCode))
    if (changedSections.length === 0) {
      setWizardError('Não há etapas alteradas para sincronizar.')
      return
    }

    const incompleteSections = changedSections
      .map((section) => {
        const requiredMissing = section.fields.filter((field) => {
          const requiredNow = field.required || evaluateRequiredWhen(field.requiredWhen, draftAnswers)
          if (!requiredNow) return false
          return !isFilledValue(draftAnswers[field.fieldCode])
        })
        return { section, requiredMissing }
      })
      .filter((item) => item.requiredMissing.length > 0)

    if (incompleteSections.length > 0) {
      const messages = incompleteSections.map((item) =>
        `${item.section.title}: ${item.requiredMissing.map((f) => labelFromFieldCode(f.fieldCode)).join(', ')}`,
      )
      setWizardError(`Não foi possível sincronizar. Etapas incompletas: ${messages.join(' | ')}`)
      return
    }

    setIsBatchSaving(true)
    try {
      for (const section of changedSections) {
        const answersPayload = section.fields
          .map((field) => {
            const value = draftAnswers[field.fieldCode]
            if (value === undefined || value === null || value === '') return null
            if (isBooleanField(field.fieldCode)) return { fieldCode: field.fieldCode, valueBoolean: Boolean(value) }
            if (isNumericField(field.fieldCode) && !Number.isNaN(Number(value))) {
              return { fieldCode: field.fieldCode, valueNumber: Number(value) }
            }
            return { fieldCode: field.fieldCode, valueText: String(value) }
          })
          .filter(Boolean)

        if (answersPayload.length === 0) continue
        await saveAnswers.mutateAsync({
          id,
          data: {
            sectionCode: section.sectionCode,
            answers: answersPayload,
          },
        })
      }
    } catch (error) {
      setApiError(extractApiError(error))
    } finally {
      setIsBatchSaving(false)
    }
  }

  const handleFocusSection = (sectionCode?: string) => {
    if (!sectionCode) return
    const exists = templateSections.some((section) => section.sectionCode === sectionCode)
    if (!exists) return
    setActiveSectionCode(sectionCode)
    setHighlightedSectionCode(sectionCode)
    if (focusHighlightTimeoutRef.current) {
      window.clearTimeout(focusHighlightTimeoutRef.current)
    }
    focusHighlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedSectionCode('')
      focusHighlightTimeoutRef.current = null
    }, 2600)
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="font-semibold text-surface-900">{data.number}</h1>
          <p className="text-xs text-surface-400">{data.title} · {data.customerName}</p>
        </div>
        <button className="btn-secondary btn-sm" onClick={() => navigate('/proposals/requests')}>Voltar</button>
      </div>

      <div className="page-body space-y-4">
        {apiError && <Alert type="error" message={apiError} />}

        <div className="card">
          <div className="card-body grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><strong>Status:</strong> {data.status}</div>
            <div><strong>Tecnologia:</strong> {data.technology}</div>
            <div><strong>Solução:</strong> {data.solutionType}</div>
            <div><strong>Urgência:</strong> {data.urgency}</div>
          </div>
        </div>

        <Alert
          type={wizardReadyForSubmit ? 'success' : 'warning'}
          message={wizardReadyForSubmit
            ? 'Levantamento pronto para submissão: sem bloqueios críticos, sem pendências abertas e checklist das etapas completo.'
            : `Levantamento ainda não está pronto para submissão: ${readinessIssues.map((issue) => issue.label).join(' | ') || 'faltam validações obrigatórias.'}`}
        />
        {!wizardReadyForSubmit && readinessIssues.length > 0 && (
          <div className="flex flex-wrap gap-2 -mt-2">
            {readinessIssues.map((issue) => (
              <button
                key={issue.id}
                className="text-xs rounded border border-amber-200 bg-amber-50 text-amber-700 px-2 py-1"
                onClick={() => handleFocusSection(issue.sectionCode)}
                disabled={!issue.sectionCode}
                title={issue.sectionCode ? `Ir para seção ${issue.sectionCode}` : 'Sem seção associada'}
              >
                {issue.label}
              </button>
            ))}
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <span className="text-sm font-semibold">Resumo de validação do wizard</span>
          </div>
          <div className="card-body space-y-2">
            <div className="text-sm">
              <strong>Etapas mapeadas:</strong> {wizardTemplate?.sections?.length ?? 0}
            </div>
            <div className="text-sm">
              <strong>Bloqueios críticos:</strong> {wizardSummary?.blockersCount ?? 0}
            </div>
            <div className="text-sm">
              <strong>Pré-vendas obrigatório:</strong> {wizardSummary?.requiresPresales ? 'Sim' : 'Não'}
            </div>
            {(wizardSummary?.blockers ?? []).length > 0 && (
              <div className="space-y-1">
                {(wizardSummary?.blockers ?? []).map((blocker: any) => (
                  <div key={blocker.code} className="text-xs rounded bg-red-50 text-red-700 px-2 py-1 border border-red-200">
                    {blocker.message}
                  </div>
                ))}
              </div>
            )}
            {wizardSections.length > 0 && (
              <div className="pt-2 space-y-2">
                {wizardSections.map((section: any) => (
                  <div key={section.sectionCode}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-surface-600">{section.title}</span>
                      <span className="font-semibold">{section.completion}%</span>
                    </div>
                    <div className="h-2 rounded bg-surface-100 overflow-hidden">
                      <div
                        className={`h-full ${section.status === 'blocked' ? 'bg-red-500' : section.status === 'complete' ? 'bg-emerald-500' : 'bg-brand-500'}`}
                        style={{ width: `${section.completion}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Wizard de levantamento por etapa</span>
              <span className={`text-[10px] px-2 py-0.5 rounded ${hasUnsyncedLocalDraft ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {hasUnsyncedLocalDraft
                  ? `${pluralizeEtapa(unsyncedSectionCodes.length)} pendente${unsyncedSectionCodes.length === 1 ? '' : 's'} de sincronização`
                  : 'Rascunho sincronizado'}
              </span>
            </div>
          </div>
          <div className="card-body grid md:grid-cols-3 gap-4">
            {hasUnsyncedLocalDraft && (
              <div className="md:col-span-3">
                <Alert
                  type="warning"
                  message={`Existem ${pluralizeEtapa(unsyncedSectionCodes.length)} com alterações no rascunho local que ainda não ${unsyncedSectionCodes.length === 1 ? 'foi sincronizada' : 'foram sincronizadas'} com o backend.`}
                />
              </div>
            )}
            <div className="space-y-1 md:col-span-1">
              {templateSections.map((section) => {
                const checklist = sectionChecklists.find((item) => item.sectionCode === section.sectionCode)
                return (
                <button
                  key={section.sectionCode}
                  className={`w-full text-left text-xs rounded px-2 py-2 border ${
                    activeSectionCode === section.sectionCode
                      ? 'border-brand-300 bg-brand-50 text-brand-700'
                      : 'border-surface-200 hover:bg-surface-50'
                  } ${
                    highlightedSectionCode === section.sectionCode ? 'ring-2 ring-amber-300 animate-pulse' : ''
                  }`}
                  onClick={() => {
                    setWizardError('')
                    setActiveSectionCode(section.sectionCode)
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span>{section.title}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${checklist?.complete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {checklist?.complete ? 'OK' : 'PENDENTE'}
                    </span>
                  </div>
                  <div className="text-[10px] text-surface-500 mt-1">
                    Obrigatórios: {checklist?.filledCount ?? 0}/{checklist?.requiredCount ?? 0}
                  </div>
                </button>
              )})}
            </div>

            <div className="md:col-span-2 space-y-3">
              {!activeSection ? (
                <p className="text-sm text-surface-500">Selecione uma etapa para editar.</p>
              ) : (
                <>
                  <div className={`flex items-center gap-2 ${highlightedSectionCode === activeSection.sectionCode ? 'animate-pulse' : ''}`}>
                    <p className="text-sm font-semibold text-surface-700">{activeSection.title}</p>
                    {activeSectionUnsynced && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                        Alterações locais não salvas
                      </span>
                    )}
                  </div>
                  {activeSectionChecklist && (
                    <div className="rounded border border-surface-200 p-2">
                      <p className="text-xs font-semibold text-surface-700 mb-1">Checklist da etapa</p>
                      <p className="text-xs text-surface-500 mb-2">
                        Obrigatórios preenchidos: {activeSectionChecklist.filledCount}/{activeSectionChecklist.requiredCount}
                      </p>
                      {activeSectionChecklist.requiredCount === 0 ? (
                        <p className="text-xs text-surface-500">Esta etapa não possui campos obrigatórios fixos.</p>
                      ) : (
                        <div className="space-y-1">
                          {activeSectionChecklist.missingRequired.length === 0 ? (
                            <p className="text-xs text-emerald-700">Todos os campos obrigatórios desta etapa foram preenchidos.</p>
                          ) : (
                            activeSectionChecklist.missingRequired.map((field) => (
                              <div key={field.fieldCode} className="text-xs text-amber-700">
                                - Falta: {labelFromFieldCode(field.fieldCode)}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {wizardError && <Alert type="warning" message={wizardError} />}
                  {activeSection.fields.map((field) => {
                    const value = draftAnswers[field.fieldCode]
                    const isRequired = field.required || evaluateRequiredWhen(field.requiredWhen, draftAnswers)
                    const boolField = isBooleanField(field.fieldCode)
                    return (
                      <FormField
                        key={field.fieldCode}
                        label={labelFromFieldCode(field.fieldCode)}
                        required={isRequired}
                        hint={field.requiredWhen ? `Obrigatório quando: ${field.requiredWhen}` : undefined}
                      >
                        {boolField ? (
                          <select
                            className="form-input appearance-none"
                            value={typeof value === 'boolean' ? String(value) : ''}
                            onChange={(e) =>
                              handleSectionFieldChange(
                                field.fieldCode,
                                e.target.value === '' ? '' : e.target.value === 'true',
                              )}
                          >
                            <option value="">Selecione</option>
                            <option value="true">Sim</option>
                            <option value="false">Não</option>
                          </select>
                        ) : (
                          <input
                            className="form-input"
                            type={field.fieldCode.includes('date') ? 'date' : field.fieldCode.includes('email') ? 'email' : isNumericField(field.fieldCode) ? 'number' : 'text'}
                            value={typeof value === 'boolean' ? '' : String(value ?? '')}
                            onChange={(e) => handleSectionFieldChange(field.fieldCode, e.target.value)}
                          />
                        )}
                      </FormField>
                    )
                  })}

                  <div className="flex gap-2">
                    <button className="btn-secondary btn-sm" onClick={handleSaveSection} disabled={saveAnswers.isPending}>
                      {saveAnswers.isPending ? <Spinner size="sm" /> : null}
                      Salvar etapa
                    </button>
                    <button
                      className="btn-secondary btn-sm"
                      onClick={handleSaveAndGoToNextSection}
                      disabled={saveAnswers.isPending}
                    >
                      {saveAnswers.isPending ? <Spinner size="sm" /> : null}
                      Salvar e próxima etapa
                    </button>
                    <button
                      className="btn-secondary btn-sm"
                      onClick={handleSaveAllChangedSections}
                      disabled={isBatchSaving || unsyncedSectionCodes.length === 0}
                    >
                      {isBatchSaving ? <Spinner size="sm" /> : null}
                      Salvar etapas alteradas
                    </button>
                    <button className="btn-ghost btn-sm" onClick={handleClearLocalDraft}>
                      Limpar rascunho local
                    </button>
                    <button
                      className="btn-ghost btn-sm"
                      onClick={handleGoToNextSection}
                    >
                      Próxima etapa
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="text-sm font-semibold">Versionamento de respostas</span>
          </div>
          <div className="card-body">
            {answerVersions.length === 0 ? (
              <p className="text-sm text-surface-500">Sem versões registradas.</p>
            ) : (
              <div className="space-y-1">
                {answerVersions.map((item: any) => (
                  <div key={`${item.sectionCode}-${item.version}`} className="text-xs text-surface-700 border border-surface-200 rounded px-2 py-1">
                    {item.sectionCode} · v{item.version} · {item.answersCount} respostas
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {isCommercial(role) && (
          <div className="card">
            <div className="card-header">
              <span className="text-sm font-semibold">Levantamento rápido (pré-preenchimento de respostas críticas)</span>
            </div>
            <div className="card-body space-y-3">
              <FormField label="Usuários simultâneos (campo crítico exemplo)">
                <input className="form-input" value={answerValue} onChange={(e) => setAnswerValue(e.target.value)} />
              </FormField>
              <div className="flex items-center gap-2">
                <button className="btn-secondary btn-sm" onClick={handleQuickAnswer} disabled={saveAnswers.isPending}>
                  {saveAnswers.isPending ? <Spinner size="sm" /> : null}
                  Salvar respostas
                </button>
                <button
                  className="btn-primary btn-sm"
                  onClick={() => submitRequest.mutate(id)}
                  disabled={submitRequest.isPending || !wizardReadyForSubmit}
                >
                  {submitRequest.isPending ? <Spinner size="sm" /> : null}
                  Enviar para próxima etapa
                </button>
              </div>
              {!wizardReadyForSubmit && (
                <p className="text-xs text-amber-700">
                  Envio bloqueado: conclua checklist obrigatório, resolva bloqueios críticos e pendências abertas.
                </p>
              )}
            </div>
          </div>
        )}

        {isPresales(role) && (
          <div className="card">
            <div className="card-header">
              <span className="text-sm font-semibold">Análise técnica de Pré-vendas</span>
            </div>
            <div className="card-body space-y-3">
              <FormField label="Decisão técnica">
                <select className="form-input appearance-none" value={reviewDecision} onChange={(e) => setReviewDecision(e.target.value)}>
                  <option value="APPROVED">Aprovada</option>
                  <option value="APPROVED_WITH_REMARKS">Aprovada com ressalva</option>
                  <option value="RETURNED_WITH_PENDING">Devolvida com pendência</option>
                  <option value="REJECTED">Reprovada</option>
                </select>
              </FormField>
              <FormField label="Justificativa">
                <textarea className="form-input resize-none" rows={3} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
              </FormField>
              <button className="btn-primary btn-sm" onClick={handlePresalesDecision} disabled={createReview.isPending}>
                {createReview.isPending ? <Spinner size="sm" /> : null}
                Registrar parecer técnico
              </button>

              <div className="border-t border-surface-100 pt-3 mt-2 space-y-2">
                <p className="text-xs text-surface-500 font-medium">Abrir pendência para o Comercial</p>
                <FormField label="Título da pendência">
                  <input className="form-input" value={pendingTitle} onChange={(e) => setPendingTitle(e.target.value)} />
                </FormField>
                <FormField label="Descrição">
                  <textarea className="form-input resize-none" rows={2} value={pendingDescription} onChange={(e) => setPendingDescription(e.target.value)} />
                </FormField>
                <button className="btn-secondary btn-sm" onClick={handleCreatePending} disabled={createPending.isPending || !pendingTitle.trim()}>
                  {createPending.isPending ? <Spinner size="sm" /> : null}
                  Abrir pendência
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <span className="text-sm font-semibold">Pendências</span>
          </div>
          <div className="card-body space-y-2">
            {pendings.length === 0 ? (
              <p className="text-sm text-surface-500">Nenhuma pendência registrada.</p>
            ) : (
              pendings.map((pending: any) => (
                <div key={pending.id} className="border border-surface-200 rounded p-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{pending.title}</p>
                      {pending.description && <p className="text-xs text-surface-500">{pending.description}</p>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${pending.status === 'OPEN' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {pending.status}
                    </span>
                  </div>
                  {isCommercial(role) && pending.status === 'OPEN' && (
                    <div className="pt-2">
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => resolvePending.mutate({ id, pendingId: pending.id, data: { resolutionNote: 'Pendência resolvida pelo Comercial.' } })}
                        disabled={resolvePending.isPending}
                      >
                        {resolvePending.isPending ? <Spinner size="sm" /> : null}
                        Marcar como resolvida
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="text-sm font-semibold">Aprovações de alçada</span>
          </div>
          <div className="card-body space-y-2">
            {(data.approvals ?? []).length === 0 ? (
              <p className="text-sm text-surface-500">Nenhuma aprovação registrada para esta solicitação.</p>
            ) : (
              (data.approvals ?? []).map((approval: any) => (
                <div key={approval.id} className="text-xs border border-surface-200 rounded px-2 py-1">
                  <span className="font-semibold">{approval.approvalType}</span> · {approval.status}
                  <div className="text-surface-500">{approval.reason}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="text-sm font-semibold">Composição, preço e proposta</span>
          </div>
          <div className="card-body flex flex-wrap gap-2">
            <button className="btn-secondary btn-sm" onClick={() => recalcComposition.mutate(id)} disabled={recalcComposition.isPending}>
              {recalcComposition.isPending ? <Spinner size="sm" /> : null}
              Recalcular composição
            </button>
            <button className="btn-secondary btn-sm" onClick={() => recalcPricing.mutate(id)} disabled={recalcPricing.isPending}>
              {recalcPricing.isPending ? <Spinner size="sm" /> : null}
              Recalcular precificação
            </button>
            <button className="btn-primary btn-sm" onClick={() => generateProposal.mutate(id)} disabled={generateProposal.isPending}>
              {generateProposal.isPending ? <Spinner size="sm" /> : null}
              Gerar proposta
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
