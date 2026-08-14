import assert from 'node:assert/strict'
import test from 'node:test'
import { PrismaCustomerRepository } from './repositories/PrismaCustomerRepository.ts'

test('customer phone is saved on both records and legacy user phone is returned', async () => {
  let customerCreate
  let userUpdate
  let customerUpdate
  const db = {
    $transaction: async callback => callback({
      user: {
        create: async ({ data }) => ({ id: 'user-1', ...data }),
        update: async args => (userUpdate = args),
      },
      customer: {
        create: async args => (customerCreate = args, { id: 'customer-1', ...args.data, user: { name: 'A', email: 'a@example.com', phone: '+971500000000' } }),
        findFirst: async () => ({ id: 'customer-1', userId: 'user-1' }),
        update: async args => (customerUpdate = args, { id: 'customer-1', ...args.data, user: { name: 'A', email: 'a@example.com', phone: args.data.phone } }),
      },
    }),
    customer: {
      findMany: async () => [{ id: 'legacy', phone: null, user: { name: 'A', email: 'a@example.com', phone: '+971511111111' } }],
      findFirst: async () => ({ id: 'customer-1', userId: 'user-1' }),
      update: async args => (customerUpdate = args, { id: 'customer-1', ...args.data, user: { name: 'A', email: 'a@example.com', phone: args.data.phone } }),
    },
    user: { update: async args => (userUpdate = args) },
  }
  const repository = new PrismaCustomerRepository(db)

  await repository.create('tenant-1', { name: 'A', email: 'a@example.com', phone: '+971500000000', temporaryPassword: 'password1' })
  assert.equal(customerCreate.data.phone, '+971500000000')
  assert.equal((await repository.findManyByTenant('tenant-1'))[0].phone, '+971511111111')
  await repository.update('tenant-1', 'customer-1', { id: 'customer-1', name: 'A', email: 'a@example.com', phone: '+971522222222' })
  assert.equal(userUpdate.data.phone, '+971522222222')
  assert.equal(customerUpdate.data.phone, '+971522222222')
})
