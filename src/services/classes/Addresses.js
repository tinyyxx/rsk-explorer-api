import Address from './Address'
import { isAddress } from '../../lib/utils'

export function Addresses (initConfig, nod3, { collections }) {
  const addresses = {}

  const add = (address, options = {}) => {
    if (!isAddress(address)) throw new Error(`Invalid address ${address}`)
    if (!addresses[address]) {
      options = options || {}
      options = Object.assign(options, { nod3, initConfig })
      addresses[address] = new Address(address, options)
    }
    return addresses[address]
  }

  const list = () => {
    return Object.values(addresses)
  }

  const getAddressDbData = async (address) => {
    try {
      if (!collections) return
      const { Addresses } = collections
      const data = await Addresses.findOne({ address })
      return data
    } catch (err) {
      return Promise.reject(err)
    }

  }
  const fetch = async (forceFetch) => {
    try {
      let addresses = list()
      for (let address of addresses) {
        await address.fetch(forceFetch)
      }
      return addresses.map(a => a.getData())
    } catch (err) {
      return Promise.reject(err)
    }
  }
  return Object.freeze({ add, list, fetch })
}

export default Addresses
