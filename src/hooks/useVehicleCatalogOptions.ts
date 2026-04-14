import { useEffect, useMemo, useState } from 'react'
import {
  fetchVehicleManufacturers,
  fetchVehicleModels,
  fetchVehicleTrims,
  type VehicleCatalogOption,
} from '../services/api/clientPortalApi'
import type { FormPreviewSchema } from '../types/quotation'

type UseVehicleCatalogOptionsResult = {
  manufacturerOptions: VehicleCatalogOption[]
  modelOptions: VehicleCatalogOption[]
  trimOptions: VehicleCatalogOption[]
}

type ModelsCacheState = {
  make: string
  year: string
  options: VehicleCatalogOption[]
}

type TrimsCacheState = {
  make: string
  options: VehicleCatalogOption[]
}

function hasField(schema: FormPreviewSchema | null, fieldId: string): boolean {
  if (!schema) return false
  return schema.fields.some((field) => field.id === fieldId)
}

function mapVehicleTypeToCatalogTypes(value: string): string[] {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return ['car']
  if (
    normalized.includes('דו') ||
    normalized.includes('גלגל') ||
    normalized.includes('אופנוע') ||
    normalized.includes('motorcycle') ||
    normalized.includes('bike')
  ) {
    return ['motorcycle']
  }
  if (
    normalized.includes('משאית') ||
    normalized.includes('truck') ||
    normalized.includes('מסחרי') ||
    normalized.includes('commercial') ||
    normalized.includes('van')
  ) {
    return ['truck']
  }
  if (normalized.includes('אוטובוס') || normalized.includes('bus')) {
    return ['bus']
  }
  return ['car']
}

export function useVehicleCatalogOptions(
  schema: FormPreviewSchema | null,
  selectedManufacturer: string,
  selectedYear: string,
  selectedVehicleType: string,
): UseVehicleCatalogOptionsResult {
  const [fetchedManufacturers, setFetchedManufacturers] = useState<VehicleCatalogOption[]>([])
  const [modelsCache, setModelsCache] = useState<ModelsCacheState>({
    make: '',
    year: '',
    options: [],
  })
  const [trimsCache, setTrimsCache] = useState<TrimsCacheState>({
    make: '',
    options: [],
  })

  const hasVehicleMakeField = useMemo(() => hasField(schema, 'intake_vehicleBrand'), [schema])
  const hasVehicleModelField = useMemo(() => hasField(schema, 'intake_vehicleModel'), [schema])
  const hasVehicleTrimField = useMemo(() => hasField(schema, 'intake_vehicleTrim'), [schema])
  const make = selectedManufacturer.trim()
  const year = selectedYear.trim()
  const requestedVehicleTypes = useMemo(
    () => mapVehicleTypeToCatalogTypes(selectedVehicleType),
    [selectedVehicleType],
  )

  useEffect(() => {
    if (!hasVehicleMakeField) return
    let active = true
    const loadManufacturers = async () => {
      try {
        const options = await fetchVehicleManufacturers(requestedVehicleTypes)
        if (active) setFetchedManufacturers(options)
      } catch {
        if (active) setFetchedManufacturers([])
      }
    }
    void loadManufacturers()
    return () => {
      active = false
    }
  }, [hasVehicleMakeField, requestedVehicleTypes])

  useEffect(() => {
    if (!hasVehicleModelField || make.length < 2) return
    let active = true
    const loadModels = async () => {
      try {
        const options = await fetchVehicleModels(make, year || null)
        if (active) setModelsCache({ make, year, options })
      } catch {
        if (active) setModelsCache({ make, year, options: [] })
      }
    }
    void loadModels()
    return () => {
      active = false
    }
  }, [hasVehicleModelField, make, year])

  useEffect(() => {
    if (!hasVehicleTrimField) return
    let active = true
    const loadTrims = async () => {
      try {
        const options = await fetchVehicleTrims(make || null)
        if (active) setTrimsCache({ make, options })
      } catch {
        if (active) setTrimsCache({ make, options: [] })
      }
    }
    void loadTrims()
    return () => {
      active = false
    }
  }, [hasVehicleTrimField, make])

  const manufacturerOptions = hasVehicleMakeField ? fetchedManufacturers : []
  const modelOptions =
    hasVehicleModelField &&
    modelsCache.make === make &&
    modelsCache.year === year &&
    make.length >= 2
      ? modelsCache.options
      : []
  const trimOptions = trimsCache.make === make ? trimsCache.options : []

  return { manufacturerOptions, modelOptions, trimOptions }
}
