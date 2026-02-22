import { Router } from 'express'
import {
  listVehicleManufacturers,
  listVehicleModelsByMake,
  listVehicleTrimsByMake,
} from '../services/vehicle-catalog.service.js'

function parseParamValue(value: unknown): string {
  if (Array.isArray(value)) {
    const first = value[0]
    return typeof first === 'string' ? first.trim() : ''
  }
  return typeof value === 'string' ? value.trim() : ''
}

function parseYear(value: unknown): number | null {
  const raw = parseParamValue(value)
  if (!raw) return null
  const year = Number(raw)
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return null
  return year
}

function parseVehicleTypes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((part) => (typeof part === 'string' ? part : ''))
      .flatMap((part) => part.split(','))
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
  }
  return []
}

export const vehicleCatalogRouter = Router()

vehicleCatalogRouter.get('/public/vehicle-catalog/manufacturers', async (_req, res, next) => {
  try {
    const vehicleTypes = parseVehicleTypes(_req.query.vehicleType)
    const items = await listVehicleManufacturers(vehicleTypes)
    res.status(200).json({ ok: true, items })
  } catch (error) {
    next(error)
  }
})

vehicleCatalogRouter.get('/public/vehicle-catalog/models', async (req, res, next) => {
  try {
    const make = parseParamValue(req.query.make)
    if (make.length < 2) {
      res.status(400).json({ ok: false, message: 'make query param is required.' })
      return
    }
    const year = parseYear(req.query.year)
    const items = await listVehicleModelsByMake(make, year)
    res.status(200).json({ ok: true, items })
  } catch (error) {
    next(error)
  }
})

vehicleCatalogRouter.get('/public/vehicle-catalog/trims', async (req, res, next) => {
  try {
    const make = parseParamValue(req.query.make)
    const items = await listVehicleTrimsByMake(make || null)
    res.status(200).json({ ok: true, items })
  } catch (error) {
    next(error)
  }
})
