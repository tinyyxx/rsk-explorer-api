import { BigNumber } from 'bignumber.js'
import { BIG_NUMBER } from './types'
import { ObjectID } from 'mongodb'
import { remove0x, toBuffer, isAddress } from 'rsk-utils'
export * from 'rsk-utils'

export const bigNumberDoc = bigNumber => {
  return '0x' + bigNumber.toString(16)
}

export const isBigNumber = value => {
  return isObj(value) && (
    (value._isBigNumber === true) ||
    (value.isBigNumber === true) ||
    (value instanceof BigNumber) ||
    (value.lte && value.toNumber))
}

export const serializeBigNumber = value => {
  return (isBigNumber(value)) ? bigNumberDoc(value) : value
}

export const isSerializedBigNumber = value => {
  return value.type && value.value && value.type === BIG_NUMBER
}

export const unSerializeBigNumber = value => {
  return (isSerializedBigNumber(value)) ? new BigNumber(value.value) : value
}

export const bigNumberToSring = bn => {
  if (bn.type && bn.type === BIG_NUMBER) return bn.value
  if (isBigNumber(bn)) return bn.toString()
  return bn
}

export const bigNumberSum = values => {
  let total = new BigNumber(0)
  values
    .forEach(value => {
      value = newBigNumber(value)
      total = total.plus(value)
    })
  return total
}

export const bigNumberDifference = (a, b) => {
  a = newBigNumber(a)
  b = newBigNumber(b)
  return a.minus(b)
}

export const newBigNumber = value => isBigNumber(value) ? value : new BigNumber(value)

export const isObj = (value) => {
  return !Array.isArray(value) && typeof value === 'object' && value !== null
}

export const serialize = (obj) => {
  if (typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(o => serialize(o))
  if (isBigNumber(obj)) return serializeBigNumber(obj)
  if (obj instanceof ObjectID) return obj.toString()
  let serialized = {}
  for (let p in obj) {
    let value = obj[p]
    if (value !== null && typeof value === 'object') {
      if (Array.isArray(value)) {
        serialized[p] = value.map(v => serialize(v))
      } else {
        if (!isBigNumber(value)) serialized[p] = serialize(value)
        else serialized[p] = serializeBigNumber(value)
      }
    } else {
      serialized[p] = value
    }
  }
  return serialized
}

export const checkBlockHash = value => {
  value = String(value).toLowerCase()
  if (/^(0x)[0-9a-f]{64}$/.test(value)) return value
  if (/^[0-9a-f]{64}$/.test(value)) return '0x' + value
  return null
}

export const isBlockHash = value => checkBlockHash(value) !== null

export const blockQuery = (blockHashOrNumber) => {
  const hash = (isBlockHash(blockHashOrNumber)) ? blockHashOrNumber : null
  const number = parseInt(blockHashOrNumber)
  if (hash) return { hash }
  if (number || number === 0) return { number }
  return null
}

const blockTotalDiff = block => bigNumberToSring(block.totalDifficulty)

export const getBestBlock = blocks => {
  blocks.sort((a, b) => {
    let aDiff = blockTotalDiff(a)
    let bDiff = blockTotalDiff(b)
    if (aDiff > bDiff) return -1
    if (aDiff < bDiff) return 1
    return 0
  })
  return blocks[0]
}

export const applyDecimals = (value, decimals = 18) => {
  value = newBigNumber(value)
  const divisor = new BigNumber(10).exponentiatedBy(parseInt(decimals))
  const result = value.dividedBy(divisor)
  return result
}

export const isValidBlockNumber = number => parseInt(number) === number && number >= 0

export const isBlockObject = block => {
  if (typeof block !== 'object') return false
  const { hash, number, transactions, miner } = block
  if (!transactions) return false
  return isBlockHash(hash) && isAddress(miner) && isValidBlockNumber(number)
}

export const toAscii = hexString => toBuffer(remove0x(hexString), 'hex').toString('ascii').replace(/\0/g, '')

function filterArr (a) {
  if (!Array.isArray(a)) return a
  return a.find(x => filterArr(x))
}

export async function binarySearchNumber (searchCb, high, low) {
  try {
    high = parseInt(high || 0)
    low = parseInt(low || 0)
    if (typeof searchCb !== 'function') throw new Error('SeachCb must be a function')
    let [l, h] = await Promise.all([low, high].map(b => searchCb(b)))
    if (l !== h) {
      if (high === low + 1) {
        return high
      } else {
        let mid = Math.floor(high / 2 + low / 2)
        let res = await Promise.all([
          binarySearchNumber(searchCb, high, mid),
          binarySearchNumber(searchCb, mid, low)])
        return filterArr(res)
      }
    }
  } catch (err) {
    return Promise.reject(err)
  }
}
