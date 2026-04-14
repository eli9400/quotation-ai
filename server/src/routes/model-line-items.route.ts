import { Router } from 'express'
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { deleteProviderLineItem } from '../services/provider-line-item-delete.service.js'
import {
  listProviderLineItemDisplayOverrides,
  upsertProviderLineItemDisplayOverrides,
  type UpsertProviderLineItemDisplayOverrideInput,
} from '../services/provider-line-item-overrides.service.js'
import { mergeProviderLineItems } from '../services/provider-line-item-merge.service.js'
import { listProviderLineItemOptions } from '../services/provider-line-items.service.js'

type UpdateClientDisplayBody = {
  configs?: unknown
}

type RawConfig = {
  sourceItemId?: unknown
  customLabel?: unknown
  categoryId?: unknown
  categoryLabel?: unknown
  visibleToClient?: unknown
}

type MergeLineItemsBody = {
  sourceItemId?: unknown
  targetItemId?: unknown
}

function parseConfigs(body: UpdateClientDisplayBody): UpsertProviderLineItemDisplayOverrideInput[] | null {
  if (!Array.isArray(body.configs)) return null

  const parsed: UpsertProviderLineItemDisplayOverrideInput[] = []
  body.configs.forEach((raw) => {
    const candidate = raw as RawConfig
    if (typeof candidate.sourceItemId !== 'string' || candidate.sourceItemId.trim().length === 0) {
      return
    }
    parsed.push({
      sourceItemId: candidate.sourceItemId.trim(),
      customLabel: typeof candidate.customLabel === 'string' ? candidate.customLabel : null,
      customCategoryId:
        typeof candidate.categoryId === 'string' ? candidate.categoryId : null,
      customCategoryLabel:
        typeof candidate.categoryLabel === 'string' ? candidate.categoryLabel : null,
      visibleToClient:
        typeof candidate.visibleToClient === 'boolean' ? candidate.visibleToClient : true,
    })
  })

  return parsed
}

function parseMergeInput(body: MergeLineItemsBody): { sourceItemId: string; targetItemId: string } | null {
  if (typeof body.sourceItemId !== 'string' || typeof body.targetItemId !== 'string') {
    return null
  }
  const sourceItemId = body.sourceItemId.trim()
  const targetItemId = body.targetItemId.trim()
  if (!sourceItemId || !targetItemId || sourceItemId === targetItemId) {
    return null
  }
  return { sourceItemId, targetItemId }
}

export const modelLineItemsRouter = Router()

modelLineItemsRouter.get('/model/provider-line-items', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const items = await listProviderLineItemOptions(authReq.authUser.uid)
    res.status(200).json({ ok: true, items })
  } catch (error) {
    next(error)
  }
})

modelLineItemsRouter.get('/model/provider-line-items/client-config', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const configs = await listProviderLineItemDisplayOverrides(authReq.authUser.uid)
    res.status(200).json({ ok: true, configs })
  } catch (error) {
    next(error)
  }
})

modelLineItemsRouter.patch('/model/provider-line-items/client-config', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const body = req.body as UpdateClientDisplayBody
    const configs = parseConfigs(body)
    if (!configs) {
      res.status(400).json({
        ok: false,
        message:
          'configs must be an array of {sourceItemId, customLabel, categoryId, categoryLabel, visibleToClient}.',
      })
      return
    }

    const updated = await upsertProviderLineItemDisplayOverrides(authReq.authUser.uid, configs)
    res.status(200).json({ ok: true, configs: updated })
  } catch (error) {
    next(error)
  }
})

modelLineItemsRouter.post('/model/provider-line-items/merge', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const body = req.body as MergeLineItemsBody
    const input = parseMergeInput(body)
    if (!input) {
      res.status(400).json({
        ok: false,
        message: 'sourceItemId and targetItemId are required and must be different.',
      })
      return
    }

    const merged = await mergeProviderLineItems({
      serviceProviderUid: authReq.authUser.uid,
      sourceItemId: input.sourceItemId,
      targetItemId: input.targetItemId,
    })
    res.status(200).json({ ok: true, merged })
  } catch (error) {
    next(error)
  }
})

modelLineItemsRouter.delete('/model/provider-line-items/:sourceItemId', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const sourceItemId = Array.isArray(req.params.sourceItemId)
      ? req.params.sourceItemId[0]?.trim()
      : req.params.sourceItemId?.trim()
    if (!sourceItemId) {
      res.status(400).json({ ok: false, message: 'sourceItemId is required.' })
      return
    }

    const deleted = await deleteProviderLineItem(authReq.authUser.uid, sourceItemId)
    res.status(200).json({ ok: true, deleted })
  } catch (error) {
    next(error)
  }
})
