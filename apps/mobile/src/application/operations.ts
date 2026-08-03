import type { OperationsGateway } from './ports'
import type { OperationModule, OperationRecord } from '../domain/operations/types'

export function loadOperationRecords(
  gateway: OperationsGateway,
  module: OperationModule,
  token: string,
): Promise<OperationRecord[]> {
  return gateway.getRecords(module, token)
}
